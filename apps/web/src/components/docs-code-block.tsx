"use client";

// 文档页代码块 + 复制按钮(唯一交互部分,从 docs.tsx 抽出,使文档正文可服务端渲染)。
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({ code, id }: { code: string; id: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="relative min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-accent)]">
      <pre className="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-xs leading-relaxed">{code}</pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)]"
        aria-label={`copy ${id}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[var(--color-success)]" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
