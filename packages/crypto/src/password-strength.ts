// 解锁密码强度校验:最低 12 位 + ≥3 类字符 + 拒绝弱模式;轻量本地熵估算,不引 zxcvbn
// (~400KB,离线爆破的真正防线是 Argon2id + 长度)。设密码(002)与改密码(003)共用。

export const MIN_PASSWORD_LENGTH = 12;

/** 不达标原因码,UI 侧映射 i18n 文案。 */
export type StrengthReason = "too_short" | "need_classes" | "weak_pattern";

export interface PasswordScore {
  /** 达标才允许提交:≥12 位 + ≥3 类字符 + 非弱模式。 */
  ok: boolean;
  /** 0-4,强度条段数(0=空/极弱,4=很强)。 */
  score: 0 | 1 | 2 | 3 | 4;
  reasons: StrengthReason[];
}

// 高频弱密码词干(小写比对)。只拦「词干占密码主体」的情况,不做完整字典。
const COMMON_STEMS = [
  "password",
  "passwort",
  "qwertyuiop",
  "qwerty",
  "letmein",
  "iloveyou",
  "welcome",
  "monkey",
  "dragon",
  "admin",
  "keysark",
  "12345678",
  "123456789",
  "1234567890",
  "abc123",
];

function charClasses(pw: string): number {
  let n = 0;
  if (/[a-z]/.test(pw)) n++;
  if (/[A-Z]/.test(pw)) n++;
  if (/[0-9]/.test(pw)) n++;
  if (/[^a-zA-Z0-9]/.test(pw)) n++;
  return n;
}

// 整串是否为等差码点序列(abcdef…/654321…,步长 ±1)。
function isSequential(pw: string): boolean {
  if (pw.length < 4) return false;
  const step = pw.charCodeAt(1) - pw.charCodeAt(0);
  if (step !== 1 && step !== -1) return false;
  for (let i = 2; i < pw.length; i++) {
    if (pw.charCodeAt(i) - pw.charCodeAt(i - 1) !== step) return false;
  }
  return true;
}

function isWeakPattern(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true; // 纯重复:aaaaaaaaaaaa
  if (/^(.+?)\1+$/.test(pw)) return true; // 重复块:abcabcabcabc
  if (isSequential(pw)) return true; // 连续:abcdefghijkl / 987654321098
  const lower = pw.toLowerCase();
  // 常见词干占密码主体(≥一半长度,如 "Password2024!")。
  for (const stem of COMMON_STEMS) {
    if (lower.includes(stem) && stem.length * 2 >= pw.length) return true;
  }
  return false;
}

/** 轻量熵估算:字符池大小 ^ 有效长度;重复字符与弱模式打折。 */
function entropyBits(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  // 有效长度:重复出现的字符按递减权重计(第 2 次 0.6、第 3 次起 0.4),压低 "aabbccddee" 类。
  const seen = new Map<string, number>();
  let effLen = 0;
  for (const ch of pw) {
    const k = seen.get(ch) ?? 0;
    effLen += k === 0 ? 1 : k === 1 ? 0.6 : 0.4;
    seen.set(ch, k + 1);
  }
  return effLen * Math.log2(pool || 1);
}

export function scorePassword(pw: string): PasswordScore {
  const reasons: StrengthReason[] = [];
  if (pw.length < MIN_PASSWORD_LENGTH) reasons.push("too_short");
  if (charClasses(pw) < 3) reasons.push("need_classes");
  const weak = pw.length > 0 && isWeakPattern(pw);
  if (weak) reasons.push("weak_pattern");

  let bits = entropyBits(pw);
  if (weak) bits *= 0.3;
  const score: PasswordScore["score"] = bits < 28 ? 0 : bits < 45 ? 1 : bits < 65 ? 2 : bits < 90 ? 3 : 4;

  return { ok: reasons.length === 0, score, reasons };
}
