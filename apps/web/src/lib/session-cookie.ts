// 签名会话 cookie:把账号标识(Google sub / 百度 uk)用 HMAC-SHA256 签名 + 内嵌过期,
// 防止伪造「任意账号 ID」当 bearer 用。值本身不机密(只是账号标识),签名保证完整性与不可伪造。
//
// 主密钥来自 KEYSARK_SESSION_SECRET(任意高熵字符串)。生产必须配置;未配置时
// 退化为「进程内随机密钥 + 告警」,使开发可用、但重启即失效、多实例互不认(逼迫生产配置)。
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ENV_SECRET = "KEYSARK_SESSION_SECRET";
let _secret: Buffer | undefined;
let _warned = false;

function secret(): Buffer {
  if (_secret) return _secret;
  const raw = process.env[ENV_SECRET];
  if (raw && raw.length >= 16) {
    _secret = Buffer.from(raw, "utf8");
  } else {
    if (!_warned) {
      console.warn(
        `[session] ${ENV_SECRET} not set (or too short); using an ephemeral per-process key. ` +
          "Set it in production or sessions break across restarts/instances.",
      );
      _warned = true;
    }
    _secret = randomBytes(32);
  }
  return _secret;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** 生产环境下 cookie 应带 Secure;开发(http localhost)不带,否则浏览器丢弃。 */
const isProd = process.env.NODE_ENV === "production";

/** 统一的会话 cookie 选项。 */
export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** 签发会话 cookie 值:`<value>.<expEpochSec>.<hmac>`。 */
export function signSession(value: string, maxAgeSec: number): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = `${value}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** 校验会话 cookie 值;签名不符或已过期返回 null,否则返回原始 value。 */
export function verifySession(raw: string | undefined): string | null {
  if (!raw) return null;
  const i2 = raw.lastIndexOf(".");
  if (i2 < 0) return null;
  const payload = raw.slice(0, i2);
  const mac = raw.slice(i2 + 1);
  const i1 = payload.lastIndexOf(".");
  if (i1 < 0) return null;
  const value = payload.slice(0, i1);
  const exp = Number(payload.slice(i1 + 1));
  if (!value || !Number.isFinite(exp)) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (exp * 1000 < Date.now()) return null; // 过期(防御纵深:即便 cookie maxAge 被改也拦)
  return value;
}
