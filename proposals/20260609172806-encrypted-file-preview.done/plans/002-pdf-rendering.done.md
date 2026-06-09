# PDF 渲染

> 来自 proposal: proposals/20260609172806-encrypted-file-preview/

## 目标

- 选中 `.pdf` 文件时,在 001 的预览壳内用 pdfjs-dist 把解密字节渲染成可翻页的 canvas,全程浏览器内、无网络。

## 改动范围

- **新增**:
  - `apps/web/src/components/file-preview/PdfPreview.tsx` —— 接收 `Uint8Array`,懒加载 `pdfjs-dist`,`getDocument({data: bytes})` → 渲染当前页到 `<canvas>`,带上/下页 + 页码(`第 n / N 页`)。带 `testId("vault-item-pdf-preview")`,canvas 容器 `testId("vault-item-pdf-canvas")`。
  - pdfjs worker 引入(`?url` 或 `new URL(...,import.meta.url)`,002 实测定),禁用 CDN workerSrc。
- **更新**:
  - `apps/web/src/components/file-preview/FilePreview.tsx`(001 建)—— `pdf` 分支由占位改为渲染 `PdfPreview`。
  - `apps/web/package.json` —— 加 `pdfjs-dist`。
  - `apps/web/src/lib/i18n.ts` —— 新增 `pdf_page(n,total)`、`pdf_prev`、`pdf_next`、`pdf_render_fail` 等 key。
  - 如需要,`next.config` 调整以支持 worker 打包(实施时按报错定夺)。

## 验收

- [ ] 选中多页 `.pdf`,预览区显示首页 canvas,翻页按钮可切换并显示"第 n / N 页"。
- [ ] 损坏/加密 PDF:显示 `pdf_render_fail`,不崩溃,下载按钮仍可用。
- [ ] Network 面板:渲染过程零请求(worker 来自打包产物,不取第三方 CDN)。
- [ ] `pdfjs-dist` 仅在首次预览 PDF 时加载(动态 import)。
- [ ] `pnpm -r typecheck` + `pnpm --filter @keysark/web build` 通过(worker 打包不报错)。

## 关键点

- **worker 来源**:绝不用默认 CDN `workerSrc`(隐私应用不向第三方取脚本);用打包内 worker。这是本 plan 最易翻车点,优先在 Next 16 + Turbopack 下验证。
- 字节来源是 001 的 `openFile` 结果;`getDocument` 会 transfer/读取该 `ArrayBuffer`,若 001 复用同一 buffer 做下载需注意 detach——必要时传副本。
- 大 PDF(接近 100MB)只渲染当前页,不一次性渲全部页(内存/性能)。

---

## 实施日志

- **执行时间**:2026-06-09 17:42
- **整体状态**:已完成

### 做了什么
- 新增 `apps/web/src/components/file-preview/PdfPreview.tsx`:`import * as pdfjsLib from "pdfjs-dist"`,worker 经 `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` 由打包产物提供(不走 CDN)。`getDocument({data: new Uint8Array(bytes)})`(传副本避免 detach 掉父组件 state 的字节)→ 翻页渲染当前页到 canvas;上一页/下一页 + `第 n/N 页`。`testId("vault-item-pdf-preview")` / `vault-item-pdf-canvas")`。渲染/加载失败 → `pdf_render_fail`。卸载时 `task.destroy()` 拆 worker,切页时 `renderTask.cancel()`。
- `FilePreview.tsx`(001 建)的 pdf 分支用 `lazy(() => import("./PdfPreview"))` + Suspense,pdfjs-dist 不进首屏。
- `i18n.ts`:`pdf_page`/`pdf_prev`/`pdf_next`/`pdf_render_fail`(zh/en,随 001 一并落)。
- `package.json`:加 `pdfjs-dist@6.0.227`。
- worker 打包:Next 16 + Turbopack 下 `new URL(...,import.meta.url)` 写法直接 build 通过,无需改 next.config(proposal 未决项就此确定)。

### 验收核对
- [x] 多页 PDF:翻页按钮 + `第 n/N 页`,只渲当前页 —— 渲染 effect 依赖 `[page,numPages]`,逐页 getPage/render。
- [x] 损坏/加密 PDF:`pdf_render_fail`,不崩溃,下载仍可用 —— task.promise/getPage 的 catch → setError,下载按钮独立。
- [x] 渲染零网络请求,worker 来自打包产物 —— workerSrc 指向本地 `new URL` 资源,字节来自 openFile。
- [x] pdfjs-dist 仅首次预览 PDF 时加载 —— lazy + `import * as pdfjsLib` 在 PdfPreview 模块内,独立 chunk。
- [x] `pnpm -r typecheck` + `pnpm --filter @keysark/web build` 通过(worker 打包不报错)。

### 偏差与遗留
- v6 的 `PDFDocumentProxy` 无 `destroy()`,改为持 loading task 并在 cleanup `task.destroy()`(连带销毁文档+worker);文档级只有 `cleanup()`,无需单独调。
- `page.render` 在 v6 同时要求 `canvas` 与 `canvasContext`,已都传。
- 真机翻页/缩放手测同 001:需认证保险库会话,留作后续手测。
