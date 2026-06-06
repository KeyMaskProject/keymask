# keysark

pnpm monorepo. Workspaces: `apps/*`, `packages/*`。

端到端加密的网盘文本保管库:**百度网盘**为唯一存储后端,**百度 OAuth** 为唯一登录;内容在浏览器用用户手持的 **BIP39 助记词** 派生密钥加密,服务端与百度只经手密文。

## 强制约束 (Hard rules)

### 1. shadcn/ui 只能经由 `packages/ui` 暴露

- shadcn/ui 组件只能存在于 `packages/ui` 内。`apps/*` 或其他 `packages/*` 一律 `import { X } from "@keysark/ui"`,不得直接 `pnpm add @radix-ui/*` 或在自己包里 `shadcn add`。
- 新增/升级:`packages/ui` 内 `pnpm dlx shadcn@latest add <name>` → `src/index.ts` 导出 → 使用方 import。

### 2. UUID 一律 uuid v7,统一走 `uuidv7`

- 全仓库禁止 `crypto.randomUUID()` (v4) / `uuid` 包 v1/v3/v4/v5 / 自造 ID。唯一入口 `newId()`(`@keysark/db`)。

### 3. 端到端加密:主密钥与明文禁止触达服务端

- 加密/解密只在浏览器,只在 `@keysark/crypto` + client component。**主密钥(助记词派生)、助记词本身、明文内容**禁止出现在任何服务端代码、API 请求/响应体、URL、cookie、日志、DB。
- 服务端 API 只搬运**不透明 base64 密文**;`@keysark/baidupan` 字节进字节出,内容无关。
- 助记词 = BIP39 **12 词 + 英文词表**(对齐 MetaMask)。AES-256-GCM,IV 每次随机 96-bit、绝不复用。

## 包与目录

- `apps/web` — Next.js 应用。百度登录 + 字节文件 API + 浏览器端加解密保险库 UI。
- `packages/ui` — React + Tailwind + shadcn/ui 封装层。
- `packages/baidupan` — 百度网盘开放平台客户端 (OAuth + 沙盒文件读写,字节进字节出)。
- `packages/db` — Drizzle ORM + postgres-js。`storage_account` 存百度 token。
- `packages/crypto` — 纯浏览器 E2E 加密 (BIP39 助记词 → AES-256-GCM)。**[plan 002 新增]**

## 常用命令

- `pnpm install` / `pnpm -r typecheck` / `pnpm -r build`
- `pnpm --filter @keysark/web dev` — 启动 Next.js (端口 6134)
- `pnpm --filter @keysark/db db:push` — 应用 schema (dev)
- `pnpm dev` — panes 编排 (web + drizzle studio)
