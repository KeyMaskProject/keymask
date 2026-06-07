import { NextResponse } from "next/server";
import { getConnectedStorage } from "@/lib/storage";

export const runtime = "nodejs";

// 定位某相对路径文件在网盘里的位置(provider + 绝对路径 + 访问链接)。不涉及内容。
export async function GET(request: Request) {
  const conn = await getConnectedStorage();
  if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const path = new URL(request.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path_required" }, { status: 400 });

  try {
    const location = await conn.client.locate(path);
    return NextResponse.json(location);
  } catch (err) {
    console.error("locate failed", err);
    return NextResponse.json({ error: "locate_failed", message: String(err) }, { status: 502 });
  }
}
