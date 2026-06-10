import { NextResponse } from "next/server";
import {
  approveCliAuthRequest,
  denyCliAuthRequest,
  getCliAuthRequestByUserCode,
} from "@keysark/db";
import { normalizeUserCode } from "@/lib/cli-auth";
import { getConnectedStorage } from "@/lib/storage";

export const runtime = "nodejs";

// 网页授权页的确认/拒绝(表单 POST)。必须有已登录的会话 cookie ——
// 批准即把 CLI 绑定到当前登录的存储账号。完成后跳回 /cli-auth 展示结果。
// CSRF:会话 cookie 均为 SameSite=Lax,跨站表单 POST 不携带 → 天然拒绝。
export async function POST(request: Request) {
  const form = await request.formData();
  const code = normalizeUserCode(String(form.get("code") ?? ""));
  const action = String(form.get("action") ?? "");
  const url = new URL(request.url);
  const back = (result: string) =>
    NextResponse.redirect(
      new URL(`/cli-auth?code=${encodeURIComponent(code ?? "")}&result=${result}`, url.origin),
      { status: 303 },
    );

  if (!code) return back("invalid");

  const conn = await getConnectedStorage();
  if (!conn) return back("login_required");

  try {
    const req = await getCliAuthRequestByUserCode(code);
    if (!req || req.status !== "pending") return back("invalid");

    if (action === "deny") {
      await denyCliAuthRequest(req.id);
      return back("denied");
    }
    const ok = await approveCliAuthRequest(req.id, conn.provider, conn.accountKey);
    return back(ok ? "approved" : "invalid");
  } catch (err) {
    console.error("cli approve failed", err);
    return back("error");
  }
}
