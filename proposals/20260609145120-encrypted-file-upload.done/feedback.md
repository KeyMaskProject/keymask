# Feedback

执行 proposal 期间冒出的、未在当前会话处理的事项。收尾后由用户决定要不要新开 proposal / plan 处理。

---

## [plans/002-web-file-upload-ui] Next 16 移除 `next lint`,仓库 lint 脚本失效

- **类型**:范围外发现 / 工具链
- **位置**:`apps/web/package.json` `"lint": "next lint"`
- **描述**:Next 16.2.7 已删除 `next lint` 子命令,执行报 "Invalid project directory ... /lint"。本次改用 `next build` 做权威校验。
- **建议**:迁移到 ESLint CLI(加 `eslint` 依赖 + flat config,`"lint": "eslint ."`),恢复 lint 能力。

## [plans/002-web-file-upload-ui] /api/files/blob 在 serverless 部署有 body 上限

- **类型**:范围外发现 / 部署
- **位置**:`apps/web/src/app/api/files/blob/route.ts`
- **描述**:自托管 Node 下 100MB octet-stream 上传无碍;若部署到 Vercel 等 serverless,函数 body 默认上限约 4.5MB,会拦截大文件。
- **建议**:若上 serverless,需改走客户端直传网盘(预签名/直连)或调高平台上限;自托管则无需处理。

## [plans/002-web-file-upload-ui] 文件条目「在网盘打开」链接指向 .json 而非 .bin

- **类型**:UX 小瑕疵
- **位置**:`vault-panel.tsx` 预览底部 `itemRelPath(selectedVault.dir, selected.id)`
- **描述**:文件条目正文存 `<id>.bin`,但「在网盘打开」链接仍指向 `<id>.json`(元信息)。
- **建议**:文件条目改用 `itemBlobRelPath`(已在 @keysark/vault 导出)生成链接。

## [plans/002-web-file-upload-ui] 列表行未区分文件/文本条目

- **类型**:UX 优化
- **位置**:`vault-panel.tsx` `itemRow`
- **描述**:文件条目在左侧列表中与文本条目外观一致(仅标题=文件名),无文件图标/大小标识,预览页才区分。
- **建议**:`itemRow` 按 `e.kind === "file"` 显示文件图标 + `humanSize(e.fileSize)`。

## [plans/001-vault-file-data-contract] CLI 与 /api/files JSON 端点仍走 base64

- **类型**:一致性 / 范围外
- **位置**:`apps/cli/src/transport.ts`、`apps/web/src/app/api/files/route.ts`(POST)、`/api/files/content`(GET)
- **描述**:浏览器 transport 已切二进制端点;CLI 与旧 JSON 端点仍用 base64(文本小文件无碍,但 CLI 若也传文件会有 33% 膨胀 + 内存峰值)。
- **建议**:若 CLI 要支持文件,把 CLI transport 也切到 `/api/files/blob`;否则保留(旧端点供 CLI 文本/index 用)。

## [proposal] 真·网盘端到端验证待登录态

- **类型**:验证遗留
- **位置**:整体链路
- **描述**:saveFile/openFile/remove 的真实网盘 round-trip(~50MB 上传下载逐字节一致、删除后 .bin/.json 消失)需登录 Google/百度后在运行中的 app 手验,离线无法执行。
- **建议**:登录后用 `/verify` 或手动跑一遍:上传中等文件 → 刷新 → 下载比对 sha256 → 删除确认网盘文件消失。
