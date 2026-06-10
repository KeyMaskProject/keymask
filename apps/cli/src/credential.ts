// 助记词的本机凭据与解锁缓存(机制与 web 版 vault-lock 一致):
//   - credential.json:用「解锁密码」经 Argon2id(m=64MB/t=3/p=1)派生密钥,
//     AES-256-GCM 加密助记词。格式 {v, kdf, salt, params, iv, ct},全 base64。
//     本地永不存明文密码;密码对不对靠 GCM 认证标签。
//   - unlock-cache.json:输对密码后 15 分钟内免重输(对齐 web 闲置自动锁定默认值)。
//     用设备密钥(device.key,32 随机字节 0600)AES-256-GCM 加密 + 过期时间,
//     每次命中滑动续期;过期即删,回到要密码的状态。
// 助记词/明文绝不进网络;加解密用 @keysark/crypto(与 web 同一套实现)。
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { join } from "node:path";
import {
  DEFAULT_ARGON2ID_PARAMS,
  decrypt,
  deriveWrappingKey,
  encrypt,
  generateWrappingSalt,
  scorePassword,
  type Argon2idParams,
  type StrengthReason,
} from "@keysark/crypto";
import { keysarkDir } from "./config";

/** 解锁缓存有效期:15 分钟(对齐 web 闲置自动锁定默认值),命中滑动续期。 */
const UNLOCK_TTL_MS = 15 * 60 * 1000;

const credentialPath = () => join(keysarkDir(), "credential.json");
const cachePath = () => join(keysarkDir(), "unlock-cache.json");
const deviceKeyPath = () => join(keysarkDir(), "device.key");

function ensureDir() {
  mkdirSync(keysarkDir(), { recursive: true });
}

function deviceKey(): Buffer {
  ensureDir();
  const p = deviceKeyPath();
  if (!existsSync(p)) {
    writeFileSync(p, randomBytes(32), { mode: 0o600 });
  }
  chmodSync(p, 0o600);
  return readFileSync(p);
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

// ---------- 密码加密的助记词凭据 ----------

interface Credential {
  v: 1;
  kdf: "argon2id";
  salt: string;
  params: Argon2idParams;
  iv: string;
  ct: string;
}

export function hasCredential(): boolean {
  return existsSync(credentialPath());
}

/** 用解锁密码封装助记词并落盘(覆盖旧凭据;salt 每次重新随机)。 */
export async function saveCredential(mnemonic: string, password: string): Promise<void> {
  const salt = generateWrappingSalt();
  const params = DEFAULT_ARGON2ID_PARAMS;
  const key = await deriveWrappingKey(password, salt, params);
  const { iv, ct } = await encrypt(key, new TextEncoder().encode(mnemonic));
  const cred: Credential = {
    v: 1,
    kdf: "argon2id",
    salt: b64(salt),
    params,
    iv: b64(iv),
    ct: b64(ct),
  };
  ensureDir();
  writeFileSync(credentialPath(), JSON.stringify(cred), { mode: 0o600 });
}

/** 密码解锁:还原助记词。无凭据或密码错误(GCM 认证失败)都抛错。 */
export async function unlockCredential(password: string): Promise<string> {
  const raw = JSON.parse(readFileSync(credentialPath(), "utf8")) as Credential;
  if (raw.v !== 1 || raw.kdf !== "argon2id") throw new Error("凭据格式不支持");
  const key = await deriveWrappingKey(password, unb64(raw.salt), raw.params);
  const pt = await decrypt(key, unb64(raw.iv), unb64(raw.ct));
  return new TextDecoder().decode(pt);
}

/** 忘记本机助记词:删除凭据与解锁缓存。 */
export function clearCredential(): void {
  rmSync(credentialPath(), { force: true });
  clearUnlockCache();
}

// ---------- 15 分钟解锁缓存(device.key 加密,滑动续期) ----------

interface UnlockCache {
  iv: string;
  ct: string;
  tag: string;
  expiresAt: number;
}

export function writeUnlockCache(mnemonic: string): void {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deviceKey(), iv);
  const ct = Buffer.concat([cipher.update(mnemonic, "utf8"), cipher.final()]);
  const cache: UnlockCache = {
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    expiresAt: Date.now() + UNLOCK_TTL_MS,
  };
  ensureDir();
  writeFileSync(cachePath(), JSON.stringify(cache), { mode: 0o600 });
}

/** 读解锁缓存:过期返回 null 并删除;命中则滑动续期(再给 15 分钟)。 */
export function readUnlockCache(): string | null {
  try {
    const cache = JSON.parse(readFileSync(cachePath(), "utf8")) as UnlockCache;
    if (!cache.expiresAt || cache.expiresAt < Date.now()) {
      clearUnlockCache();
      return null;
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deviceKey(),
      Buffer.from(cache.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(cache.tag, "base64"));
    const mnemonic = Buffer.concat([
      decipher.update(Buffer.from(cache.ct, "base64")),
      decipher.final(),
    ]).toString("utf8");
    writeUnlockCache(mnemonic); // 滑动续期
    return mnemonic;
  } catch {
    return null;
  }
}

export function clearUnlockCache(): void {
  rmSync(cachePath(), { force: true });
}

// ---------- 交互输入 ----------

/** 可见输入(助记词等非密码内容)。 */
export function promptVisible(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** 隐藏输入(密码):回显被吞掉,只在结束时换行。 */
export function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const muted = new Writable({
      write(_chunk, _enc, cb) {
        cb();
      },
    });
    const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const REASON_TEXT: Record<StrengthReason, string> = {
  too_short: "至少 12 位",
  need_classes: "需含小写/大写/数字/符号中至少 3 类",
  weak_pattern: "过于规律(重复/连续/常见密码)",
};

/** 交互设置解锁密码:强度校验(与 web 同一套规则)+ 二次确认,直到合格。 */
export async function promptNewPassword(): Promise<string> {
  for (;;) {
    const pw = await promptSecret("设置解锁密码(至少 12 位,含 3 类字符):");
    const score = scorePassword(pw);
    if (!score.ok) {
      console.error(`✗ 密码不达标:${score.reasons.map((r) => REASON_TEXT[r]).join(" · ")}`);
      continue;
    }
    const pw2 = await promptSecret("再输一遍确认:");
    if (pw !== pw2) {
      console.error("✗ 两次输入不一致,重来。");
      continue;
    }
    return pw;
  }
}

/**
 * 取助记词:env > 解锁缓存(15 分钟,滑动续期)> 密码解锁凭据(最多 3 次)。
 * allowPrompt=false 时不交互(脚本场景)。返回 null 表示无可用助记词(应先 import)。
 */
export async function acquireMnemonic(allowPrompt = true): Promise<string | null> {
  const env = process.env.KEYSARK_MNEMONIC?.trim();
  if (env) return env.replace(/\s+/g, " ");

  const cached = readUnlockCache();
  if (cached) return cached;

  if (!hasCredential()) return null;
  if (!allowPrompt || !process.stdin.isTTY) return null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const pw = await promptSecret("解锁密码:");
    if (!pw) continue;
    try {
      const mnemonic = await unlockCredential(pw);
      writeUnlockCache(mnemonic); // 输对密码 → 15 分钟内免重输
      return mnemonic;
    } catch {
      console.error(attempt < 3 ? "✗ 密码错误,再试一次。" : "✗ 密码错误。");
    }
  }
  return null;
}
