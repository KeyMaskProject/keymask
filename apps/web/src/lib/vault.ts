// 本地优先的保险库数据层(纯客户端)。支持多保险库:每个库的数据在各自子目录 dir 下。
//
// 模型(以某个保险库的 dir 为基准,dir="" 表示历史单库在沙盒根):
//   - <dir>/index.json       ← 加密信封,明文为 { v, entries: EntryMeta[] },做检索。
//   - <dir>/items/<uuidv7>.json ← 每条条目一个文件,加密信封,明文为 EntryDoc。
//   - keysark.json(沙盒根)  ← 保险库注册表(明文元数据 + 密文校验块),见 @/lib/registry。
//
// 写入流程:先加密落本地缓存(localStorage,密文存储),再同步到网盘。
// 网盘同步失败不影响本地副本,失败项标记 pending,可手动重试同步。
//
// E2E:主密钥只在内存;落本地/上网盘的都是不透明密文信封。
import { newId } from "@keysark/db/id";
import { decryptFromEnvelope, encryptToEnvelope } from "@keysark/crypto";

export const INDEX_NAME = "index.json";
export const ITEMS_DIR = "items";

/** 拼接沙盒内相对路径;base="" 时直接返回 name(历史单库在根目录)。 */
function joinPath(base: string, name: string): string {
  return base ? `${base}/${name}` : name;
}

/** 某条目在存储后端里的相对路径(dir 为保险库数据目录,""=根)。用于展示网盘位置。 */
export function itemRelPath(dir: string, id: string): string {
  return joinPath(joinPath(dir, ITEMS_DIR), `${id}.json`);
}

/** 文件夹:靠 parentId 串成无限嵌套的树;只存在于 index 里(无独立文件)。 */
export interface FolderMeta {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}
export interface EntryMeta {
  id: string;
  title: string;
  folderId: string | null; // null = 根目录
  tags: string[];
  createdAt: number;
  updatedAt: number;
  size: number;
}
export interface IndexDoc {
  v: number;
  entries: EntryMeta[];
  folders: FolderMeta[];
}
export interface EntryDoc {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

function emptyIndex(): IndexDoc {
  return { v: 2, entries: [], folders: [] };
}

/** 归一化(兼容旧 v1:补 folders/folderId/tags 默认值)。 */
function normalizeIndex(raw: unknown): IndexDoc {
  const r = (raw ?? {}) as Partial<IndexDoc>;
  const folders: FolderMeta[] = Array.isArray(r.folders)
    ? r.folders.filter((f): f is FolderMeta => !!f && typeof f.id === "string")
    : [];
  const entries: EntryMeta[] = Array.isArray(r.entries)
    ? r.entries.map((e) => ({
        id: e.id,
        title: e.title ?? "",
        folderId: e.folderId ?? null,
        tags: Array.isArray(e.tags) ? e.tags : [],
        createdAt: e.createdAt ?? 0,
        updatedAt: e.updatedAt ?? 0,
        size: e.size ?? 0,
      }))
    : [];
  return { v: 2, entries, folders };
}

// ---------- base64 ----------
function b64encode(u: Uint8Array): string {
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// ---------- 本地缓存(密文信封,base64;按保险库分命名空间) ----------
const NS_PREFIX = "keysark.vault.v1";

interface CacheShape {
  index: string | null;
  entries: Record<string, string>;
  pending: string[]; // 待同步条目 id
  indexPending: boolean;
}

function emptyCache(): CacheShape {
  return { index: null, entries: {}, pending: [], indexPending: false };
}

/** 为某个保险库(按 id)建一份独立的本地缓存,避免多库之间串扰。 */
function makeLocalCache(vaultId: string) {
  const ns = `${NS_PREFIX}::${vaultId}`;
  function readCache(): CacheShape {
    if (typeof window === "undefined") return emptyCache();
    try {
      const raw = window.localStorage.getItem(ns);
      if (!raw) return emptyCache();
      return { ...emptyCache(), ...(JSON.parse(raw) as Partial<CacheShape>) };
    } catch {
      return emptyCache();
    }
  }
  function writeCache(c: CacheShape): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ns, JSON.stringify(c));
    } catch {
      /* 配额/隐私模式:本地缓存只是镜像,忽略写失败 */
    }
  }
  return {
    raw: readCache,
    getIndex(): string | null {
      return readCache().index;
    },
    setIndex(b64: string, pending: boolean): void {
      const c = readCache();
      c.index = b64;
      c.indexPending = pending;
      writeCache(c);
    },
    getEntry(id: string): string | null {
      return readCache().entries[id] ?? null;
    },
    setEntry(id: string, b64: string, pending: boolean): void {
      const c = readCache();
      c.entries[id] = b64;
      if (pending && !c.pending.includes(id)) c.pending.push(id);
      if (!pending) c.pending = c.pending.filter((x) => x !== id);
      writeCache(c);
    },
    clearPending(id: string): void {
      const c = readCache();
      c.pending = c.pending.filter((x) => x !== id);
      writeCache(c);
    },
    clearIndexPending(): void {
      const c = readCache();
      c.indexPending = false;
      writeCache(c);
    },
    pendingCount(): number {
      const c = readCache();
      return c.pending.length + (c.indexPending ? 1 : 0);
    },
  };
}

type LocalCache = ReturnType<typeof makeLocalCache>;

// ---------- 服务端文件 API(只搬运密文) ----------
async function listFiles(dir = ""): Promise<Map<string, { id: string; size: number }>> {
  const res = await fetch(`/api/files?dir=${encodeURIComponent(dir)}`);
  if (!res.ok) throw new Error(`list HTTP ${res.status}`);
  const data = (await res.json()) as { files: { id: string; name: string; size: number }[] };
  const m = new Map<string, { id: string; size: number }>();
  for (const f of data.files) m.set(f.name, { id: f.id, size: f.size });
  return m;
}
async function uploadFile(path: string, bytes: Uint8Array): Promise<void> {
  const res = await fetch("/api/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, contentB64: b64encode(bytes) }),
  });
  const data = (await res.json()) as { ok?: boolean; message?: string };
  if (!res.ok || !data.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
}
async function downloadById(fileId: string): Promise<Uint8Array> {
  const res = await fetch(`/api/files/content?fileId=${encodeURIComponent(fileId)}`);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const data = (await res.json()) as { contentB64: string };
  return b64decode(data.contentB64);
}

// ---------- 加解密 JSON ----------
async function encJson(key: CryptoKey, obj: unknown): Promise<Uint8Array> {
  return encryptToEnvelope(key, JSON.stringify(obj));
}
async function decJson<T>(key: CryptoKey, bytes: Uint8Array): Promise<T> {
  return JSON.parse(await decryptFromEnvelope(key, bytes)) as T;
}

function sortEntries(entries: EntryMeta[]): EntryMeta[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export class Vault {
  private fileMap = new Map<string, { id: string; size: number }>();
  private index: IndexDoc = emptyIndex();
  private readonly dir: string;
  private readonly cache: LocalCache;

  /** @param opts.id 保险库 id(本地缓存命名空间);opts.dir 数据目录,""=沙盒根(历史单库)。 */
  constructor(
    private readonly key: CryptoKey,
    opts: { id: string; dir: string },
  ) {
    this.dir = opts.dir;
    this.cache = makeLocalCache(opts.id);
  }

  private indexPath(): string {
    return joinPath(this.dir, INDEX_NAME);
  }
  private itemsDir(): string {
    return joinPath(this.dir, ITEMS_DIR);
  }
  private itemPath(id: string): string {
    return joinPath(this.itemsDir(), `${id}.json`);
  }

  get entries(): EntryMeta[] {
    return sortEntries(this.index.entries);
  }
  pendingCount(): number {
    return this.cache.pendingCount();
  }

  /** 解锁后加载:以网盘 index.json 为准,失败则回退本地缓存。 */
  async load(): Promise<EntryMeta[]> {
    try {
      this.fileMap = await listFiles(this.dir);
      const idxFile = this.fileMap.get(INDEX_NAME);
      if (idxFile) {
        const bytes = await downloadById(idxFile.id);
        this.index = normalizeIndex(await decJson<unknown>(this.key, bytes));
        this.cache.setIndex(b64encode(bytes), false);
        return this.entries;
      }
    } catch {
      // 网盘不可达 → 用本地缓存(离线可读)
      const cached = this.cache.getIndex();
      if (cached) {
        try {
          this.index = normalizeIndex(await decJson<unknown>(this.key, b64decode(cached)));
        } catch {
          this.index = emptyIndex();
        }
      }
      return this.entries;
    }
    this.index = emptyIndex();
    return this.entries;
  }

  /** 打开条目:本地优先,未命中再回网盘。 */
  async open(id: string): Promise<EntryDoc> {
    const cached = this.cache.getEntry(id);
    if (cached) {
      try {
        return await decJson<EntryDoc>(this.key, b64decode(cached));
      } catch {
        /* 本地损坏 → 回网盘 */
      }
    }
    const itemsMap = await listFiles(this.itemsDir());
    const f = itemsMap.get(`${id}.json`);
    if (!f) throw new Error("entry not found on netdisk");
    const bytes = await downloadById(f.id);
    this.cache.setEntry(id, b64encode(bytes), false);
    return decJson<EntryDoc>(this.key, bytes);
  }

  /**
   * 新建或更新条目。先加密落本地(乐观提交),再同步网盘(条目 + index)。
   * 同步失败不回滚本地副本,返回 synced=false + 错误,失败项保持 pending。
   */
  async save(input: {
    id?: string | null;
    title: string;
    content: string;
    folderId?: string | null;
    tags?: string[];
  }): Promise<{
    id: string;
    entries: EntryMeta[];
    synced: boolean;
    syncError?: string;
  }> {
    const now = Date.now();
    const id = input.id ?? newId();
    const existing = this.index.entries.find((e) => e.id === id);
    const createdAt = existing?.createdAt ?? now;
    const folderId = input.folderId ?? null;
    const tags = (input.tags ?? []).map((s) => s.trim()).filter(Boolean);
    const doc: EntryDoc = {
      id,
      title: input.title,
      content: input.content,
      folderId,
      tags,
      createdAt,
      updatedAt: now,
    };

    const entryEnvelope = await encJson(this.key, doc);
    const meta: EntryMeta = {
      id,
      title: input.title,
      folderId,
      tags,
      createdAt,
      updatedAt: now,
      size: entryEnvelope.byteLength,
    };
    if (existing) Object.assign(existing, meta);
    else this.index.entries.push(meta);
    const indexEnvelope = await encJson(this.key, this.index);

    // 1) 本地优先(标 pending)
    this.cache.setEntry(id, b64encode(entryEnvelope), true);
    this.cache.setIndex(b64encode(indexEnvelope), true);

    // 2) 同步网盘
    try {
      await uploadFile(this.itemPath(id), entryEnvelope);
      this.cache.clearPending(id);
      await uploadFile(this.indexPath(), indexEnvelope);
      this.cache.clearIndexPending();
    } catch (err) {
      return { id, entries: this.entries, synced: false, syncError: String(err) };
    }

    return { id, entries: this.entries, synced: true };
  }

  // ---------- 文件夹(仅改 index;本地优先 + 同步) ----------
  get folders(): FolderMeta[] {
    return [...this.index.folders];
  }

  private async persistIndex(): Promise<{ synced: boolean; syncError?: string }> {
    const env = await encJson(this.key, this.index);
    this.cache.setIndex(b64encode(env), true);
    try {
      await uploadFile(this.indexPath(), env);
      this.cache.clearIndexPending();
      return { synced: true };
    } catch (err) {
      return { synced: false, syncError: String(err) };
    }
  }

  async addFolder(
    name: string,
    parentId: string | null,
  ): Promise<{ id: string; folders: FolderMeta[]; synced: boolean; syncError?: string }> {
    const id = newId();
    this.index.folders.push({ id, name: name.trim(), parentId, createdAt: Date.now() });
    const res = await this.persistIndex();
    return { id, folders: this.folders, ...res };
  }

  async renameFolder(
    id: string,
    name: string,
  ): Promise<{ folders: FolderMeta[]; synced: boolean; syncError?: string }> {
    const f = this.index.folders.find((x) => x.id === id);
    if (f) f.name = name.trim();
    const res = await this.persistIndex();
    return { folders: this.folders, ...res };
  }

  /** 删除文件夹:其子文件夹与条目都上移到被删文件夹的父级(不丢数据)。 */
  async deleteFolder(id: string): Promise<{
    folders: FolderMeta[];
    entries: EntryMeta[];
    synced: boolean;
    syncError?: string;
  }> {
    const target = this.index.folders.find((x) => x.id === id);
    const parentId = target?.parentId ?? null;
    for (const f of this.index.folders) if (f.parentId === id) f.parentId = parentId;
    for (const e of this.index.entries) if (e.folderId === id) e.folderId = parentId;
    this.index.folders = this.index.folders.filter((x) => x.id !== id);
    const res = await this.persistIndex();
    return { folders: this.folders, entries: this.entries, ...res };
  }

  /** 手动重试:把本地 pending 的条目与 index 重新推送到网盘。 */
  async sync(): Promise<{ remaining: number }> {
    const c = this.cache.raw();
    for (const id of [...c.pending]) {
      const env = this.cache.getEntry(id);
      if (!env) {
        this.cache.clearPending(id);
        continue;
      }
      await uploadFile(this.itemPath(id), b64decode(env));
      this.cache.clearPending(id);
    }
    if (this.cache.raw().indexPending) {
      const idx = this.cache.getIndex();
      if (idx) {
        await uploadFile(this.indexPath(), b64decode(idx));
        this.cache.clearIndexPending();
      }
    }
    return { remaining: this.cache.pendingCount() };
  }
}
