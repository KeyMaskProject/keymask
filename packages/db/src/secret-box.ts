// 服务端字段级信封加密(AES-256-GCM)。用于把落库的 OAuth access/refresh token
// 加密存储:DB 泄露也拿不到可用 token。主密钥来自环境变量 KEYSARK_DB_ENCRYPTION_KEY
// (base64 编码的 32 字节),建议由 KMS/密钥管理注入。
//
// 兼容/安全策略:
//   - 生产(NODE_ENV=production)缺主密钥 → 启动即抛错(fail closed),绝不静默退回明文。
//   - 开发缺主密钥 → 明文存储(与历史行为一致),仅告警一次。
//   - 设了主密钥 → 写入加密为 "enc:v1:<base64(iv|tag|ct)>";读取时按前缀分流,
//     历史明文行原样返回(下次写入即自动升级为密文)。
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const ENV_KEY = "KEYSARK_DB_ENCRYPTION_KEY";

let _key: Buffer | null | undefined;
let _warned = false;

/**
 * 解析主密钥。配置非法(长度≠32B)直接抛错。未配置时:
 *   - 生产抛错(fail closed);开发返回 null(明文模式,告警一次)。
 */
function masterKey(): Buffer | null {
  if (_key !== undefined) return _key;
  const raw = process.env[ENV_KEY];
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `${ENV_KEY} is required in production (refusing to store OAuth tokens in plaintext). ` +
          `Generate one with: openssl rand -base64 32`,
      );
    }
    if (!_warned) {
      console.warn(
        `[secret-box] ${ENV_KEY} not set; OAuth tokens stored in PLAINTEXT (dev only). ` +
          "Set it (base64 of 32 bytes) before production.",
      );
      _warned = true;
    }
    _key = null;
    return null;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${ENV_KEY} must be base64 of exactly 32 bytes (got ${buf.length})`);
  }
  _key = buf;
  return buf;
}

/** 是否已启用字段加密(主密钥已配置)。 */
export function dbEncryptionEnabled(): boolean {
  return masterKey() !== null;
}

/** 加密一个字段值。未配置主密钥 → 原样返回(明文)。空串不加密。 */
export function sealField(plaintext: string): string {
  const key = masterKey();
  if (!key || plaintext === "") return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** 解密一个字段值。无前缀 → 视为历史明文,原样返回。带前缀但无主密钥 → 抛错(配置缺失)。 */
export function openField(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // 历史明文行
  const key = masterKey();
  if (!key) throw new Error(`${ENV_KEY} is required to read encrypted token rows`);
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
