# 加密文件在线预览 + 语法高亮

> Created: 2026-06-09

## 结论

- 一句话方案:在现有 file 卡片(`vault-item-file-card`)位置内嵌**纯浏览器预览区**——解密得到的 `Uint8Array` 按**扩展名**分流:`.pdf` 走 pdfjs-dist canvas 渲染;`.json/.txt/.env/.toml/.yaml/.yml` 走 `TextDecoder` → highlight.js 高亮。下载按钮保留。
- 完成的可观测信号:选中一个 `.json` 文件,预览区显示带颜色的高亮代码;选中一个 `.pdf`,预览区显示首页 canvas + 翻页;选中 `.zip` 等未支持类型,只显示下载按钮。全程 Network 面板无任何明文/密文请求(预览只消费已解密的 `Uint8Array`)。

## 约束(推导依据)

- **E2E 硬约束**(CLAUDE.md 规则 3):解密只在浏览器,明文禁止触达服务端。`Vault.openFile(id)` 返回 `Promise<Uint8Array>`(`packages/vault/src/vault.ts:288`),预览必须 100% 客户端消费此字节,不得回传任何渲染服务。→ 排除一切服务端转码/缩略图方案。
- pdfjs-dist 的 worker 也在浏览器内运行;字节直接喂 `getDocument({data: bytes})`,无网络。
- 现有数据已够用:`EntryMeta.filename` + `mimeType` + `fileSize`(`packages/vault/src/types.ts:25-36`)已存。**扩展名比 mimeType 可靠**——`.env/.toml` 上传时 `file.type` 多为空串或 `application/octet-stream`,无法据此分流。→ 用 `filename` 后缀做格式判定。
- 现有渲染锚点:`vault-panel.tsx:1581-1603` 已按 `selected?.kind === "file"` 渲染下载卡片,预览区在 `vault-item-preview-body`。预览组件挂在这里。
- 高亮库已定:**highlight.js 按需注册**(用户确认)——只 import `highlight.js/lib/core` + 注册 `json/yaml/ini`,体积 ~30-50KB,同步执行。
- 现有依赖:`apps/web` 无任何高亮/PDF/markdown 库(已有 `jspdf` 仅用于备份导出,非渲染)。两个新依赖:`highlight.js`、`pdfjs-dist`。
- 内存约束:文件上限 100MB(`MAX_FILE_BYTES`),单次解密入内存。高亮大文本会卡 UI → 需预览体积上限。

## 关键决策

- **格式判定用扩展名,不用 mimeType**:因 `.env/.toml` 的 `file.type` 不可靠(见约束)。建一张 `ext → previewKind` 映射表。
- **highlight.js 按需注册**:选 highlight.js 不选 Shiki —— bundle 与同步性优先,所列 6 种文本格式全可被 `json/yaml/ini` 三种 grammar 覆盖(`.env`/`.toml` 用 `ini`,`.txt` 纯文本不高亮)。偏离"VS Code 同款高亮"主流(Shiki),因隐私网盘对首屏体积敏感,质量差异不值首屏成本。
- **两个重库都懒加载**:`pdfjs-dist`、`highlight.js` 仅在实际预览对应类型时 `await import()`,不进首屏 bundle。
- **预览体积分级上限**:高亮 ≤ 1MB;1–5MB 纯文本不高亮直接显示;> 5MB 文本 与 未支持类型 → 仅下载按钮 + 提示。PDF 不限(pdfjs 分页渲染)。数字可调,先定此档。
- **非 UTF-8 文本降级**:`TextDecoder('utf-8', {fatal:true})` 抛错(误判的二进制)→ 回退为"仅下载"。
- **预览内嵌当前预览区,不开 Dialog/Sheet**:与现有 text entry 的内嵌预览一致,避免引入新 shadcn 组件(规则 1 成本)。
- **PDF worker 走打包内 worker,不走 CDN**:隐私应用不应向第三方 CDN 取 worker 脚本;用 `pdfjs-dist` 自带 worker 经 Next 打包/`?url` 引入。

## 未决 / 信息不足

- pdfjs-dist 在 Next.js 16 + Turbopack 下的 worker 引入方式(`new Worker(new URL(...))` vs `GlobalWorkerOptions.workerSrc = ...?url`)需在 002 实施时实测确定;两种都纯客户端,不影响架构。

## Plans 拆分

| 编号 | 标题 | 路径 | 依赖 | 状态 |
|---|---|---|---|---|
| 001 | 预览框架 + 文本/代码高亮(json/txt/.env/.toml/.yaml/.yml) | `plans/001-preview-shell-and-code-highlight.done.md` | - | 已完成 |
| 002 | PDF 渲染(pdfjs-dist + worker) | `plans/002-pdf-rendering.done.md` | 001 | 已完成 |
