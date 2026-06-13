import { NextResponse } from "next/server";
import { downloadByPath, getStorageForRequest } from "@/lib/storage";

export const runtime = "nodejs";

// 下载文件原始字节,base64 返回(不透明,客户端解密)。
// ?path= 沙盒相对路径,服务端在受信 app 根内解析为 provider fileId(不接受裸 fileId)。
export async function GET(request: Request) {
  const conn = await getStorageForRequest(request);
  if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const path = new URL(request.url).searchParams.get("path");
  try {
    const r = await downloadByPath(conn, path);
    if (r.status === "bad_path") return NextResponse.json({ error: "path_required" }, { status: 400 });
    if (r.status === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ contentB64: Buffer.from(r.bytes).toString("base64") });
  } catch (err) {
    console.error("download failed", err);
    return NextResponse.json({ error: "download_failed", message: String(err) }, { status: 502 });
  }
}
