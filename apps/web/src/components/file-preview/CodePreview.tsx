"use client";

// 文本/代码预览:把已解密的明文字节解码为 UTF-8 → highlight.js 高亮(懒加载)。
// 输入字节来自浏览器内解密,本就要进 DOM,无额外泄露;highlight.js 输出已转义。
import { useEffect, useState } from "react";
import { useT } from "../providers";
import { testId } from "@/lib/test-id";
import {
  HIGHLIGHT_MAX_BYTES,
  TEXT_MAX_BYTES,
  TEXT_MAX_LABEL,
  type HighlightLang,
} from "@/lib/file-preview";

async function loadLanguage(lang: HighlightLang) {
  switch (lang) {
    case "json":
      return (await import("highlight.js/lib/languages/json")).default;
    case "yaml":
      return (await import("highlight.js/lib/languages/yaml")).default;
    case "ini":
      return (await import("highlight.js/lib/languages/ini")).default;
  }
}

type State =
  | { phase: "loading" }
  | { phase: "highlighted"; html: string }
  | { phase: "plain"; text: string }
  | { phase: "error"; message: string };

export function CodePreview({ bytes, lang }: { bytes: Uint8Array; lang: HighlightLang | null }) {
  const t = useT();
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    (async () => {
      const size = bytes.byteLength;
      if (size > TEXT_MAX_BYTES) {
        if (!cancelled) setState({ phase: "error", message: t("preview_too_large", TEXT_MAX_LABEL) });
        return;
      }
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        if (!cancelled) setState({ phase: "error", message: t("preview_decode_fail") });
        return;
      }
      // 纯文本,或 >1MB:不高亮直接显示,避免大文件高亮卡 UI。
      if (!lang || size > HIGHLIGHT_MAX_BYTES) {
        if (!cancelled) setState({ phase: "plain", text });
        return;
      }
      try {
        const hljs = (await import("highlight.js/lib/core")).default;
        if (!hljs.getLanguage(lang)) hljs.registerLanguage(lang, await loadLanguage(lang));
        const { value } = hljs.highlight(text, { language: lang });
        if (!cancelled) setState({ phase: "highlighted", html: value });
      } catch {
        // 高亮失败不该挡住内容,降级为纯文本。
        if (!cancelled) setState({ phase: "plain", text });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes, lang, t]);

  if (state.phase === "loading") {
    return (
      <div className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">{t("preview_loading")}</div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">{state.message}</div>
    );
  }
  return (
    <pre className="max-h-[60vh] overflow-auto px-4 py-3 text-xs leading-relaxed">
      <code className="hljs block whitespace-pre font-mono">
        {state.phase === "highlighted" ? (
          <span dangerouslySetInnerHTML={{ __html: state.html }} />
        ) : (
          state.text
        )}
      </code>
    </pre>
  );
}
