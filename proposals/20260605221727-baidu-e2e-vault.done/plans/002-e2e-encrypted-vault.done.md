# 端到端加密 + 保险库编辑器

> 来自 proposal: proposals/20260605221727-baidu-e2e-vault/

## 目标

- 在 001 的字节读写之上加客户端 E2E 加密:用户手持 BIP39 助记词 → 浏览器派生密钥 → 内容加密成密文上传、下载后浏览器解密。服务端/百度全程只见密文,助记词与密钥不离开浏览器。

## 改动范围

- **新增 `packages/crypto`(`@keyper/crypto`,纯浏览器,无 DOM/无 React,可单测)**:
  - 依赖 `@scure/bip39`(助记词生成/校验/词表)+ `@noble/hashes`(HKDF/PBKDF2);加解密用 WebCrypto `crypto.subtle`(AES-GCM)。不碰 `node:crypto`。
  - `generateMnemonic()`、`validateMnemonic(m)` —— BIP39,**固定 12 词 + 英文词表**(对齐 MetaMask)。
  - `deriveKey(mnemonic)` —— `mnemonicToSeed(PBKDF2-HMAC-SHA512) → HKDF-SHA256 → AES-256-GCM CryptoKey`。无需用户自管 salt(BIP39 自带派生 salt;HKDF salt 固定常量或随 vault 元数据存)。
  - `encrypt(key, plaintext: Uint8Array)` → `{iv, ct}`;`decrypt(key, iv, ct)` → `Uint8Array`。
  - envelope 编解码:`{ v:1, alg:"A256GCM", kdf:"BIP39+HKDF-SHA256", iv, ct }` ↔ JSON/base64,作为存上网盘的字节格式。
  - `makeVerifier(key)/checkVerifier(key, blob)` —— 助记词正确性校验:加密一个已知标记,解锁时验。
- **更新 `apps/web`**:
  - 首次设置流:点「创建保险库」→ `generateMnemonic` 展示 12 词 → **强制备份确认**(随机抽 2-3 个位置让用户回填)→ 派生密钥 → 写 vault 元数据(verifier)到网盘 `/apps/Keyper/.keyper.json`。
  - 解锁流:已存在 vault → 要求输入 12 词助记词 → `validateMnemonic` → 派生密钥 → 读元数据校验 verifier → 通过后密钥只放内存(可选 sessionStorage,绝不发服务端)。
  - 保存:编辑器明文 → `encrypt` → envelope → base64 → `POST /api/files`(复用 001 契约)。
  - 打开:`GET /api/files/content` 取 base64 密文 → envelope 解析 → `decrypt` → 明文填编辑器。
  - 锁定按钮:清内存密钥,回到解锁页。
- **更新文档**:`CLAUDE.md` 增加硬约束「主密钥/明文禁止出现在任何服务端代码、API、日志、DB;加密只在 `@keyper/crypto`/浏览器」。

## 验收

- [ ] 创建保险库(生成+备份助记词)后保存一条文本 → 百度 `/apps/Keyper/` 里该文件**字节为密文 envelope**(肉眼不可读明文)。
- [ ] 抓 `/api/files` 请求/响应体:全是 base64 密文;全链路无助记词/派生密钥/明文字段。
- [ ] 刷新页面 → 重新输助记词解锁 → 能解密还原并编辑回存。
- [ ] 换一套助记词(或输错一个词)→ `validateMnemonic` 拦或 verifier 校验失败、拒绝进入、看不到任何明文。
- [ ] grep 服务端代码 + DB:无助记词、无派生密钥、无明文内容落点。
- [ ] `pnpm -r typecheck` 全绿、`pnpm --filter @keyper/web build` 通过。

## 关键点

- **加密绝不上服务端**:`@keyper/crypto` 只能被客户端组件 import;API 路由只搬运 base64,严禁在服务端解密。这是本提案成立的根本,review 必须盯死。
- **助记词只进浏览器**:输入框 + 派生全在 client component;严禁把助记词放进任何请求体、URL、cookie、服务端日志。派生出的 key 也只在内存。
- **IV 每次随机(96-bit),绝不复用**:AES-GCM 复用 IV = 灾难性泄露。每次 encrypt 现生成。
- **解锁校验靠 verifier blob,不靠「解密报错」**:用独立的已知标记加密块判断助记词对错,给明确反馈,避免拿用户文件试解密。
- **首次必须强制备份确认**:助记词只展示一次的话用户会丢;生成后要求回填抽查词,确认抄写成功才建库。词丢=数据不可恢复,UI 要讲清楚。
- **换设备无需服务端存密钥**:同助记词在新设备重新派生即得同 key,拉到 `.keyper.json` 验 verifier 即可;BIP39 自带派生 salt,不依赖服务端。
- **明文文件名是已知泄露点**(见 proposal 关键决策):v1 接受;若启用加密 manifest 收口,是独立后续提案,不在本 plan。
- `@scure/bip39` + `@noble/hashes` 为纯 JS、浏览器安全;AES-GCM 用 `globalThis.crypto.subtle`。`@keyper/crypto` 不要 import `node:crypto`,保持纯浏览器以便被 client component 打包。

---

## 实施日志

- **执行时间**:2026-06-05 23:55
- **整体状态**:已完成(端到端逻辑验证通过;真实浏览器+网盘往返待手测)

### 做了什么
- 新增 `packages/crypto`(`@keyper/crypto`,纯浏览器,deps `@scure/bip39@2.2.0` + `@noble/hashes@2.2.0`):`generateMnemonic`(固定 12 词英文)/`validateMnemonic`/`deriveKey`(mnemonic→BIP39 seed→HKDF-SHA256→AES-256-GCM)/`encrypt`/`decrypt`/`encryptToEnvelope`/`decryptFromEnvelope`(`{v,alg,kdf,iv,ct}` base64)/`makeVerifier`/`checkVerifier`。IV 每次随机 96-bit。
- `apps/web`:加 `@keyper/crypto` 依赖 + transpilePackages;`page.tsx` 探测 `/apps/Keyper/.keyper.json` 判断保险库是否已初始化并下传 `metaFileId`;新增 client 组件 `vault-panel.tsx`:
  - 创建流:生成 12 词 → 展示 → 抽查 3 个词位备份确认 → 派生密钥 → `makeVerifier` 写 `.keyper.json`。
  - 解锁流:输 12 词 → `validateMnemonic` → 派生 → 拉 `.keyper.json` 验 verifier → 通过解锁,密钥仅存内存。
  - 已解锁:打开(下载密文→解密)、保存(加密→envelope→上传)、锁定(清密钥+整页刷新)。
- 删除 plan 001 的明文面板 `raw-file-panel.tsx`。

### 验收核对
- [x] 保存即加密:保存路径只上传 `encryptToEnvelope` 产出的密文 envelope 字节;smoke 测确认 envelope 为 JSON 密文、无明文。
- [x] `/api/files` 全程 base64 密文、无助记词/明文:API 仅经手 `contentB64`;grep `lib`/`api` 无 `mnemonic`/`deriveKey`/`@keyper/crypto`。
- [x] 输错助记词被拦:smoke 测 `validateMnemonic` 拒非法词、`checkVerifier` 拒错误密钥、错误密钥无法解密(AES-GCM 认证失败)。
- [x] 服务端/DB 无助记词、无派生密钥、无明文落点(grep 验证;crypto 仅 client 组件 import)。
- [x] `pnpm -r typecheck` 全绿(5 包)、`pnpm --filter @keyper/web build` 通过。
- [x] 核心加密链路 headless 跑通:`deriveKey/encryptToEnvelope/decryptFromEnvelope/makeVerifier/checkVerifier` 全部断言通过。
- [~] 真实「浏览器解锁 → 保存 → 网盘出现密文 → 刷新重解锁还原」整链:需用户在浏览器完成一次百度授权才能跑(外部依赖,非阻塞)。

### 偏差与遗留
- 密钥不持久化(不写 sessionStorage),刷新需重输助记词——符合 plan「可选 sessionStorage」里的保守选择,满足「刷新后重新解锁」验收。
- 文件名明文(v1 既定决策),`.keyper.json` 元数据文件名亦明文;保存时已挡住覆盖 `.keyper.json`,但未挡删除。详见 feedback。
