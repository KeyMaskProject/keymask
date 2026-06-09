// 纯浏览器 E2E 加密。BIP39 助记词 → 派生密钥 → AES-256-GCM。
// 禁止 import node:crypto;只用 globalThis.crypto.subtle + @noble/@scure(纯 JS)。
import {
  generateMnemonic as bip39Generate,
  validateMnemonic as bip39Validate,
  mnemonicToSeed,
} from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

const VERIFIER_MARKER = "keysark-verify-v1";
const HKDF_INFO = new TextEncoder().encode("keysark-aes-gcm-v1");

// 把 Uint8Array 拷成独立 ArrayBuffer,规避 WebCrypto 类型对 SharedArrayBuffer 的排斥。
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  return u.slice().buffer as ArrayBuffer;
}

function b64encode(u: Uint8Array): string {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/** BIP39 助记词,固定 12 词 + 英文词表(对齐 MetaMask)。 */
export function generateMnemonic(): string {
  return bip39Generate(wordlist, 128);
}

export function validateMnemonic(mnemonic: string): boolean {
  return bip39Validate(mnemonic.trim(), wordlist);
}

/** mnemonic → BIP39 seed (PBKDF2-HMAC-SHA512) → HKDF-SHA256 → AES-256-GCM CryptoKey。 */
export async function deriveKey(mnemonic: string): Promise<CryptoKey> {
  const seed = await mnemonicToSeed(mnemonic.trim());
  const keyBytes = hkdf(sha256, seed, new Uint8Array(0), HKDF_INFO, 32);
  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface Cipher {
  iv: Uint8Array;
  ct: Uint8Array;
}

export async function encrypt(key: CryptoKey, plaintext: Uint8Array): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit,每次随机
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext),
  );
  return { iv, ct: new Uint8Array(ct) };
}

export async function decrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ct: Uint8Array,
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ct),
  );
  return new Uint8Array(pt);
}

interface Envelope {
  v: 1;
  alg: "A256GCM";
  kdf: "BIP39+HKDF-SHA256";
  iv: string;
  ct: string;
}

/** 明文字符串 → 加密 → envelope JSON 字节(存上网盘的格式)。 */
export async function encryptToEnvelope(key: CryptoKey, plaintext: string): Promise<Uint8Array> {
  const { iv, ct } = await encrypt(key, new TextEncoder().encode(plaintext));
  const env: Envelope = {
    v: 1,
    alg: "A256GCM",
    kdf: "BIP39+HKDF-SHA256",
    iv: b64encode(iv),
    ct: b64encode(ct),
  };
  return new TextEncoder().encode(JSON.stringify(env));
}

export async function decryptFromEnvelope(
  key: CryptoKey,
  envelopeBytes: Uint8Array,
): Promise<string> {
  const env = JSON.parse(new TextDecoder().decode(envelopeBytes)) as Envelope;
  const pt = await decrypt(key, b64decode(env.iv), b64decode(env.ct));
  return new TextDecoder().decode(pt);
}

// ---------- 二进制信封(文件密文专用,无 base64/JSON,省 33% 体积) ----------
// 帧格式:magic(4B "KSF1") + ver(1B=1) + iv(12B) + ct(剩余全部)。
// 文本条目继续用上面的 JSON 信封(兼容历史数据);大文件走这套裸字节帧。
const BLOB_MAGIC = new Uint8Array([0x4b, 0x53, 0x46, 0x31]); // "KSF1"
const BLOB_VER = 1;
const BLOB_HEADER_LEN = 4 + 1 + 12; // = 17

/** 原始字节 → 加密 → 二进制信封字节(存上网盘的文件 artifact 格式)。 */
export async function encryptBytesToBlob(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const { iv, ct } = await encrypt(key, data);
  const out = new Uint8Array(BLOB_HEADER_LEN + ct.byteLength);
  out.set(BLOB_MAGIC, 0);
  out[4] = BLOB_VER;
  out.set(iv, 5);
  out.set(ct, BLOB_HEADER_LEN);
  return out;
}

/** 二进制信封字节 → 解密 → 原始字节。 */
export async function decryptBytesFromBlob(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  if (blob.byteLength < BLOB_HEADER_LEN) throw new Error("blob too short");
  for (let i = 0; i < BLOB_MAGIC.length; i++) {
    if (blob[i] !== BLOB_MAGIC[i]) throw new Error("bad blob magic");
  }
  if (blob[4] !== BLOB_VER) throw new Error(`unsupported blob version ${blob[4]}`);
  const iv = blob.subarray(5, BLOB_HEADER_LEN);
  const ct = blob.subarray(BLOB_HEADER_LEN);
  return decrypt(key, iv, ct);
}

/** 口令校验块:加密已知标记。解锁时解密比对,判断助记词是否正确。 */
export async function makeVerifier(key: CryptoKey): Promise<Uint8Array> {
  return encryptToEnvelope(key, VERIFIER_MARKER);
}

export async function checkVerifier(key: CryptoKey, verifierBytes: Uint8Array): Promise<boolean> {
  try {
    return (await decryptFromEnvelope(key, verifierBytes)) === VERIFIER_MARKER;
  } catch {
    return false;
  }
}
