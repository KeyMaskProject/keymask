// @clack/prompts 封装:统一交互风格;用户取消(Ctrl+C/Esc)一律干净退出。
// 仅在 TTY 场景调用(调用方已用 isTTY 把关);非交互路径仍走 console.log 纯文本。
import * as p from "@clack/prompts";

export { note, log, intro, outro } from "@clack/prompts";

function bail(): never {
  p.cancel("Cancelled.");
  process.exit(1);
}

function unwrap<T>(v: T | symbol): T {
  if (p.isCancel(v)) bail();
  return v as T;
}

/** 单行文本输入;取消即退出。 */
export async function askText(
  message: string,
  opts: { placeholder?: string; validate?: (v: string) => string | undefined } = {},
): Promise<string> {
  return unwrap(
    await p.text({
      message,
      placeholder: opts.placeholder,
      validate: opts.validate ? (v) => opts.validate!(v ?? "") : undefined,
    }),
  );
}

/** 密码输入(掩码);取消即退出。 */
export async function askPassword(
  message: string,
  validate?: (v: string) => string | undefined,
): Promise<string> {
  return unwrap(await p.password({ message, validate: validate ? (v) => validate(v ?? "") : undefined }));
}

/** 单选;取消即退出。 */
export async function askSelect<T extends string>(
  message: string,
  options: { value: T; label: string; hint?: string }[],
): Promise<T> {
  // clack 的 Option<Value> 是条件类型,泛型参数下无法直接收窄,这里做一次显式断言。
  const opts = options as Parameters<typeof p.select<T>>[0]["options"];
  return unwrap(await p.select<T>({ message, options: opts }));
}

/** 转圈等待器。 */
export function spinner() {
  return p.spinner();
}
