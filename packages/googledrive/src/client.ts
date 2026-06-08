import { fetchUserInfo, type GoogleUserInfo } from "./oauth";

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
// appData 模式的根:应用专属隐藏文件夹。folder 模式的根:My Drive 真实根目录别名。
const APPDATA = "appDataFolder";
const MYDRIVE_ROOT = "root";

export interface DriveFile {
  /** Drive 文件 id(下载用) */
  id: string;
  /** 文件名(目录内 basename) */
  name: string;
  /** 字节大小 */
  size: number;
}

/**
 * 存储位置模式:
 * - appdata:写入应用专属隐藏文件夹 appDataFolder(scope drive.appdata),用户在 Drive 里看不到。
 * - folder :写入 My Drive 根目录下一个可见文件夹(scope drive.file),folderName 为其名字(如 "KeysArk")。
 */
export interface DriveOptions {
  mode: "appdata" | "folder";
  /** folder 模式必填:根下可见文件夹名 */
  folderName?: string;
  /** 跨请求复用的目录/文件 id 缓存(由调用方按账号持有);不传则每个实例自建,仅实例内有效。 */
  cache?: DriveCache;
}

/**
 * 跨请求/跨实例共享的解析缓存:目录与文件的相对路径 → Drive id。
 * 服务端每个 HTTP 请求都新建一个 GoogleDriveClient,若缓存只在实例内,
 * 每次保存都要重新 files.list 走一遍目录树(慢)。把它按账号持有可消除重复解析。
 * inflight 用于并发去重:同一路径同时被多次解析(如并行上传)只发一次请求,避免重复建目录。
 */
export interface DriveCache {
  folders: Map<string, string>; // relPath("" = 存储根) → folderId
  files: Map<string, string>; // relPath → fileId
  inflight: Map<string, Promise<string | null>>; // 解析中的目录路径
}

export function newDriveCache(): DriveCache {
  return { folders: new Map(), files: new Map(), inflight: new Map() };
}

interface RawFile {
  id: string;
  name: string;
  size?: string;
  mimeType?: string;
}
interface ListResponse {
  files?: RawFile[];
}

function escapeQ(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Google Drive 客户端。所有路径方法接收「相对路径」,内部解析为存储根下的文件夹层级。
 * 内容无关(字节进字节出)。存储根由 DriveOptions 决定:
 * appdata = 隐藏沙盒 appDataFolder;folder = My Drive 根下可见文件夹。
 */
export class GoogleDriveClient {
  private readonly mode: "appdata" | "folder";
  private readonly folderName: string;
  // Drive files.list 的 spaces 参数:appData 模式限定 appDataFolder,folder 模式用默认 drive。
  private readonly spaces: string;
  // 相对路径 → id 缓存(可跨请求共享);folders[""] = 存储根。
  private readonly folderCache: Map<string, string>;
  private readonly fileCache: Map<string, string>;
  private readonly inflight: Map<string, Promise<string | null>>;

  constructor(
    private readonly accessToken: string,
    opts: DriveOptions = { mode: "appdata" },
  ) {
    this.mode = opts.mode;
    this.folderName = (opts.folderName ?? "").replace(/^\/+|\/+$/g, "").trim();
    this.spaces = this.mode === "appdata" ? APPDATA : "drive";
    if (this.mode === "folder" && !this.folderName) {
      throw new Error("google drive folder mode requires a folderName");
    }
    const cache = opts.cache ?? newDriveCache();
    this.folderCache = cache.folders;
    this.fileCache = cache.files;
    this.inflight = cache.inflight;
    if (this.mode === "appdata") this.folderCache.set("", APPDATA);
  }

  /** 展示用根标签:appData 模式为 "appDataFolder",folder 模式为 "/<folderName>"。 */
  get displayRoot(): string {
    return this.mode === "appdata" ? APPDATA : `/${this.folderName}`;
  }

  private get authHeader(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async userInfo(): Promise<GoogleUserInfo> {
    return fetchUserInfo(this.accessToken);
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers: this.authHeader });
    if (!res.ok) {
      throw new Error(`google drive ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  /** 查某父目录下、指定名字的子项(文件或文件夹)。返回首个匹配。 */
  private async findChild(
    parentId: string,
    name: string,
    opts: { folder?: boolean } = {},
  ): Promise<RawFile | null> {
    const clauses = [
      `'${parentId}' in parents`,
      `name = '${escapeQ(name)}'`,
      "trashed = false",
    ];
    if (opts.folder) clauses.push(`mimeType = '${FOLDER_MIME}'`);
    const params = new URLSearchParams({
      q: clauses.join(" and "),
      spaces: this.spaces,
      fields: "files(id,name,size,mimeType)",
      pageSize: "10",
    });
    const body = await this.getJson<ListResponse>(`${DRIVE_FILES}?${params.toString()}`);
    return body.files?.[0] ?? null;
  }

  private async createFolder(parentId: string, name: string): Promise<string> {
    const res = await fetch(`${DRIVE_FILES}?fields=id`, {
      method: "POST",
      headers: { ...this.authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    if (!res.ok) throw new Error(`google drive mkdir ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  /**
   * 缓存 + 并发去重地解析一个目录路径。命中 folderCache 直接返回;
   * 否则在 inflight 里登记一次解析,后续(本请求或并发请求)共享同一 promise,避免重复 list/建目录。
   */
  private resolvePath(
    path: string,
    resolve: () => Promise<string | null>,
  ): Promise<string | null> {
    const cached = this.folderCache.get(path);
    if (cached) return Promise.resolve(cached);
    const inflight = this.inflight.get(path);
    if (inflight) return inflight;
    const p = resolve()
      .then((id) => {
        if (id) this.folderCache.set(path, id); // 只缓存成功结果
        return id;
      })
      .finally(() => this.inflight.delete(path));
    this.inflight.set(path, p);
    return p;
  }

  /** 解析存储根的 folderId。appdata 恒为 appDataFolder;folder 模式按需在 My Drive 根下创建可见文件夹。 */
  private rootId(create: boolean): Promise<string | null> {
    if (this.mode === "appdata") return Promise.resolve(APPDATA);
    return this.resolvePath("", async () => {
      const existing = await this.findChild(MYDRIVE_ROOT, this.folderName, { folder: true });
      // 注:drive.file scope 只能看到本应用创建的文件;用户手动建的同名文件夹这里看不到,会另建一个。
      if (existing) return existing.id;
      return create ? await this.createFolder(MYDRIVE_ROOT, this.folderName) : null;
    });
  }

  /** 解析相对目录路径为 folderId。create=true 时按需创建缺失的层级。 */
  private async resolveFolder(dir: string, create: boolean): Promise<string | null> {
    const clean = dir.replace(/^\/+|\/+$/g, "").trim();
    const root = await this.rootId(create);
    if (!root) return null;
    if (!clean) return root;

    let parentId = root;
    let path = "";
    for (const segment of clean.split("/")) {
      if (!segment) continue;
      path = path ? `${path}/${segment}` : segment;
      const here = parentId;
      const folderId = await this.resolvePath(path, async () => {
        const existing = await this.findChild(here, segment, { folder: true });
        if (existing) return existing.id;
        return create ? await this.createFolder(here, segment) : null;
      });
      if (!folderId) return null;
      parentId = folderId;
    }
    return parentId;
  }

  /** 列出某相对目录下的文件(不含子文件夹)。目录不存在则返回空。 */
  async list(relDir = ""): Promise<DriveFile[]> {
    const folderId = await this.resolveFolder(relDir, false);
    if (!folderId) return [];
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
      spaces: this.spaces,
      fields: "files(id,name,size)",
      pageSize: "1000",
    });
    const body = await this.getJson<ListResponse>(`${DRIVE_FILES}?${params.toString()}`);
    return (body.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size ? Number(f.size) : 0,
    }));
  }

  /** 更新已有文件内容(media PATCH)。返回结果,404 交由调用方判断「文件已不在」回退新建。 */
  private async patchMedia(
    fileId: string,
    data: Uint8Array,
  ): Promise<{ ok: boolean; status: number }> {
    const res = await fetch(`${DRIVE_UPLOAD}/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { ...this.authHeader, "Content-Type": "application/octet-stream" },
      body: data as unknown as BodyInit,
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`google drive update ${res.status}: ${await res.text()}`);
    }
    return { ok: res.ok, status: res.status };
  }

  /** 新建文件(multipart/related:元数据 + 内容),返回新文件 id。 */
  private async createFile(folderId: string, name: string, data: Uint8Array): Promise<string> {
    const boundary = `keysark-${Date.now()}`;
    const meta = JSON.stringify({ name, parents: [folderId] });
    const enc = new TextEncoder();
    const head = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
        `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    );
    const tail = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + data.length + tail.length);
    body.set(head, 0);
    body.set(data, head.length);
    body.set(tail, head.length + data.length);

    const res = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { ...this.authHeader, "Content-Type": `multipart/related; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    });
    if (!res.ok) throw new Error(`google drive create ${res.status}: ${await res.text()}`);
    const out = (await res.json()) as { id: string };
    return out.id;
  }

  /**
   * 上传/覆盖文件到相对路径(目录按需创建)。
   * 热路径(更新已有条目/index)走 fileCache 直接 PATCH,省掉一次 findChild list;
   * 缓存未命中或文件已不在(404)再回退 findChild → 更新/新建,并回填缓存。
   */
  async upload(relPath: string, data: Uint8Array): Promise<void> {
    const clean = relPath.replace(/^\/+/, "").trim();
    const slash = clean.lastIndexOf("/");
    const dir = slash >= 0 ? clean.slice(0, slash) : "";
    const name = slash >= 0 ? clean.slice(slash + 1) : clean;
    if (!name) throw new Error(`invalid upload path: ${relPath}`);

    const folderId = await this.resolveFolder(dir, true);
    if (!folderId) throw new Error(`cannot resolve folder: ${dir}`);

    // 已知 fileId(更新热路径)→ 直接 PATCH。404 说明文件已不在,清缓存回退。
    const cachedId = this.fileCache.get(clean);
    if (cachedId) {
      const res = await this.patchMedia(cachedId, data);
      if (res.ok) return;
      this.fileCache.delete(clean);
    }

    const existing = await this.findChild(folderId, name);
    if (existing) {
      this.fileCache.set(clean, existing.id);
      const res = await this.patchMedia(existing.id, data);
      if (res.ok) return;
      // 极少见:findChild 命中后文件又被删 → 清缓存,落到新建。
      this.fileCache.delete(clean);
    }

    const id = await this.createFile(folderId, name, data);
    this.fileCache.set(clean, id);
  }

  /** 解析相对路径对应的文件,返回其 id 与 webViewLink(用于「在 Drive 中打开」)。不存在返回 null。 */
  async locate(relPath: string): Promise<{ id: string; webViewLink: string | null } | null> {
    const clean = relPath.replace(/^\/+/, "").trim();
    const slash = clean.lastIndexOf("/");
    const dir = slash >= 0 ? clean.slice(0, slash) : "";
    const name = slash >= 0 ? clean.slice(slash + 1) : clean;
    const folderId = await this.resolveFolder(dir, false);
    if (!folderId) return null;
    const child = await this.findChild(folderId, name);
    if (!child) return null;
    const meta = await this.getJson<{ id: string; webViewLink?: string }>(
      `${DRIVE_FILES}/${child.id}?fields=id,webViewLink`,
    );
    return { id: meta.id, webViewLink: meta.webViewLink ?? null };
  }

  /** 按 Drive 文件 id 下载原始字节。 */
  async download(fileId: string): Promise<Uint8Array> {
    const res = await fetch(`${DRIVE_FILES}/${fileId}?alt=media`, {
      headers: this.authHeader,
    });
    if (!res.ok) throw new Error(`google drive download ${res.status}: ${await res.text()}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}
