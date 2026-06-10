import { NextResponse } from "next/server";
import { revokeCliTokenByHash } from "@keysark/db";
import { sha256Hex } from "@/lib/cli-auth";

export const runtime = "nodejs";

// CLI 主动吊销自己的令牌(disconnect)。以令牌本身为凭据,幂等。
export async function DELETE(request: Request) {
  const token = request.headers.get("x-keysark-token");
  if (!token || !token.startsWith("ksk_")) {
    return NextResponse.json({ error: "token_required" }, { status: 400 });
  }
  try {
    await revokeCliTokenByHash(sha256Hex(token));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("cli token revoke failed", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
