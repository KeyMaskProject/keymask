import { handleCallback } from "@/lib/baidu";

export const runtime = "nodejs";

// 百度控制台登记的回调页 = /api/baidu/callback,保留此路径复用已生效登记。
export async function GET(request: Request) {
  return handleCallback(request);
}
