import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  BaiduPanClient,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  loadConfig,
  refreshAccessToken,
} from "@keysark/baidupan";
import {
  getStorageAccount,
  newId,
  updateStorageTokens,
  upsertStorageAccount,
} from "@keysark/db";

// 登录后端只有百度;provider 列固定 baidu(沿用 storage_account 表)。
const PROVIDER = "baidu";
const STATE_COOKIE = "baidu_oauth_state";
export const UK_COOKIE = "baidu_uk";
const REFRESH_SKEW_MS = 60_000;

export interface ConnectedBaidu {
  client: BaiduPanClient;
  uk: string;
}

/** 取已连接的百度客户端,必要时刷新 token 并写回 DB。未连接返回 null。 */
export async function getConnectedBaidu(): Promise<ConnectedBaidu | null> {
  const uk = (await cookies()).get(UK_COOKIE)?.value;
  if (!uk) return null;

  const account = await getStorageAccount(PROVIDER, uk);
  if (!account) return null;

  const config = loadConfig();
  let accessToken = account.accessToken;
  if (account.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS) {
    const token = await refreshAccessToken(config, account.refreshToken);
    accessToken = token.accessToken;
    await updateStorageTokens(PROVIDER, uk, {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: new Date(Date.now() + token.expiresIn * 1000),
      scope: token.scope,
    });
  }

  return { client: new BaiduPanClient(accessToken, config), uk };
}

/** 发起百度授权: state 防 CSRF → 重定向授权页。 */
export async function handleLogin(): Promise<NextResponse> {
  const config = loadConfig();
  const state = newId();
  const res = NextResponse.redirect(buildAuthorizeUrl(config, { state }));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

/** 百度回调: 校验 state → 换 token → uinfo 取 uk → 落库 → 设会话 cookie。 */
export async function handleCallback(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const home = new URL("/", request.url);

  if (!code || !state || !expectedState || state !== expectedState) {
    home.searchParams.set("error", "oauth_state");
    return NextResponse.redirect(home);
  }

  const config = loadConfig();
  try {
    const token = await exchangeCodeForToken(config, code);
    const info = await new BaiduPanClient(token.accessToken, config).userInfo();
    const uk = String(info.uk);
    await upsertStorageAccount(PROVIDER, uk, {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: new Date(Date.now() + token.expiresIn * 1000),
      scope: token.scope,
    });
    const res = NextResponse.redirect(home);
    res.cookies.set(UK_COOKIE, uk, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("baidu callback failed", err);
    home.searchParams.set("error", "oauth_exchange");
    return NextResponse.redirect(home);
  }
}
