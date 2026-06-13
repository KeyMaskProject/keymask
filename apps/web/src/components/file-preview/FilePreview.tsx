"use client";

// 文件预览分流壳:据文件名后缀选 PreviewKind,取回解密字节,渲染对应子组件。
// 解密只在浏览器(loadBytes 内部走 Vault.openFile);本组件不碰服务端。
// pdf 子组件用 lazy 懒加载,pdfjs-dist 不进首屏 chunk。
import { lazy, Suspense, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useT } from "../providers";
import { testId } from "@/lib/test-id";
import { previewSpecOf } from "@/lib/file-preview";
import { CodePreview } from "./CodePreview";

const PdfPreview = lazy(() => import("./PdfPreview").then((m) => ({ default: m.PdfPreview })));
const MarkdownPreview = lazy(() =>
  import("./MarkdownPreview").then((m) => ({ default: m.MarkdownPreview })),
);

export function FilePreview({
  entryId,
  filename,
  loadBytes,
}: {
  entryId: string;
  filename: string;
  loadBytes: (id: string) => Promise<Uint8Array>;
}) {
  const t = useT();
  const spec = previewSpecOf(filename);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false); // 默认遮住,防旁人窥屏(与文本条目一致)

  useEffect(() => {
    if (spec.kind === "unsupported") return;
    let cancelled = false;
    setBytes(null);
    setError(null);
    setRevealed(false); // 切换条目 → 重新盖上
    loadBytes(entryId)
      .then((b) => {
        if (!cancelled) setBytes(b);
      })
      .catch((e) => {
        if (!cancelled) setError(t("preview_load_fail", String(e)));
      });
    return () => {
      cancelled = true;
    };
    // loadBytes 在父组件稳定(读 vaultRef);仅 entryId / kind 变化时重取。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, spec.kind]);

  const notice = (msg: string) => (
    <div
      {...testId("vault-item-file-preview")}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-accent)] px-4 py-3 text-xs text-[var(--color-muted-foreground)]"
    >
      {msg}
    </div>
  );

  if (spec.kind === "unsupported") return notice(t("preview_unsupported"));
  if (error) return notice(error);
  if (!bytes) return notice(t("preview_loading"));

  const body =
    spec.kind === "pdf" || spec.kind === "markdown" ? (
      <Suspense
        fallback={
          <div className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
            {t("preview_loading")}
          </div>
        }
      >
        {spec.kind === "pdf" ? <PdfPreview bytes={bytes} /> : <MarkdownPreview bytes={bytes} />}
      </Suspense>
    ) : (
      <CodePreview bytes={bytes} lang={spec.lang ?? null} />
    );

  // 默认毛玻璃遮罩:渲染好的预览盖在磨砂层下(可透出大致版式),点击揭开;揭开后右上角可再盖上。
  if (!revealed) {
    return (
      <button
        type="button"
        {...testId("vault-item-file-veil")}
        onClick={() => setRevealed(true)}
        aria-label={t("content_reveal")}
        className="relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-accent)] text-left"
      >
        <div aria-hidden className="pointer-events-none select-none">
          {body}
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center backdrop-blur-md"
          style={{ background: "color-mix(in oklch, var(--color-accent) 35%, transparent)" }}
        >
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] shadow-sm">
            <Eye className="h-3.5 w-3.5" />
            {t("content_reveal")}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      {...testId("vault-item-file-preview")}
      className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-accent)]"
    >
      {body}
      <button
        type="button"
        {...testId("vault-item-file-hide")}
        onClick={() => setRevealed(false)}
        aria-label={t("content_hide")}
        title={t("content_hide")}
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] shadow-sm transition-colors hover:text-[var(--color-foreground)]"
      >
        <EyeOff className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
