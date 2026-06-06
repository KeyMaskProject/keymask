import { handleLogin } from "@/lib/baidu";

export const runtime = "nodejs";

export async function GET() {
  return handleLogin();
}
