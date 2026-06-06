import type { BaiduPanConfig } from "./config";

const AUTHORIZE_URL = "https://openapi.baidu.com/oauth/2.0/authorize";
const TOKEN_URL = "https://openapi.baidu.com/oauth/2.0/token";

// netdisk 文件读写所需的 scope。basic 拿用户基本信息,netdisk 拿网盘 (沙盒) 文件能力。
export const DEFAULT_SCOPE = "basic,netdisk";

export interface TokenResponse {
  /** 调用网盘 API 的凭据,有效期约 30 天 (expiresIn 秒) */
  accessToken: string;
  /** 用于换新 access_token,有效期 10 年 */
  refreshToken: string;
  /** access_token 剩余有效秒数 */
  expiresIn: number;
  /** 用户实际授予的 scope */
  scope: string;
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/** Step 1: 构造授权页 URL,把用户重定向过去。state 用于防 CSRF。 */
export function buildAuthorizeUrl(
  config: BaiduPanConfig,
  options: { state?: string; scope?: string; force?: boolean } = {},
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.appKey,
    redirect_uri: config.redirectUri,
    scope: options.scope ?? DEFAULT_SCOPE,
    display: "page",
  });
  if (options.state) params.set("state", options.state);
  // force_login / confirm_login 不在此处;qrcode=1 可切二维码。需要每次都确认授权时:
  if (options.force) params.set("prompt", "consent");
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function normalizeToken(raw: RawTokenResponse): TokenResponse {
  if (raw.error || !raw.access_token || !raw.refresh_token) {
    throw new Error(
      `baidu oauth error: ${raw.error ?? "missing_token"}${
        raw.error_description ? ` - ${raw.error_description}` : ""
      }`,
    );
  }
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresIn: raw.expires_in ?? 0,
    scope: raw.scope ?? "",
  };
}

/** Step 2: 用回调拿到的 code 换 token。 */
export async function exchangeCodeForToken(
  config: BaiduPanConfig,
  code: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.appKey,
    client_secret: config.secretKey,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(`${TOKEN_URL}?${params.toString()}`);
  const raw = (await res.json()) as RawTokenResponse;
  return normalizeToken(raw);
}

/** access_token 过期时用 refresh_token 换新的。 */
export async function refreshAccessToken(
  config: BaiduPanConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.appKey,
    client_secret: config.secretKey,
  });
  const res = await fetch(`${TOKEN_URL}?${params.toString()}`);
  const raw = (await res.json()) as RawTokenResponse;
  return normalizeToken(raw);
}
