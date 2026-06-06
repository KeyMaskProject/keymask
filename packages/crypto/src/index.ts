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
