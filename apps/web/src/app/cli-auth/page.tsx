// CLI 设备码授权确认页(服务端组件)。
// 状态机:result 回显(approved/denied/error)→ 码无效/过期 → 未登录(引导登录后回跳)→ 待确认。
// 安全:批准动作走 /api/cli/device/approve 表单 POST,依赖 SameSite=Lax 会话 cookie 防 CSRF;
// 页面展示 user_code 让用户与终端肉眼核对,防「转发链接钓鱼授权」。
import { cookies } from "next/headers";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@keysark/ui";
import { getCliAuthRequestByUserCode } from "@keysark/db";
import { normalizeUserCode } from "@/lib/cli-auth";
import { translate, LOCALE_COOKIE, type Locale, type MsgKey } from "@/lib/i18n";
import { providerFlags } from "@/lib/providers";
import { getConnectedStorage } from "@/lib/storage";
import { testId } from "@/lib/test-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CliAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; result?: string }>;
}) {
  const { code: rawCode, result } = await searchParams;
  const locale = ((await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "en" : "zh") as Locale;
  const t = (key: MsgKey, ...args: unknown[]) => translate(locale, key, ...args);

  const code = normalizeUserCode(rawCode ?? "");

  // 终态回显(approve 路由 303 跳回带 result)。
  if (result === "approved" || result === "denied" || result === "error") {
    const msg =
      result === "approved"
        ? t("cli_auth_approved")
        : result === "denied"
          ? t("cli_auth_denied")
          : t("cli_auth_error");
    return (
      <Shell title={t("cli_auth_title")}>
        <p className="text-sm">{msg}</p>
      </Shell>
    );
  }

  // 码缺失 / 无效 / 过期 / 非 pending(已用过)。
  let pending = false;
  if (code) {
    try {
      const req = await getCliAuthRequestByUserCode(code);
      pending = req?.status === "pending";
    } catch (err) {
      console.error("cli-auth lookup failed", err);
    }
  }
  if (!code || !pending) {
    return (
      <Shell title={t("cli_auth_title")}>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t("cli_auth_invalid")}</p>
      </Shell>
    );
  }

  // 未登录 → 引导登录,?next= 回跳本页。
  const conn = await getConnectedStorage();
  if (!conn) {
    const next = encodeURIComponent(`/cli-auth?code=${encodeURIComponent(code)}`);
    const flags = providerFlags();
    return (
      <Shell title={t("cli_auth_title")} desc={t("cli_auth_desc")}>
        <p className="text-sm text-[var(--color-muted-foreground)]">{t("cli_auth_login_hint")}</p>
        <div {...testId("cli-auth-login-actions")} className="flex flex-col gap-2">
          {flags.google ? (
            <a href={`/api/auth/google?next=${next}`}>
              <Button size="lg" className="w-full">
                {t("nav_connect_google")}
              </Button>
            </a>
          ) : null}
          {flags.baidu ? (
            <a href={`/api/auth/login?next=${next}`}>
              <Button size="lg" variant={flags.google ? "outline" : "default"} className="w-full">
                {t("nav_connect")}
              </Button>
            </a>
          ) : null}
        </div>
      </Shell>
    );
  }

  // 已登录 + 待确认 → 核对码 + 授权/拒绝。
  return (
    <Shell title={t("cli_auth_title")} desc={t("cli_auth_desc")}>
      <p className="text-sm text-[var(--color-muted-foreground)]">{t("cli_auth_verify_hint")}</p>
      <div
        {...testId("cli-auth-code")}
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-4 text-center font-mono text-2xl font-semibold tracking-widest"
      >
        {code}
      </div>
      <form method="post" action="/api/cli/device/approve" className="flex flex-col gap-2">
        <input type="hidden" name="code" value={code} />
        <Button {...testId("cli-auth-approve")} type="submit" name="action" value="approve" size="lg">
          {t("cli_auth_approve")}
        </Button>
        <Button type="submit" name="action" value="deny" size="lg" variant="outline">
          {t("cli_auth_deny")}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      {...testId("cli-auth")}
      className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4"
    >
      <div className="w-full max-w-md">
        <Card {...testId("cli-auth-card")} className="w-full">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {desc ? <CardDescription>{desc}</CardDescription> : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
