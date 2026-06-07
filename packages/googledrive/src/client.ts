import { fetchUserInfo, type GoogleUserInfo } from "./oauth";

const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT = "appDataFolder";

export interface DriveFile {
  /** Drive 文件 id(下载用) */
  id: string;
  /** 文件名(目录内 basename) */
  name: string;
  /** 字节大小 */
  size: number;
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
 * Google Drive 客户端(appDataFolder 沙盒模式)。所有路径方法接收「相对路径」,
 * 内部解析为 appDataFolder 下的文件夹层级。只能读写应用专属隐藏文件夹,内容无关(字节进字节出)。
 */
export class GoogleDriveClient {
  // path → folderId 缓存(单实例内,避免重复解析目录树)
  private folderCache = new Map<string, string>([["", ROOT]]);

  constructor(private readonly accessToken: string) {}

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
      spaces: ROOT,
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

  /** 解析相对目录路径为 folderId。create=true 时按需创建缺失的层级。 */
  private async resolveFolder(dir: string, create: boolean): Promise<string | null> {
    const clean = dir.replace(/^\/+|\/+$/g, "").trim();
    const cached = this.folderCache.get(clean);
    if (cached) return cached;

    let parentId = ROOT;
    let path = "";
    for (const segment of clean.split("/")) {
      if (!segment) continue;
      path = path ? `${path}/${segment}` : segment;
      const hit = this.folderCache.get(path);
      if (hit) {
        parentId = hit;
        continue;
      }
      const existing = await this.findChild(parentId, segment, { folder: true });
      const folderId = existing ? existing.id : create ? await this.createFolder(parentId, segment) : null;
      if (!folderId) return null;
      this.folderCache.set(path, folderId);
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
      spaces: ROOT,
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

  /** 上传/覆盖文件到相对路径(目录按需创建)。同名文件存在则更新内容,否则新建。 */
  async upload(relPath: string, data: Uint8Array): Promise<void> {
    const clean = relPath.replace(/^\/+/, "").trim();
    const slash = clean.lastIndexOf("/");
    const dir = slash >= 0 ? clean.slice(0, slash) : "";
    const name = slash >= 0 ? clean.slice(slash + 1) : clean;
    if (!name) throw new Error(`invalid upload path: ${relPath}`);

    const folderId = await this.resolveFolder(dir, true);
    if (!folderId) throw new Error(`cannot resolve folder: ${dir}`);

    const existing = await this.findChild(folderId, name);
    if (existing) {
      // 更新已有文件内容(media)
      const res = await fetch(`${DRIVE_UPLOAD}/${existing.id}?uploadType=media`, {
        method: "PATCH",
        headers: { ...this.authHeader, "Content-Type": "application/octet-stream" },
        body: data as unknown as BodyInit,
      });
      if (!res.ok) throw new Error(`google drive update ${res.status}: ${await res.text()}`);
      return;
    }

    // 新建文件(multipart/related:元数据 + 内容)
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
