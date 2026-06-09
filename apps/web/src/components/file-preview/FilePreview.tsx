"use client";

// 文件预览分流壳:据文件名后缀选 PreviewKind,取回解密字节,渲染对应子组件。
// 解密只在浏览器(loadBytes 内部走 Vault.openFile);本组件不碰服务端。
// pdf 子组件用 lazy 懒加载,pdfjs-dist 不进首屏 chunk。
import { lazy, Suspense, useEffect, useState } from "react";
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

  useEffect(() => {
    if (spec.kind === "unsupported") return;
    let cancelled = false;
    setBytes(null);
    setError(null);
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

  return (
    <div
      {...testId("vault-item-file-preview")}
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-accent)]"
    >
      {spec.kind === "pdf" || spec.kind === "markdown" ? (
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
      )}
    </div>
  );
}
