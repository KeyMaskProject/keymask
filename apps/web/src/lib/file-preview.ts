// 文件在线预览的格式判定与体积分级。纯函数,无副作用,可在任何环境调用。
// 判定一律用「文件名后缀」,不用 mimeType —— .env/.toml 上传时 file.type 多为空或
// application/octet-stream,据此分流会失败(见 proposal 关键决策)。

export type PreviewKind = "pdf" | "code" | "text" | "unsupported";

// highlight.js 语言 id;code 类必带,text 类为 null(纯文本不高亮)。
export type HighlightLang = "json" | "yaml" | "ini";

export interface PreviewSpec {
  kind: PreviewKind;
  lang?: HighlightLang | null;
}

// 后缀 → 预览规格。.env/.toml 复用 highlight.js 的 ini grammar(KEY=value / [section])。
const EXT_MAP: Record<string, PreviewSpec> = {
  pdf: { kind: "pdf" },
  json: { kind: "code", lang: "json" },
  yaml: { kind: "code", lang: "yaml" },
  yml: { kind: "code", lang: "yaml" },
  toml: { kind: "code", lang: "ini" },
  env: { kind: "code", lang: "ini" },
  txt: { kind: "text", lang: null },
};

// 取最后一段后缀(小写)。".env" → "env"(dotfile 也能命中)。
export function extOf(filename: string): string {
  const name = filename.toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1);
}

export function previewSpecOf(filename: string): PreviewSpec {
  const name = filename.toLowerCase();
  // .env / .env.local / .env.production / foo.env 一律按 env(ini)处理
  if (name === ".env" || name.startsWith(".env.") || name.endsWith(".env")) {
    return { kind: "code", lang: "ini" };
  }
  return EXT_MAP[extOf(name)] ?? { kind: "unsupported" };
}

// 体积分级:先看字节数再决定是否解码/高亮,避免对超大文件做无谓的大字符串分配。
export const HIGHLIGHT_MAX_BYTES = 1024 * 1024; // ≤1MB 才高亮
export const TEXT_MAX_BYTES = 5 * 1024 * 1024; // 1–5MB 纯文本不高亮;>5MB 仅下载

// 体积上限的人类可读串,供超限提示复用。
export const TEXT_MAX_LABEL = "5MB";
