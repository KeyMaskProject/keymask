# 支持文件加密上传

> Created: 2026-06-09

## 结论

- 一句话方案:给保险库条目增加「文件」类型——文件密文走**新的二进制流式端点**(octet-stream,绕过现有 base64+JSON 管道),作为**独立 artifact `items/<id>.bin`** 存储;条目元信息(文件名、MIME、大小)仍存 `items/<id>.json`。文本条目完全不变。
- 完成的可观测信号:在 vault-panel 选择一个 ≤100MB 的文件 → 浏览器内 AES-256-GCM 加密 → 上网盘只见密文 → 刷新后该条目可下载还原出**逐字节相同**的原文件;服务端日志/请求体中不出现明文与文件名以外的内容。

## 约束(推导依据)

- 单文件上限 **100MB**(用户确认)。100MB 明文 + 密文可同时容纳进浏览器内存,故加密**一次性**做,无需分片加密。
- 现有 `apps/web/src/app/api/files/route.ts:26-30` 的 POST 用 `request.json()` 把整个 `contentB64` 读进内存再 JSON 解析:100MB 文件经 base64(133MB 字符串)+ JSON parse,内存与 CPU ~3x 放大。→ 必须新增 raw-bytes 端点。
- 现有信封 `packages/crypto/src/index.ts:79-107` 把密文 base64 塞进 JSON(`Envelope.ct`):对 100MB 文件 +33% 体积且强制全字符串处理。→ 文件密文需**二进制信封**(magic+version+12B IV 前缀 + 原始密文字节),不走 JSON。
- 加密/存储底层已字节无关:`encrypt(key, Uint8Array)`/`decrypt` (`crypto/src/index.ts:56-77`)、`StorageTransport.upload(path, bytes: Uint8Array)`/`download(): Uint8Array` (`vault/src/types.ts:87-94`)、baidupan(4MB 分片)与 googledrive(multipart)均已接收 `Uint8Array`。→ 文件天然可复用,改动集中在数据模型 + UI + 一个新端点。
- `EntryDoc.content: string` 写死文本 (`vault/src/types.ts:36-43`);`Vault.save` 经 `JSON.stringify`+`encryptToEnvelope` (`vault/src/vault.ts:175-177`)。→ 模型与 save 需扩展区分文本/文件。
- `StorageTransport` 无 delete 原语 (`vault/src/vault.ts:206-207`):文本条目删除留 ~1KB 孤儿可忍;**100MB 文件孤儿不可回收是真实存储成本**。→ 本提案一并加 `delete` 原语,`Vault.remove` 真正清除 `.bin` 与 `.json`。

## 关键决策

- **分离 artifact,不内嵌**:文件密文存独立 `items/<id>.bin`,不塞进 `EntryDoc.content`。内嵌会双重 base64(文件→content 的 b64,再被 JSON 信封 b64 一次)≈1.77x 膨胀,且 133MB 字符串 stringify/parse 在浏览器爆内存。
- **二进制信封,不走 JSON**:文件密文用 `magic(4B)+ver(1B)+iv(12B)+ct` 的裸字节帧,而非现有 `{iv,ct:base64}` JSON 信封——省 33% 体积、零字符串中转。文本条目继续用旧 JSON 信封(兼容历史数据)。
- **新增 octet-stream 端点,不复用 `/api/files`**:大文件走 `request.arrayBuffer()` 直传 `client.upload`,避开 base64+JSON。文本/index 小文件继续用现有 JSON 端点。
- **加密不分片**:100MB 单次 AES-GCM。偏离「大文件必分片流式」的主流做法——因为上限 100MB 下整文件可驻内存,分片(每片独立 IV + 帧管理)是 ≥1GB 才需要的复杂度,这里不引入。
- **一并加 `delete` 原语**:偏离「先摘 index 留孤儿」的现状——因为 100MB 文件孤儿成本远高于文本,且 delete 对文本删除是免费的正向收益。

## 未决 / 信息不足

- 文件条目预览:是否需要图片/PDF 的浏览器内预览,还是仅「下载」按钮即可?(影响 UI 工作量;默认按仅下载实现,可后续加预览)
- 同一条目能否文本与文件并存(如带附件的笔记),还是「一个条目要么文本要么文件」二选一?(默认按二选一实现,模型上 `kind: "text" | "file"`)

## Plans 拆分

| 编号 | 标题 | 路径 | 依赖 | 状态 |
|---|---|---|---|---|
| 001 | crypto 二进制信封 + vault 文件条目数据契约 + delete 原语 | `plans/001-vault-file-data-contract.done.md` | - | 已完成 |
| 002 | apps/web 二进制传输端点 + 文件上传/下载 UI | `plans/002-web-file-upload-ui.done.md` | 001 | 已完成 |
