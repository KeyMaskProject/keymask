"use client";

// 登录后右上角的用户菜单:头像 + 名称,下拉里可退出登录。
// 退出走已有的 POST /api/auth/logout(清会话 cookie 后重定向回首页)。
import { useRef, useState } from "react";
import { ChevronDown, KeyRound, Lock, LogOut, TimerReset, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@keysark/ui";
import { useT } from "./providers";
import type { StorageProvider } from "@/lib/storage";
import { AnalyticsEvent, trackEvent } from "@/lib/analytics";

function Avatar({ name, avatar, size = 28 }: { name: string; avatar: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase();
  if (avatar && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatar}
        alt={name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
      style={{ width: size, height: size }}
    >
      {initial ? (
        <span className="text-xs font-semibold">{initial}</span>
      ) : (
        <User className="h-4 w-4" />
      )}
    </span>
  );
}

export function UserMenu({
  name,
  avatar,
  provider,
  onLock,
  onChangePassword,
  onAutoLock,
}: {
  name: string;
  avatar: string | null;
  /** 当前登录的存储后端,决定「已连接 xx」与无名用户兜底文案。 */
  provider: StorageProvider;
  /** 已解锁工作台时传入:在菜单里提供「锁定保险库」。 */
  onLock?: () => void;
  /** 已解锁工作台时传入:打开「修改密码」弹窗(需输当前密码;无「移除密码」)。 */
  onChangePassword?: () => void;
  /** 已解锁工作台时传入:打开「自动锁定时长」设置弹窗。 */
  onAutoLock?: () => void;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const storeName = t(provider === "google" ? "provider_google" : "provider_baidu");
  const displayName = name.trim() || t("user_fallback", storeName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-1 pr-2.5 shadow-sm transition-colors hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <Avatar name={displayName} avatar={avatar} />
          <span className="max-w-[9rem] truncate text-sm font-medium">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
          <Avatar name={displayName} avatar={avatar} size={32} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{displayName}</span>
            <span className="truncate text-xs font-normal text-[var(--color-muted-foreground)]">
              {t("account_connected", storeName)}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onLock ? (
          <DropdownMenuItem onSelect={() => onLock()}>
            <Lock className="h-4 w-4" />
            {t("btn_lock")}
          </DropdownMenuItem>
        ) : null}
        {onChangePassword ? (
          <DropdownMenuItem onSelect={() => onChangePassword()}>
            <KeyRound className="h-4 w-4" />
            {t("pw_change_title")}
          </DropdownMenuItem>
        ) : null}
        {onAutoLock ? (
          <DropdownMenuItem onSelect={() => onAutoLock()}>
            <TimerReset className="h-4 w-4" />
            {t("autolock_title")}
          </DropdownMenuItem>
        ) : null}
        <form ref={formRef} action="/api/auth/logout" method="post">
          <DropdownMenuItem
            destructive
            onSelect={(e) => {
              e.preventDefault();
              trackEvent(AnalyticsEvent.SignOut, { provider });
              formRef.current?.requestSubmit();
            }}
          >
            <LogOut className="h-4 w-4" />
            {t("sign_out")}
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
