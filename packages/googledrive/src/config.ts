// Google OAuth + Drive 凭据。全部从环境变量读取(单一来源:根 .env.local)。
export interface GoogleConfig {
  /** OAuth client_id,形如 xxxx.apps.googleusercontent.com */
  clientId: string;
  /** OAuth client_secret。严禁泄露 / 提交。 */
  clientSecret: string;
  /** OAuth 回调地址,必须与 Google Cloud 控制台登记的一致 */
  redirectUri: string;
  /**
   * 可选:My Drive 根目录下的可见文件夹名(如 "KeysArk")。
   * 设置 → 文件写入该可见文件夹,scope 用 drive.file。
   * 留空 → 写入隐藏的 appDataFolder,scope 用 drive.appdata(默认)。
   */
  driveFolder: string;
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

export function loadGoogleConfig(): GoogleConfig {
  return {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: required("GOOGLE_REDIRECT_URI"),
    driveFolder: (process.env.GOOGLE_DRIVE_FOLDER ?? "").trim(),
  };
}
