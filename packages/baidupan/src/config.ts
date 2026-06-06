// 百度网盘开放平台凭据 + 沙盒配置。全部从环境变量读取 (单一来源: 根 .env.local)。
export interface BaiduPanConfig {
  /** 应用数字 ID (AppID) */
  appId: string;
  /** OAuth client_id (AppKey / API Key) */
  appKey: string;
  /** OAuth client_secret (SecretKey)。严禁泄露 / 提交。 */
  secretKey: string;
  /** Signkey,部分签名场景使用 (可选) */
  signKey: string;
  /** OAuth 回调地址,必须与百度控制台登记的一致 */
  redirectUri: string;
  /**
   * 应用在网盘里的文件夹名 (= 控制台登记的应用名称)。
   * 沙盒根目录为 /apps/{appDirName},所有读写都被限制在此目录下。
   */
  appDirName: string;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

export function loadConfig(): BaiduPanConfig {
  return {
    appId: required("BAIDU_APP_ID"),
    appKey: required("BAIDU_APP_KEY"),
    secretKey: required("BAIDU_SECRET_KEY"),
    signKey: process.env.BAIDU_SIGN_KEY ?? "",
    redirectUri: required("BAIDU_REDIRECT_URI"),
    appDirName: required("BAIDU_APP_DIR_NAME"),
  };
}

/** 沙盒根目录,例如 /apps/Keyper */
export function appRoot(config: BaiduPanConfig): string {
  return `/apps/${config.appDirName}`;
}

/**
 * 把「用户在沙盒内指定的相对路径」解析成网盘绝对路径,并强制锁在沙盒内。
 * 传入 "" 或 "/" 得到沙盒根;任何试图越出沙盒 (..) 的路径会被拒绝。
 */
export function resolveAppPath(config: BaiduPanConfig, relPath: string): string {
  const root = appRoot(config);
  const cleaned = relPath.replace(/^\/+/, "").trim();
  if (cleaned === "") return root;
  const parts: string[] = [];
  for (const segment of cleaned.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      throw new Error(`path escapes app sandbox: ${relPath}`);
    }
    parts.push(segment);
  }
  return `${root}/${parts.join("/")}`;
}
