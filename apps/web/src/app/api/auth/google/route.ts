import { handleGoogleLogin } from "@/lib/google";

export const runtime = "nodejs";

export async function GET() {
  return handleGoogleLogin();
}
