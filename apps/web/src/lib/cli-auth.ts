// CLI 设备码授权的服务端辅助:码/令牌生成与哈希。
// 全部码与令牌只以 SHA-256 入库;明文只在 HTTP 响应里出现一次。
import { createHash, randomBytes } from "node:crypto";

/** 核对码字母表:去掉 0/O/1/I/L 等易混字符。 */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 生成人类可读核对码,形如 ABCD-1234(展示给用户肉眼核对,防钓鱼)。 */
export function generateUserCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += USER_CODE_ALPHABET[bytes[i]! % USER_CODE_ALPHABET.length];
    if (i === 3) s += "-";
  }
  return s;
}

/** 生成 device_code(只在 CLI 与服务端之间流转的高熵随机串)。 */
export function generateDeviceCode(): string {
  return randomBytes(32).toString("base64url");
}

/** 生成 CLI 长期令牌,带 ksk_ 前缀便于识别/扫描。 */
export function generateCliToken(): string {
  return `ksk_${randomBytes(32).toString("base64url")}`;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** 规范化用户输入/链接里的核对码:大写、去空格、补连字符。 */
export function normalizeUserCode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** 设备码授权请求有效期(秒)与建议轮询间隔(秒)。 */
export const DEVICE_EXPIRES_IN = 600;
export const DEVICE_POLL_INTERVAL = 3;
