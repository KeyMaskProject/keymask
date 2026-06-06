// 网盘 API 返回的常见结构 (沙盒内文件)。
export interface PanFile {
  /** 文件唯一 id,filemetas / 下载需要 */
  fs_id: number;
  /** 绝对路径,如 /apps/keyper/foo.txt */
  path: string;
  /** 文件名 (server_filename) */
  server_filename: string;
  /** 0=文件 1=目录 */
  isdir: number;
  /** 字节大小 */
  size: number;
  /** 服务端创建时间 (秒) */
  server_ctime: number;
  /** 服务端修改时间 (秒) */
  server_mtime: number;
  /** 文件内容 md5 (大写,32 位;部分场景为占位) */
  md5?: string;
  category?: number;
}

export interface ListResult {
  list: PanFile[];
}

export interface FileMeta extends PanFile {
  /** 下载直链,有效期 8h;下载时需拼 &access_token= 且带 UA: pan.baidu.com */
  dlink?: string;
  thumbs?: Record<string, string>;
}

export interface UserInfo {
  baidu_name: string;
  netdisk_name: string;
  avatar_url: string;
  vip_type: number;
  uk: number;
}

export interface QuotaInfo {
  /** 总容量 (字节) */
  total: number;
  /** 已用 (字节) */
  used: number;
  /** 是否超限 */
  expire?: boolean;
}

/** 上传/覆盖策略: 1=路径冲突时重命名, 2=仅当 block_list 不同才重命名, 3=覆盖 */
export type Rtype = 1 | 2 | 3;

export interface UploadResult {
  fs_id: number;
  path: string;
  size: number;
  md5: string;
  server_filename: string;
}
