import { createHash } from "node:crypto";
import {
  appRoot,
  resolveAppPath,
  type BaiduPanConfig,
} from "./config";
import type {
  FileMeta,
  ListResult,
  PanFile,
  QuotaInfo,
  Rtype,
  UploadResult,
  UserInfo,
} from "./types";

const XPAN_FILE = "https://pan.baidu.com/rest/2.0/xpan/file";
const XPAN_MULTIMEDIA = "https://pan.baidu.com/rest/2.0/xpan/multimedia";
const XPAN_NAS = "https://pan.baidu.com/rest/2.0/xpan/nas";
const QUOTA_URL = "https://pan.baidu.com/api/quota";
const SUPERFILE2 = "https://d.pcs.baidu.com/rest/2.0/pcs/superfile2";

/** 本地分片大小,百度要求 4MB。最后一片为剩余字节。 */
const CHUNK_SIZE = 4 * 1024 * 1024;

function md5hex(data: Uint8Array): string {
  return createHash("md5").update(data).digest("hex");
}

interface ErrnoResponse {
  errno?: number;
  errmsg?: string;
}

function assertOk(body: ErrnoResponse, context: string): void {
  if (body.errno !== undefined && body.errno !== 0) {
    throw new Error(
      `baidu pan ${context} failed: errno=${body.errno}${
        body.errmsg ? ` ${body.errmsg}` : ""
      }`,
    );
  }
}

/**
 * 百度网盘客户端 (沙盒模式)。所有路径方法接收「沙盒内相对路径」,内部解析为
 * /apps/{appDirName}/... 绝对路径并强制锁在沙盒里。需要一个有效的 access_token。
 */
export class BaiduPanClient {
  constructor(
    private readonly accessToken: string,
    private readonly config: BaiduPanConfig,
  ) {}

  /** 沙盒根目录,如 /apps/Keyper */
  get root(): string {
    return appRoot(this.config);
  }

  private async getJson<T extends ErrnoResponse>(
    base: string,
    method: string,
    params: Record<string, string>,
    context: string,
  ): Promise<T> {
    const query = new URLSearchParams({
      method,
      access_token: this.accessToken,
      ...params,
    });
    const res = await fetch(`${base}?${query.toString()}`);
    const body = (await res.json()) as T;
    assertOk(body, context);
    return body;
  }

  private async postForm<T extends ErrnoResponse>(
    base: string,
    method: string,
    form: Record<string, string>,
    context: string,
  ): Promise<T> {
    const query = new URLSearchParams({
      method,
      access_token: this.accessToken,
    });
    const res = await fetch(`${base}?${query.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const body = (await res.json()) as T;
    assertOk(body, context);
    return body;
  }

  // ---- 用户信息 ----------------------------------------------------------

  async userInfo(): Promise<UserInfo> {
    return this.getJson<UserInfo & ErrnoResponse>(
      XPAN_NAS,
      "uinfo",
      {},
      "uinfo",
    );
  }

  async quota(): Promise<QuotaInfo> {
    const query = new URLSearchParams({
      access_token: this.accessToken,
      checkfree: "1",
      checkexpire: "1",
    });
    const res = await fetch(`${QUOTA_URL}?${query.toString()}`);
    const body = (await res.json()) as QuotaInfo & ErrnoResponse;
    assertOk(body, "quota");
    return body;
  }

  // ---- 读 ---------------------------------------------------------------

  /** 列出沙盒内某个目录 (相对路径,"" = 沙盒根)。 */
  async list(
    relDir = "",
    options: { order?: "name" | "time" | "size"; desc?: boolean; limit?: number } = {},
  ): Promise<PanFile[]> {
    const params: Record<string, string> = {
      dir: resolveAppPath(this.config, relDir),
    };
    if (options.order) params.order = options.order;
    if (options.desc) params.desc = "1";
    if (options.limit) params.limit = String(options.limit);
    const body = await this.getJson<ListResult & ErrnoResponse>(
      XPAN_FILE,
      "list",
      params,
      "list",
    );
    return body.list;
  }

  /** 按关键字搜索沙盒内文件。 */
  async search(key: string, relDir = ""): Promise<PanFile[]> {
    const body = await this.getJson<ListResult & ErrnoResponse>(
      XPAN_FILE,
      "search",
      {
        key,
        dir: resolveAppPath(this.config, relDir),
        recursion: "1",
      },
      "search",
    );
    return body.list;
  }

  /** 取文件详情 (可含下载直链 dlink)。fsids 来自 list/search 的 fs_id。 */
  async fileMetas(fsids: number[], options: { dlink?: boolean } = {}): Promise<FileMeta[]> {
    const body = await this.getJson<{ list: FileMeta[] } & ErrnoResponse>(
      XPAN_MULTIMEDIA,
      "filemetas",
      {
        fsids: JSON.stringify(fsids),
        dlink: options.dlink ? "1" : "0",
      },
      "filemetas",
    );
    return body.list;
  }

  /** 下载沙盒内文件,返回字节。dlink 下载强制要求 UA=pan.baidu.com 且拼 access_token。 */
  async download(fsid: number): Promise<Uint8Array> {
    const metas = await this.fileMetas([fsid], { dlink: true });
    const meta = metas[0];
    if (!meta?.dlink) throw new Error(`no dlink for fs_id ${fsid}`);
    const res = await fetch(`${meta.dlink}&access_token=${this.accessToken}`, {
      headers: { "User-Agent": "pan.baidu.com" },
    });
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  // ---- 写 ---------------------------------------------------------------

  /** 在沙盒内创建目录。 */
  async mkdir(relPath: string): Promise<PanFile> {
    return this.postForm<PanFile & ErrnoResponse>(
      XPAN_FILE,
      "create",
      {
        path: resolveAppPath(this.config, relPath),
        isdir: "1",
        rtype: "0",
      },
      "mkdir",
    );
  }

  /**
   * 上传文件到沙盒。三步: precreate → superfile2 分片 → create。
   * @param relPath 沙盒内目标路径,如 "backups/2026.json"
   * @param data    文件内容
   * @param rtype   命名/覆盖策略,默认 3 (覆盖)
   */
  async upload(relPath: string, data: Uint8Array, rtype: Rtype = 3): Promise<UploadResult> {
    const path = resolveAppPath(this.config, relPath);
    const size = data.byteLength;

    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < size; offset += CHUNK_SIZE) {
      chunks.push(data.subarray(offset, Math.min(offset + CHUNK_SIZE, size)));
    }
    if (chunks.length === 0) chunks.push(new Uint8Array(0)); // 空文件也要一个空分片
    const blockList = chunks.map(md5hex);

    // Step 1: precreate
    const pre = await this.postForm<{ uploadid?: string } & ErrnoResponse>(
      XPAN_FILE,
      "precreate",
      {
        path,
        size: String(size),
        isdir: "0",
        autoinit: "1",
        rtype: String(rtype),
        block_list: JSON.stringify(blockList),
      },
      "precreate",
    );
    const uploadid = pre.uploadid;
    if (!uploadid) throw new Error("precreate returned no uploadid");

    // Step 2: superfile2 逐片上传
    for (let i = 0; i < chunks.length; i++) {
      const query = new URLSearchParams({
        method: "upload",
        access_token: this.accessToken,
        type: "tmpfile",
        path,
        uploadid,
        partseq: String(i),
      });
      const chunk = chunks[i]!;
      const part = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      ) as ArrayBuffer;
      const form = new FormData();
      form.append("file", new Blob([part]), "chunk");
      const res = await fetch(`${SUPERFILE2}?${query.toString()}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`superfile2 chunk ${i} failed: HTTP ${res.status}`);
      const body = (await res.json()) as ErrnoResponse;
      assertOk(body, `superfile2 chunk ${i}`);
    }

    // Step 3: create 合并
    return this.postForm<UploadResult & ErrnoResponse>(
      XPAN_FILE,
      "create",
      {
        path,
        size: String(size),
        isdir: "0",
        rtype: String(rtype),
        uploadid,
        block_list: JSON.stringify(blockList),
      },
      "create",
    );
  }

  // ---- 管理 (copy / move / rename / delete) ------------------------------

  async copy(relPath: string, relDestDir: string, newName?: string): Promise<void> {
    await this.fileManager("copy", [
      {
        path: resolveAppPath(this.config, relPath),
        dest: resolveAppPath(this.config, relDestDir),
        newname: newName ?? basename(relPath),
      },
    ]);
  }

  async move(relPath: string, relDestDir: string, newName?: string): Promise<void> {
    await this.fileManager("move", [
      {
        path: resolveAppPath(this.config, relPath),
        dest: resolveAppPath(this.config, relDestDir),
        newname: newName ?? basename(relPath),
      },
    ]);
  }

  async rename(relPath: string, newName: string): Promise<void> {
    await this.fileManager("rename", [
      { path: resolveAppPath(this.config, relPath), newname: newName },
    ]);
  }

  async remove(relPaths: string[]): Promise<void> {
    await this.fileManager(
      "delete",
      relPaths.map((p) => resolveAppPath(this.config, p)),
    );
  }

  private async fileManager(
    opera: "copy" | "move" | "rename" | "delete",
    filelist: unknown[],
  ): Promise<void> {
    const query = new URLSearchParams({
      method: "filemanager",
      access_token: this.accessToken,
      opera,
    });
    const res = await fetch(`${XPAN_FILE}?${query.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        async: "0",
        filelist: JSON.stringify(filelist),
        ondup: "overwrite",
      }).toString(),
    });
    const body = (await res.json()) as ErrnoResponse;
    assertOk(body, `filemanager:${opera}`);
  }
}

function basename(p: string): string {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] ?? p;
}
