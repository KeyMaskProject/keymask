"use client";

// PDF 预览:把已解密字节交给 pdfjs-dist 在浏览器内渲染成可翻页 canvas,全程无网络。
// worker 来自打包产物(new URL + import.meta.url),绝不向第三方 CDN 取脚本。
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@keysark/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "../providers";
import { testId } from "@/lib/test-id";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  // 加载文档。传字节副本:pdfjs 会把 buffer transfer 给 worker(detach),
  // 不能让父组件 state 持有的 Uint8Array 失效(否则下载/重渲染会炸)。
  useEffect(() => {
    let cancelled = false;
    setError(false);
    setNumPages(0);
    setPage(1);
    const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    task.promise
      .then((pdf) => {
        // cancelled 为真 = cleanup 已跑过并 task.destroy(),文档随之销毁,直接返回。
        if (cancelled) return;
        docRef.current = pdf;
        setNumPages(pdf.numPages);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      void task.destroy(); // 销毁 loading task 会一并拆掉文档与 worker
      docRef.current = null;
    };
  }, [bytes]);

  // 渲染当前页。大 PDF 只渲当前页,不一次性渲全部页。
  useEffect(() => {
    const pdf = docRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || numPages === 0) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    pdf
      .getPage(page)
      .then((p) => {
        if (cancelled) return;
        const viewport = p.getViewport({ scale: 1.5 });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = p.render({ canvas, canvasContext: ctx, viewport });
        renderTask.promise.catch(() => {
          /* cancel() 会以 RenderingCancelledException reject,忽略 */
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [page, numPages]);

  if (error) {
    return (
      <div className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
        {t("pdf_render_fail")}
      </div>
    );
  }

  return (
    <div {...testId("vault-item-pdf-preview")} className="flex flex-col">
      <div className="flex items-center justify-center gap-3 border-b border-[var(--color-border)] px-4 py-2 text-xs">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("pdf_prev")}
        </Button>
        <span className="text-[var(--color-muted-foreground)]">
          {numPages > 0 ? t("pdf_page", page, numPages) : t("preview_loading")}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={numPages === 0 || page >= numPages}
          onClick={() => setPage((p) => Math.min(numPages, p + 1))}
        >
          {t("pdf_next")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        {...testId("vault-item-pdf-canvas")}
        className="flex max-h-[60vh] justify-center overflow-auto bg-[var(--color-muted)] p-4"
      >
        <canvas ref={canvasRef} className="h-auto max-w-full shadow" />
      </div>
    </div>
  );
}
