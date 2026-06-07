import { NextResponse } from "next/server";
import { UK_COOKIE } from "@/lib/baidu";
import { GOOGLE_UID_COOKIE } from "@/lib/google";

export const runtime = "nodejs";

// 登出: 清会话 cookie (DB 授权记录保留,下次登录复用)。两种后端都清。
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.delete(UK_COOKIE);
  res.cookies.delete(GOOGLE_UID_COOKIE);
  return res;
}
