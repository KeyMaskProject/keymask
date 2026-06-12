// 极简 ANSI 颜色:无依赖;非 TTY / NO_COLOR 时自动退化为纯文本(FORCE_COLOR 强开)。
const enabled =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb" &&
  (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY === true);

const wrap =
  (open: number, close: number) =>
  (s: string): string =>
    enabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const cyan = wrap(36, 39);

/** 常用前缀:成功 ✓(绿)/ 失败 ✗(红)。 */
export const OK = green("✓");
export const ERR = red("✗");
