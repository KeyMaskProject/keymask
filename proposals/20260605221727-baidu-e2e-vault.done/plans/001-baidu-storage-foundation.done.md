# 迁移百度存储 + 登录骨架

> 来自 proposal: proposals/20260605221727-baidu-e2e-vault/

## 目标

- 在 `/Users/zeiss/kothry/keyper` 立起可工作的 monorepo:百度 OAuth 登录 + 沙盒文件字节读写,服务端按 uk 存/刷新 token。无加密、无多网盘、无 better-auth。这是 plan 002 加密层的底座。

## 改动范围

- **新增**(迁移自 `workspace/keyper`,按下方裁剪):
  - 根:`package.json`(含 `pnpm.overrides.kysely` 是否保留见「关键点」)、`pnpm-workspace.yaml`、`.npmrc`、`tsconfig.base.json`、`.gitignore`、`CLAUDE.md`、`.env.local.example`、`.panes/dev.yaml`。
  - `packages/ui` —— 原样迁移(Button + styles,shadcn 唯一栖息地约束不变)。
  - `packages/baidupan` —— 原样迁移(OAuth + 沙盒文件客户端,字节进字节出)。
  - `packages/db` —— 迁移 `storage_account` 表 + accessors;provider 固定 `"baidu"`(可保留列以便将来,但只写 baidu 行)。
  - `apps/web` —— Next.js App Router:
    - 登录/回调/登出/刷新:迁移 `lib/storage.ts` 的 `handleStorageLogin/Callback` + `getConnectedStorage`,**去掉 `[provider]` 分发**,固定 baidu;路由收敛为 `/api/auth/login`、`/api/baidu/callback`(保留此回调路径以复用已登记的百度回调页)、`/api/auth/logout`。
    - 文件字节 API:`GET /api/files`(列表)、`GET /api/files/content?fileId=`(下载原始字节,base64 返回)、`POST /api/files`(上传 base64 字节体)。**注意:此 plan 里收发明文字节即可,加密在 002 接管;但 API 契约现在就按「不透明字节(base64)」设计**,这样 002 不用改路由。
- **更新**:固定端口沿用源项目的随机端口策略,新项目现挑一个写死(`.env.local` + `package.json -p` + `BAIDU_REDIRECT_URI` 三处同步)。
- **删除**(相对源项目):`packages/storage`、`packages/auth`、Google Drive adapter、多 provider 选项卡、`better-auth` 依赖、`GOOGLE_*` env。

## 验收

- [ ] `pnpm install` 成功,`pnpm -r typecheck` 全绿。
- [ ] `pnpm --filter @keyper/web build` 通过。
- [ ] 浏览器走完百度授权 → 回调落 `storage_account`(provider=baidu)→ 首页显示已连接 + 沙盒文件列表。
- [ ] `POST /api/files` 传一段字节 → 百度 `/apps/Keyper/` 出现该文件;`GET /api/files/content` 原样取回。
- [ ] 仓库内 grep 不到 `@keyper/storage`、`@keyper/auth`、`better-auth`、`gdrive`、`GOOGLE_`。

## 关键点

- **API 契约现在就定成「不透明 base64 字节」**:列表项只暴露 `{id, name, size}`,内容收发一律 base64。否则 002 接加密时要返工路由。
- **kysely 0.28.7 pin 是否还需要**:源项目因 better-auth 间接依赖 kysely 0.29.x 编译失败才 pin。本项目删掉 better-auth 后,若依赖树里不再有 kysely,则**不要**带上这个 override(无意义)。装完 `pnpm why kysely` 确认。
- **百度回调路径复用**:保留 `/api/baidu/callback` 作为回调 URL,避免又一次「改回调页等 1 小时生效」。`BAIDU_REDIRECT_URI` 指向它。
- 沙盒大小写敏感:`BAIDU_APP_DIR_NAME=Keyper`(与控制台登记一致)。
- 凭据只进根 `.env.local`(单一来源,软链分发给 `apps/web`、`packages/db`);SecretKey 已泄露需提醒重置。

---

## 实施日志

- **执行时间**:2026-06-05 23:40
- **整体状态**:已完成

### 做了什么
- 新建 monorepo:根 `package.json`(无 kysely override)、`pnpm-workspace.yaml`、`.npmrc`、`tsconfig.base.json`、`.gitignore`、`CLAUDE.md`(含 E2E 硬约束)、`.env.local(.example)`、`.panes/dev.yaml`。
- 拷入 `packages/ui`、`packages/baidupan`(原样)、`packages/db`;`packages/db/src/schema.ts` 裁剪为仅 `storage_account`(删掉 better-auth 四张表 user/session/account/verification)。
- 端口固定 **6134**(沿用已登记百度回调页,免重登记);DB 用独立库 `keyper-vault-local`(localhost:5433)。
- `apps/web` 从头写:
  - 登录链:`lib/baidu.ts`(`getConnectedBaidu`/`handleLogin`/`handleCallback`,baidu 固定、过期前 60s 自动 refresh)+ 路由 `/api/auth/login`、`/api/baidu/callback`、`/api/auth/logout`。
  - 字节文件 API(base64 不透明契约):`GET /api/files`(列表 id/name/size)、`POST /api/files`(base64 字节上传)、`GET /api/files/content?fileId=`(base64 字节下载)。
  - 最小明文面板 `raw-file-panel.tsx`(标注:plan 002 将替换为加解密保险库面板)。
- 砍掉:`@keyper/storage`、`@keyper/auth`、Google Drive、多 provider、`better-auth` 依赖、`GOOGLE_*`、serverExternalPackages、kysely override。

### 验收核对
- [x] `pnpm install` 成功、`pnpm -r typecheck` 全绿(4 包)。
- [x] `pnpm --filter @keyper/web build` 通过;路由树 = `/`、`/api/auth/{login,logout}`、`/api/baidu/callback`、`/api/files`、`/api/files/content`。
- [~] 百度授权 → 落 `storage_account` → 列表:**代码就绪,需用户在浏览器完成一次真实授权才能验**(外部依赖,非阻塞)。`storage_account` 表已建。
- [~] `POST/GET /api/files` 字节往返:同上,需已授权会话(浏览器 OAuth)才能跑通真实网盘往返;路由/契约已编译通过。
- [x] grep 无 `@keyper/storage`/`@keyper/auth`/`better-auth`/`gdrive`/`GOOGLE_`;`pnpm why kysely` 为空(故未引入 override,符合关键点)。

### 偏差与遗留
- 拷来的 `schema.ts` 带 better-auth 四表,已就地裁剪为仅 `storage_account` 并把 DB 里误建的四表 DROP 掉(与 plan「删除 better-auth」一致)。
- 两条 `[~]` 验收依赖真实百度授权(浏览器),headless 无法完成,留作 plan 002 完成后与加密链路一并手测。
