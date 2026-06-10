import { handleGoogleLogin } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleGoogleLogin(request);
}
