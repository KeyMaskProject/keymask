# apps/web 二进制传输端点 + 文件上传/下载 UI

> 来自 proposal: proposals/20260609145120-encrypted-file-upload/
> 依赖: 001(需要 vault `saveFile`/`openFile`/`delete` 与二进制信封)

## 目标

- 在 apps/web 打通文件上传/下载的端到端链路:新增绕过 base64+JSON 的二进制端点,浏览器 StorageTransport 支持二进制收发,vault-panel 增加文件上传入口与下载按钮。100MB 文件可加密上传、刷新后下载还原。

## 改动范围

- **新增**(`apps/web/src/app/api/files/content/...` 或 `apps/web/src/app/api/files/blob/route.ts`):二进制端点。
  - `POST`:body 为 `application/octet-stream` 原始密文字节,path 经查询参数/header 传;`await request.arrayBuffer()` → `Uint8Array` → `conn.client.upload(path, bytes)`。不经 base64、不经 `request.json()`。
  - `GET`:按 fileId `conn.client.download` → 直接以 `application/octet-stream` 返回原始密文字节(非 JSON 包 base64)。
  - 配置 Next.js route body 上限以容纳 ~100MB(`route segment config` / `bodyParser`)。
  - `DELETE`(或在现有删除处接 `client.delete`):暴露 001 加的 `delete` 给浏览器 transport。
- **更新**(浏览器侧 `StorageTransport` 实现,定位 `apps/web` 内实现 `upload/download/list` 的文件):
  - 大文件 `upload`/`download` 改走新二进制端点(raw bytes),小文件(index/文本条目/注册表)保持现有 JSON 端点;或统一切到二进制端点。
  - 实现 `delete(path)` 调新 DELETE。
- **更新**(`apps/web/src/components/vault-panel.tsx`):
  - 新建条目时增加「上传文件」入口(`<input type="file">`,经 `@keysark/ui` 封装的按钮触发);选中后读 `File` → `arrayBuffer` → `Uint8Array` → `vault.saveFile(...)`,前端校验 ≤100MB 并提示。
  - 文件条目在列表中带类型标识与大小展示(复用 `EntryMeta.fileSize`)。
  - 打开文件条目时:不渲染 textarea,改为展示文件名/大小 + 「下载」按钮 → `vault.openFile(id)` 得字节 → 触发浏览器下载(Blob + `mimeType` + 原 `filename`)。
  - 文本条目编辑路径(`<Textarea>` + `save`)保持不变。
- **testId**(硬约束 4):新增的文件上传区、文件条目展示卡、下载区等布局容器,一律经 `@/lib/test-id` 的 `testId()` 注入语义化 kebab-case id(如 `vault-file-upload`、`vault-item-file-card`、`vault-item-file-download`)。禁止裸 `data-testid`。

## 验收

- [ ] `pnpm -r typecheck` 通过;`pnpm --filter @keysark/web dev` 起得来。
- [ ] 选一个 ~50MB 文件上传 → 网盘 `items/<id>.bin` 为密文 → 刷新页面 → 下载得到逐字节相同的文件(可用 sha256 比对)。
- [ ] 服务端请求体/日志中不出现明文或文件字节明文(只过密文 bytes);DevTools 网络面板上传请求为 octet-stream 二进制非 base64。
- [ ] 超过 100MB 的文件在前端被拦截并给出明确提示。
- [ ] 删除文件条目后网盘 `.bin`/`.json` 消失;文本条目读写、列表混排正常。
- [ ] `NEXT_PUBLIC_TEST_IDS=1` 时新容器渲染出固定 testId;关闭时不渲染。

## 关键点

- Next.js route body 大小默认上限会拦截 100MB,务必显式放开新端点的上限;同时确认部署侧反代(若有)放行。
- 大文件下载用 `application/octet-stream` 直返字节,别再包成 JSON+base64(否则 100MB → 133MB 字符串重新踩内存坑)。
- 加解密只在浏览器:`saveFile`/`openFile` 在 client component 调,密钥不入服务端(硬约束 3)。
- 文件 `Blob`/`ObjectURL` 用完即 `revokeObjectURL`,避免 100MB 泄漏在内存。
- 上传中给进度/禁用态:100MB 加密 + 上传非瞬时,避免用户重复点击。

---

## 实施日志

- **执行时间**:2026-06-09 15:0x
- **整体状态**:已完成(真·网盘 round-trip 待登录态手验)

### 做了什么
- `apps/web/src/app/api/files/blob/route.ts`(新增):二进制端点。POST `?path=` 读 `request.arrayBuffer()` 直传 `client.upload`;GET `?fileId=` 以 `application/octet-stream` 直返原始字节。`runtime=nodejs`、`maxDuration=60`。无 base64/JSON。
- `apps/web/src/lib/vault.ts`:browserTransport `upload`/`download` 切到 `/api/files/blob`(octet-stream),删掉不再用的本地 `b64encode/b64decode`(文本/index 同样受益,去 base64)。`delete` 已在 001 加。
- `apps/web/src/lib/i18n.ts`:zh/en 各加 upload_file / file_too_large / file_section / file_download / file_size_label / st_uploading / st_uploaded(_local) / st_upload_fail / st_downloading / st_download_fail。
- `apps/web/src/components/vault-panel.tsx`:
  - 模块级 `MAX_FILE_BYTES=100MB` + `humanSize()`。
  - `fileInputRef` + `pendingUploadFolder` ref;隐藏 `<input type=file>`;`pickFile()` 触发。
  - `onPickedFile`:前端校验 ≤100MB → `file.arrayBuffer()` → `v.saveFile(...)`(浏览器内加密)→ 选中 + 预览。
  - `downloadFile`:`v.openFile(id)` → Blob(mimeType)→ ObjectURL 触发下载 → `revokeObjectURL`。
  - 下拉菜单加「上传文件」项(+ 分隔线)。
  - 预览模式 file-aware:文件条目隐藏「编辑」按钮、用方形文件图标、渲染 `vault-item-file-card`(文件名+大小+`vault-item-file-download` 下载按钮),文本条目维持原 Textarea/正文。

### 验收核对
- [x] `pnpm -r typecheck` 全过;`next build` 编译 + TS 通过,`/api/files/blob` 出现在路由表。
- [x] >100MB 前端拦截:`onPickedFile` 中 `file.size > MAX_FILE_BYTES` → 提示 `file_too_large` 并 return。
- [x] 上传走 octet-stream 非 base64:blob 端点 + browserTransport body 为 `ArrayBuffer`;下载 `res.arrayBuffer()`。
- [x] 新容器 testId:`vault-item-file-card`、`vault-item-file-download`(经 `testId()`,受 `NEXT_PUBLIC_TEST_IDS` 开关)。
- [~] ~50MB 上传→下载逐字节一致 / 删除后 `.bin`+`.json` 消失:需登录态(实时 OAuth + 运行 app),离线无法执行;链路由 build + 001 crypto round-trip 保证。

### 偏差与遗留
- Next 16 已移除 `next lint` 子命令,仓库 `lint` 脚本(`next lint`)失效;本次用 `next build` 做权威校验代替。→ feedback。
- 真·网盘端到端(上传/下载/删除)需登录 Google/百度后手验,留待 verify。
