# keysark

pnpm monorepo. Workspaces: `apps/*`, `packages/*`。

端到端加密的网盘文本保管库:存储后端支持 **百度网盘** 与 **Google Drive**(各自的 OAuth 登录,二选一);内容在浏览器用用户手持的 **BIP39 助记词** 派生密钥加密,服务端与存储后端只经手密文。

- 百度:OAuth + 沙盒目录 `/apps/Keyper/`。
- Google:OAuth + Drive,存放位置由环境变量 `GOOGLE_DRIVE_FOLDER` 决定(二选一,均只碰本应用文件):
  - **留空(默认)**:**appDataFolder**(应用专属隐藏文件夹,scope `drive.appdata`,用户在 Drive 里看不到)。
  - **设为文件夹名(如 `KeysArk`)**:My Drive 根目录下的**可见文件夹**,scope `drive.file`(应用只能访问自己创建/打开的文件)。
  - 切换该变量需重新登录授权(scope 变化)。
- 上层(`apps/web` 的 page / `/api/files*`)只依赖统一抽象 `@/lib/storage`(`getConnectedStorage()`),与具体后端无关。

## 强制约束 (Hard rules)

### 1. shadcn/ui 只能经由 `packages/ui` 暴露

- shadcn/ui 组件只能存在于 `packages/ui` 内。`apps/*` 或其他 `packages/*` 一律 `import { X } from "@keysark/ui"`,不得直接 `pnpm add @radix-ui/*` 或在自己包里 `shadcn add`。
- 新增/升级:`packages/ui` 内 `pnpm dlx shadcn@latest add <name>` → `src/index.ts` 导出 → 使用方 import。

### 2. UUID 一律 uuid v7,统一走 `uuidv7`

- 全仓库禁止 `crypto.randomUUID()` (v4) / `uuid` 包 v1/v3/v4/v5 / 自造 ID。唯一入口 `newId()`(`@keysark/db`)。

### 3. 端到端加密:主密钥与明文禁止触达服务端

- 加密/解密只在浏览器,只在 `@keysark/crypto` + client component。**主密钥(助记词派生)、助记词本身、明文内容**禁止出现在任何服务端代码、API 请求/响应体、URL、cookie、日志、DB。
- 服务端 API 只搬运**不透明 base64 密文**;`@keysark/baidupan` 与 `@keysark/googledrive` 字节进字节出,内容无关。
- 助记词 = BIP39 **24 词 + 英文词表**(256-bit 熵,标准 BIP39,可导入 MetaMask)。历史库的 12 词助记词继续被接受(`validateMnemonic` / `deriveKey` 不做长度限制),无需迁移;只有**新建库**生成 24 词。AES-256-GCM,IV 每次随机 96-bit、绝不复用。
- 本机解锁密码包裹助记词:Argon2id **512MB / t=4 / p=1**(`DEFAULT_ARGON2ID_PARAMS`)。参数随凭据存储,调高仅影响新封装。

### 4. 所有布局容器必须带固定 `data-testid`

- 每个**布局容器**(页面级 / 区域级的 `div`/`section`/`aside`/`main`/`header`/`footer`、卡片、面板、滚动区等结构性元素)都要有一个**固定、语义化、kebab-case、跨重构稳定**的 `data-testid`。
- 唯一注入方式:`@/lib/test-id` 的 `testId()` —— `<div {...testId("vault-workbench")} />`。禁止手写裸 `data-testid={...}`,禁止用拼接 / 随机 / 索引生成的不稳定值。
- 由环境变量 `NEXT_PUBLIC_TEST_IDS` 总开关控制(`1`/`true` 开,留空/`0`/`false` 关);生产默认关闭,关闭时不渲染任何 `data-testid`。改动该变量需重启 dev。
- 新增布局容器时一并补 `testId`;命名约定:页面/大区用 `<scope>`(如 `landing`、`vault-workbench`),其内子区用 `<scope>-<part>`(如 `vault-nav-header`、`vault-item-content-card`)。

### 5. 所有用户操作必须经 `AnalyticsEvent` 枚举上报事件(Vercel Web Analytics)

- 统计唯一入口:`@/lib/analytics` 的 `AnalyticsEvent` 枚举 + `trackEvent(event, props?)`。禁止在组件里散落裸字符串 `track("...")`。
- **新增任意用户操作(新建/编辑/删除/导出/连接/切换…)时,必须**:① 往 `AnalyticsEvent` 补一个语义化 snake_case 成员;② 在该操作的 handler 成功路径里 `trackEvent(AnalyticsEvent.Xxx, …)`。事件名跨重构稳定,改名等于换事件,谨慎。
- **零敏感数据**(承接铁律 3):事件属性禁止出现助记词 / 明文内容 / 主密钥 / 解锁密码 / 条目标题 / 文件名 / 文件夹名。只允许非敏感、低基数的标量维度(`provider`/`view`/`sort`/`theme`/`locale`/`kind`/`scope`/`count`/`minutes`/`isNew` 等)。`trackEvent` 通过键白名单 + 标量校验 + 长度上限做运行时兜底,越界项静默丢弃 —— 但不得依赖兜底,调用处本就不该传敏感值。
- 统计是「尽力而为」:`trackEvent` 吞掉一切异常,绝不阻断用户操作。

## 包与目录

- `apps/web` — Next.js 应用。百度/Google 登录 + 统一字节文件 API + 浏览器端加解密保险库 UI。存储抽象在 `src/lib/storage.ts`。
- `packages/ui` — React + Tailwind + shadcn/ui 封装层。
- `packages/baidupan` — 百度网盘开放平台客户端 (OAuth + 沙盒文件读写,字节进字节出)。
- `packages/googledrive` — Google Drive 客户端 (OAuth + appDataFolder 文件读写,字节进字节出)。
- `packages/db` — Drizzle ORM + postgres-js。`storage_account` 按 `(provider, account_key)` 存 baidu/google token。
- `packages/crypto` — 纯浏览器 E2E 加密 (BIP39 助记词 → AES-256-GCM)。**[plan 002 新增]**

## 常用命令

- `pnpm install` / `pnpm -r typecheck` / `pnpm -r build`
- `pnpm --filter @keysark/web dev` — 启动 Next.js (端口 6134)
- `pnpm --filter @keysark/db db:push` — 应用 schema (dev)
- `pnpm dev` — panes 编排 (web)
