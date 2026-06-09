# 预览框架 + 文本/代码高亮

> 来自 proposal: proposals/20260609172806-encrypted-file-preview/

## 目标

- 选中 file entry 时,在预览区按扩展名分流渲染;本 plan 交付**预览框架(格式判定 + 分流壳 + 体积分级)** 与**文本/代码高亮**(`.json/.txt/.env/.toml/.yaml/.yml`)。PDF 留给 002,壳里先占位"暂不支持/仅下载"。

## 改动范围

- **新增**:
  - `apps/web/src/lib/file-preview.ts` —— `ext → PreviewKind` 映射(`pdf | code | text | unsupported`)+ 高亮语言映射(`.json→json`、`.yaml/.yml→yaml`、`.env/.toml→ini`、`.txt→`纯文本)+ 体积分级常量(高亮 1MB / 纯文本 5MB)。
  - `apps/web/src/components/file-preview/CodePreview.tsx` —— 接收 `Uint8Array`,`TextDecoder('utf-8',{fatal:true})` 解码,懒加载 `highlight.js/lib/core` 并 `registerLanguage` json/yaml/ini,输出高亮 DOM。解码失败 / 超限 → 降级。带 `testId("vault-item-code-preview")`。
  - `apps/web/src/components/file-preview/FilePreview.tsx` —— 分流壳:据 `filename` 选 `PreviewKind`,调用 `vault.openFile(id)` 取字节,渲染对应子组件或下载占位。带 `testId("vault-item-file-preview")`。
  - highlight.js CSS 主题(import 一个 theme,或最小自定义)。
- **更新**:
  - `apps/web/src/components/vault-panel.tsx:1581-1603` —— file 分支由"只有下载卡"改为"预览区(`FilePreview`)+ 下载按钮"。复用/保留 `vault-item-file-card`、`vault-item-file-download` testId。
  - `apps/web/src/lib/i18n.ts` —— 新增 `preview_unsupported`、`preview_too_large(max)`、`preview_decode_fail`、`preview_loading` 等 key(zh/en 双份,沿用 `Msg` 模式)。
  - `apps/web/package.json` —— 加 `highlight.js` 依赖。

## 验收

- [ ] 上传并选中 `.json` 文件,预览区显示语法高亮(键名/字符串/数字着色)。
- [ ] `.yaml`/`.yml`、`.env`、`.toml` 选中后分别以 yaml / ini 高亮显示。
- [ ] `.txt` 显示为等宽纯文本(不报错、不高亮)。
- [ ] 1–5MB 文本:显示纯文本不高亮;> 5MB 文本 / 误标为文本的二进制:显示"仅下载"+ 提示,不卡死。
- [ ] 下载按钮行为不变。
- [ ] Network 面板:预览过程零新增请求(字节来自 `openFile` 解密)。
- [ ] `pnpm -r typecheck` 通过。
- [ ] highlight.js 仅在首次预览代码类文件时才加载(动态 import,不在首屏 chunk)。

## 关键点

- **分流用扩展名**,不用 mimeType(`.env/.toml` 的 `file.type` 不可靠)。
- highlight.js 用 `lib/core` + `registerLanguage`,**不要** import 全量包(体积)。
- 高亮 DOM 用 `dangerouslySetInnerHTML` 注入 `hljs.highlight()` 结果——输入是已解密明文,本就要进 DOM,无额外泄露;但要确认 highlight.js 输出已转义(它会)。
- 大文件先判 `fileSize` 再决定是否解码/高亮,**别先解码再判**(避免无谓的大字符串分配)。

---

## 实施日志

- **执行时间**:2026-06-09 17:40
- **整体状态**:已完成

### 做了什么
- 新增 `apps/web/src/lib/file-preview.ts`:`previewSpecOf(filename)` 按后缀分流(pdf/code/text/unsupported)+ highlight 语言映射(.json→json、.yaml/.yml→yaml、.env/.toml→ini)+ 体积分级常量(高亮 1MB / 纯文本 5MB)。`.env`/`.env.local`/`foo.env` 特判为 ini。
- 新增 `apps/web/src/components/file-preview/CodePreview.tsx`:`TextDecoder('utf-8',{fatal:true})` 解码 → 懒加载 `highlight.js/lib/core` + 按需 `registerLanguage`。超 5MB → 超限提示;解码失败 → 二进制提示;无 lang 或 >1MB → 纯文本不高亮;高亮失败 → 降级纯文本。
- 新增 `apps/web/src/components/file-preview/FilePreview.tsx`:分流壳,`loadBytes(entryId)` 取解密字节,据 kind 渲染 CodePreview 或(lazy)PdfPreview;unsupported / 加载失败 / 加载中均有提示。`testId("vault-item-file-preview")`。
- `globals.css`:加 highlight.js token 着色,色板走 CSS 变量,跟随 light/dark/system 三态(:root 默认浅、`.dark` 覆盖、`prefers-color-scheme` 兜系统深)。只定义 json/yaml/ini 用到的 token,不引整套主题 CSS。
- `i18n.ts`:zh/en 各加 `preview_loading`/`preview_unsupported`/`preview_too_large`/`preview_decode_fail`/`preview_load_fail`(+002 的 pdf_* 一并加了)。
- `vault-panel.tsx`:file 分支由「仅下载卡」改为「下载卡 + FilePreview」,外层包 `space-y-4`;`loadBytes` 传 `(id) => vaultRef.current!.openFile(id)`。保留 `vault-item-file-card`/`vault-item-file-download` testId。
- `package.json`:加 `highlight.js@11.11.1`。

### 验收核对
- [x] `.json`/`.yaml`/`.yml`/`.env`/`.toml` 分流到 code 高亮 —— hljs 实测三种 grammar 分别产出 attr/string/number/literal/section 等 token span(node 验证),CSS 已着色。
- [x] `.txt` 走纯文本不高亮 —— spec.lang=null → plain 分支。
- [x] 1–5MB 纯文本 / >5MB 仅提示 / 非 UTF-8 降级 —— CodePreview 分支逻辑覆盖,先判字节数再解码。
- [x] 下载按钮行为不变 —— 未改 downloadFile 与卡片按钮。
- [x] 预览零新增网络请求 —— 字节来自 `openFile` 解密(浏览器内),CodePreview 不发请求。
- [x] `pnpm -r typecheck` 通过 + `pnpm --filter @keysark/web build` 通过。
- [x] highlight.js 仅在首次预览代码类时加载 —— core 与各语言均 `await import()`,构建产物中为独立 chunk(按构造)。

### 偏差与遗留
- 「在真实应用里选中 .json 看到彩色高亮 / 选中 PDF 看到渲染」这类端到端项需要已认证的保险库会话(OAuth 登录 + 助记词解锁),headless 无法触达 → 以 typecheck + build + hljs token 实测 + worker 本地打包成功 作为构造性证据;真机手测留作后续。
- hljs 的 `keyword`/`punctuation`(json)未在 CSS 着色,按默认文本色显示,不影响可读性。
