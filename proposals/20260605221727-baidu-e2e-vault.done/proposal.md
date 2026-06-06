# Keyper:百度网盘 + 端到端加密保管库

> Created: 2026-06-05

## 结论

- 一句话方案:在 `/Users/zeiss/kothry/keyper` 新建 monorepo,迁移 `workspace/keyper` 的「百度网盘文本读写 + 百度 OAuth 登录」骨架,**砍掉 Google Drive / 存储抽象 / better-auth**,**加一层客户端 E2E 加密**——内容在浏览器用用户手持的主密钥加密成密文,服务端和百度网盘只经手密文。
- 完成的可观测信号:
  - 浏览器抓包 `/api/files` 上传/下载体,以及百度网盘 `/apps/Keyper/` 里的文件,**内容全是密文**(无明文可读)。
  - 主密钥在任何网络请求、服务端日志、DB 里**都不出现**(只在浏览器内存/会话)。
  - 用错口令解锁 → 校验失败、看不到明文;用对口令 → 解密还原、可编辑回存。
  - `pnpm -r typecheck` 全绿、`pnpm --filter @keyper/web build` 通过。

## 约束(推导依据)

- 存储后端只有百度网盘:第三方应用沙盒锁死在 `/apps/{应用名}/`(`workspace/keyper` 已验证),内容读写走 `precreate→superfile2(4MB 分片)→create` 上传、`filemetas dlink + UA:pan.baidu.com` 下载。
- 登录只有百度 OAuth:百度 uk 即用户身份,服务端按 uk 存 token(沿用 `storage_account` 表 + 自动 refresh 逻辑)。不需要 better-auth / 邮箱密码。
- E2E 定义:服务端**存** Baidu token(option 4),但**不持有**主密钥;加密/解密只在浏览器。所以服务端 API 经手的文件体必须是**不透明字节**,服务端只做百度 API 代理(token 在服务端,绕过百度 API 的浏览器跨域限制)。
- 现有代码事实(源 `workspace/keyper`,迁移基础):
  - `packages/baidupan` —— Baidu OAuth + 沙盒文件客户端,字节进字节出,**内容无关**,直接可承载密文。保留。
  - `packages/db` —— `storage_account(provider, account_key, access/refresh token, expires_at)` + `getStorageAccount/upsert/updateTokens`。保留(可简化为 baidu 单一 provider)。
  - `apps/web/src/lib/storage.ts` —— `getConnectedStorage/handleStorageLogin/handleStorageCallback`(state 防 CSRF、cookie=accountKey、过期前 60s 自动 refresh)。保留登录/回调/刷新,去掉多 provider 分发。
  - 砍掉:`packages/storage`(抽象层)、`packages/auth`(better-auth)、Google Drive adapter、多网盘选项卡 UI。

## 关键决策

- **加密放浏览器,服务端只代理字节**:选 client-side WebCrypto,不选服务端加密——因为 option 4 要求服务端/百度都看不到明文,服务端一旦能解密就不成立。API 路由收发 base64 密文 envelope,`@keyper/baidupan` 原样存取。
- **主密钥来源 = BIP39 助记词,固定 12 词 + 英文词表(对齐 MetaMask)**:选「生成满熵随机种子 → 编码成 12 词助记词,用户手持(抄写备份)→ 助记词派生 AES-256-GCM 密钥」,不选「用户自选口令派生」——口令熵低(几十 bit)挡不住离线暴破,助记词 12 词=128-bit 满强度且人类可抄写、可跨设备口述还原,精确匹配「用户自己手持 secret」。12 词/英文对齐 MetaMask 等主流钱包(用户认知 + 备份意愿),256-bit 留作未来需要再说。派生链:`mnemonic → BIP39 seed (PBKDF2-HMAC-SHA512) → HKDF-SHA256 → AES-256-GCM key`。库用 `@scure/bip39` + `@noble/hashes`(纯 JS、浏览器安全)。**偏离点**:不引入服务端任何密钥托管,词丢=数据不可恢复,这是 E2E 固有代价,接受;比口令多一次「强制备份确认」动作。
- **v1 只加密内容,文件名明文**:选内容加密,文件名保持用户可读(`note.txt`)——先跑通 E2E 主链路;**偏离主流密码管理器(连元数据都加密)**,因为迁移源是任意文件名的文本编辑器,全元数据加密需引入「加密清单(manifest)」间接层,留作 v2。**风险**:文件名会泄露(对密码库是弱点),在 proposal 显式标注,v2 用加密 manifest 收口。
- **去掉 better-auth + Postgres 依赖评估**:登录只剩百度,better-auth 整包删除。`storage_account` 仍需持久化 token → 保留 `packages/db` + Postgres。
- **加密为独立包 `@keyper/crypto`**:纯浏览器 WebCrypto 封装(派生/加密/解密/envelope 编解码),无 DOM、可单测;与解锁 UI 同属「保险库」模块,放同一份 plan 实施。

## 未决 / 信息不足

- 可选 BIP39 passphrase(第 25 词):默认不加。若想要「助记词 + 一个只记在脑子里的口令」双因子,可作为可选项加上(进一步抗助记词被偷看)。
- 文件名是否必须加密(决定要不要 v1 就上 manifest):默认 v1 不加密文件名。若这是密码/密钥保管(名字本身敏感),需提前确认是否 v1 即上加密 manifest。

## Plans 拆分

| 编号 | 标题 | 路径 | 依赖 | 状态 |
|---|---|---|---|---|
| 001 | 迁移百度存储 + 登录骨架(去多网盘/抽象/better-auth) | `plans/001-baidu-storage-foundation.done.md` | - | 已完成 |
| 002 | 端到端加密 + 保险库编辑器(@keyper/crypto + 解锁/加解密 UI) | `plans/002-e2e-encrypted-vault.done.md` | 001 | 已完成 |
