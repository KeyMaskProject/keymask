// 登录后回跳:登录入口把 ?next=(仅限站内路径)暂存 cookie,OAuth 回调成功后跳回。
// 防开放重定向:只接受以单个 "/" 开头的路径。
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const RETURN_TO_COOKIE = "keysark_return_to";

/** 登录入口:暂存合法的 ?next= 到短命 cookie。 */
export function stashReturnTo(request: Request, res: NextResponse): void {
  const next = new URL(request.url).searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    res.cookies.set(RETURN_TO_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
}

/** 回调成功侧:取出暂存路径(无则 "/"),调用方负责在响应上删 cookie。 */
export async function readReturnTo(): Promise<string> {
  const v = (await cookies()).get(RETURN_TO_COOKIE)?.value;
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}
