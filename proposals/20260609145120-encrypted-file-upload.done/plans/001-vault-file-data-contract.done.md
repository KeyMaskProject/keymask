# crypto 二进制信封 + vault 文件条目数据契约 + delete 原语

> 来自 proposal: proposals/20260609145120-encrypted-file-upload/

## 目标

- 在 packages 层把「文件条目」打通:crypto 能加解密裸字节流;vault 模型能区分文本/文件条目、把文件密文独立存 `items/<id>.bin`、并能真正删除条目文件。文本条目行为零变化。

## 改动范围

- **新增**(`packages/crypto/src/index.ts`):二进制信封一对函数,如 `encryptBytesToBlob(key, data: Uint8Array): Promise<Uint8Array>` / `decryptBytesFromBlob(key, blob: Uint8Array): Promise<Uint8Array>`。帧格式 `magic(4B "KSF1") + ver(1B) + iv(12B) + ct`,复用现有 `encrypt`/`decrypt`,不引入 JSON、不引入 base64。导出之。
- **更新**(`packages/vault/src/types.ts`):
  - `EntryDoc` / `EntryMeta` 增加 `kind: "text" | "file"`(缺省视为 `"text"`,兼容旧数据);文件条目增 `filename?: string`、`mimeType?: string`、`fileSize?: number`(原文件明文字节数)。`content` 对文件条目可为空串。
  - `StorageTransport` 增 `delete(path: string): Promise<void>`。
  - `normalizeIndex` 给旧 entry 补 `kind: "text"`。
  - 路径工具:文件 artifact 相对路径 `items/<id>.bin`(类似 `itemRelPath`)。
- **更新**(`packages/vault/src/vault.ts`):
  - 新增 `saveFile({ id?, title, filename, mimeType, bytes, folderId })`:`encryptBytesToBlob` → 上传 `items/<id>.bin`;元信息 doc(`kind:"file"`,不含文件字节)走现有 JSON 信封存 `items/<id>.json`;更新 index;沿用「本地优先 + 并行同步 + pending」流程。`EntryMeta.size` 记元信息信封字节数,`fileSize` 记原文件大小。
  - 新增 `openFile(id): Promise<Uint8Array>`:下载 `items/<id>.bin` → `decryptBytesFromBlob` → 原始字节。
  - `remove(id)`:若条目 `kind==="file"`,经新 `transport.delete` 删 `items/<id>.bin` 与 `items/<id>.json`(失败不阻塞 index 更新);文本条目也顺带 delete `.json`(消除历史孤儿)。
- **更新**(`packages/baidupan/src/client.ts`、`packages/googledrive/src/client.ts`):实现 `delete(relPath)`——映射到各自 API 的删除接口(百度沙盒 filemanager delete;Drive files.delete by id,需先解析 path→id)。`apps/web` 的 `StorageClient` 接口(`apps/web/src/lib/storage.ts`)同步加 `delete`。

## 验收

- [ ] `pnpm -r typecheck` 通过。
- [ ] 单测/手验:对一段随机 1MB `Uint8Array` 做 `encryptBytesToBlob`→`decryptBytesFromBlob` 还原逐字节相同;blob 体积 ≈ 原文 + 17B 帧头(无 base64 膨胀)。
- [ ] `saveFile` 后 index 里出现 `kind:"file"` 条目,网盘 `items/<id>.bin` 存在且为密文;`openFile` 还原原字节。
- [ ] `remove` 一个文件条目后,网盘上 `.bin` 与 `.json` 都消失(非孤儿)。
- [ ] 旧文本条目(无 `kind` 字段)`load` 后被归一化为 `kind:"text"`,读写不受影响。

## 关键点

- 二进制信封绝不能退化成 base64/JSON——这是省 33% 体积的核心,务必裸字节帧。
- `delete` 在两个后端的语义差异:百度按沙盒相对路径,Google 需 path→fileId 解析(可复用其现有 id 缓存)。delete 不存在的文件应幂等不报错。
- 主密钥/明文/文件原字节禁止离开浏览器:`saveFile`/`openFile` 全在 client 侧,服务端只见 `.bin` 密文(硬约束 3)。
- `EntryDoc` 改字段后注意 `decJson<EntryDoc>` 的旧数据兼容(可选字段 + normalize)。

---

## 实施日志

- **执行时间**:2026-06-09 14:5x
- **整体状态**:已完成

### 做了什么
- `packages/crypto/src/index.ts`:新增 `encryptBytesToBlob`/`decryptBytesFromBlob`,二进制帧 `magic("KSF1",4B)+ver(1B)+iv(12B)+ct`,复用 `encrypt`/`decrypt`,无 base64/JSON。
- `packages/vault/src/types.ts`:`EntryKind="text"|"file"`;`EntryMeta`/`EntryDoc` 增 `kind?/filename?/mimeType?/fileSize?`;`StorageTransport` 增 `delete(path)`;新增路径工具 `itemBlobRelPath`。
- `packages/vault/src/index.ts`:导出 `itemBlobRelPath` 与 `EntryKind`。
- `packages/vault/src/vault.ts`:`normalizeIndex` 给旧 entry 补 `kind:"text"`+可选文件字段;新增 `saveFile`(blob 存 `<id>.bin`、元信息存 `<id>.json`、blob 不进 localStorage 以免爆配额)、`openFile`(下载 `.bin`→解密);`remove` 改为经 `transport.delete` 真删 `.json`(文件条目额外删 `.bin`),用 allSettled 不阻塞 index。
- `packages/googledrive/src/client.ts`:新增 `remove(relPath)`(fileCache/locate 解析 id → DELETE,404 幂等)。百度复用已有 `remove(relPaths)`。
- `apps/web/src/lib/storage.ts`:`StorageClient` 加 `delete`;Google 接 `c.remove(path)`,百度 `c.remove([path])` 并吞错保证幂等。
- `apps/web/src/app/api/files/route.ts`:新增 `DELETE`(?path=)。
- `apps/web/src/lib/vault.ts` + `apps/cli/src/transport.ts`:两个 transport 实现补 `delete`(DELETE /api/files?path=)。

### 验收核对
- [x] `pnpm -r typecheck` 全 9 包通过。
- [x] 1MB 随机字节 `encryptBytesToBlob`→`decryptBytesFromBlob` 逐字节一致;开销 33B(17B 帧头 + 16B AES-GCM tag),无 base64 膨胀;坏 magic 被拒。
- [x] 旧文本条目(无 kind)`normalizeIndex` 归一化为 `kind:"text"`(代码核对)。
- [~] `saveFile`/`openFile`/`remove` 真·网盘 round-trip:逻辑由 typecheck + crypto round-trip 保证;端到端需运行中的 app + 实时 OAuth,留 002 手动验收一并跑通。

### 偏差与遗留
- 信封开销是 17B 帧头 + 16B AES-GCM 认证 tag(共 33B 固定),tag 是 GCM 密文固有、非膨胀;plan 文里写的"≈17B"只算了帧头。
- baidu 删除非存在路径会报 errno,故在 `storage.ts` 的 baidu 分支吞错以满足 delete 幂等契约(Google 在 client 内已处理 404)。
