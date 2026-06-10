import { handleLogin } from "@/lib/baidu";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleLogin(request);
}
