import { getStorageForRequest } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// 二进制文件中转:body / 响应体都是不透明 octet-stream 密文,绕开 /api/files 的 base64+JSON。
// 用于大文件(≤100MB)上传下载,省 33% base64 体积 + JSON 全字符串内存峰值。内容由客户端加密,服务端不解读。

// 上传/覆盖:?path= 相对路径,body 为 application/octet-stream 原始密文字节。
export async function POST(request: Request) {
  const conn = await getStorageForRequest(request);
  if (!conn) return Response.json({ error: "not_connected" }, { status: 401 });

  const path = (new URL(request.url).searchParams.get("path") ?? "").trim();
  if (!path) return Response.json({ error: "path_required" }, { status: 400 });

  try {
    const bytes = new Uint8Array(await request.arrayBuffer());
    await conn.client.upload(path, bytes);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("blob upload failed", err);
    return Response.json({ error: "upload_failed", message: String(err) }, { status: 502 });
  }
}

// 下载:?fileId= 文件 id,直接以 octet-stream 返回原始密文字节(非 JSON 包 base64)。
export async function GET(request: Request) {
  const conn = await getStorageForRequest(request);
  if (!conn) return Response.json({ error: "not_connected" }, { status: 401 });

  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) return Response.json({ error: "fileId_required" }, { status: 400 });

  try {
    const bytes = await conn.client.download(fileId);
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (err) {
    console.error("blob download failed", err);
    return Response.json({ error: "download_failed", message: String(err) }, { status: 502 });
  }
}
