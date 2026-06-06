import { NextResponse } from "next/server";
import { UK_COOKIE } from "@/lib/baidu";

export const runtime = "nodejs";

// 登出: 清会话 cookie (DB 授权记录保留,下次登录复用)。
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/", request.url));
  res.cookies.delete(UK_COOKIE);
  return res;
}
