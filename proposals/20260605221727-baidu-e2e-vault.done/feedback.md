# Feedback

执行 proposal 期间冒出的、未在当前会话处理的事项。收尾后由用户决定要不要新开 proposal / plan 处理。

---

## [plans/002] 真实端到端手测未跑(headless 无法完成)

- **类型**:范围外发现 / 验证缺口
- **位置**:整链 浏览器 → 百度授权 → 保存 → 网盘 → 刷新重解锁
- **描述**:核心加密逻辑已 headless 跑通(deriveKey/encrypt/decrypt/verifier 全断言通过),登录/字节往返路由已编译通过;但「真实浏览器登录 + 网盘真实读写」需用户点一次百度授权,我无法代做。
- **建议**:用户起 `pnpm dev`,浏览器走一遍:连接百度 → 创建保险库(抄助记词)→ 保存一条 → 去网盘看 `/apps/Keyper/` 文件确为密文 → 刷新重输助记词还原。

## [plans/002] 文件名与 .keyper.json 明文(v1 既定弱点)

- **类型**:设计调整
- **位置**:`apps/web/src/components/vault-panel.tsx`、网盘 `/apps/Keyper/`
- **描述**:v1 只加密内容,文件名明文;`.keyper.json` 元数据文件名亦明文。保存已挡覆盖 `.keyper.json`,但未挡用户删除它(删了=verifier 丢失,需重建库)。
- **建议**:v2 引入「加密 manifest」:网盘只存随机 id 命名的密文文件 + 一个加密索引(id→真实文件名),彻底不泄露元数据;并对 `.keyper.json` 做删除保护/多副本。

## [plans/002] 可选 BIP39 第 25 词口令(双因子)未实现

- **类型**:范围外 / proposal 未决项
- **描述**:proposal「未决」里列的「助记词 + 脑记口令」双因子默认未加。
- **建议**:如需进一步抗助记词被偷看,`deriveKey(mnemonic, passphrase?)` 加可选 passphrase 透传给 `mnemonicToSeed`,UI 加一个可选口令框。

## [plans/001] 服务端 storage_account 明文存 refresh_token

- **类型**:范围外发现 / 安全
- **位置**:`packages/db` `storage_account` 表
- **描述**:option 4 是「服务端存 token + 内容 E2E 加密」,内容已 E2E;但百度 refresh_token(10 年)在 DB 仍明文,属服务端侧 liability(与内容明文无关,但仍是泄露面)。
- **建议**:上线前用服务端密钥(KMS / env secret)对 DB 里的 token 列做对称加密;并重置已泄露的百度 SecretKey。
