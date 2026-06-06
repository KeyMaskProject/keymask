// KeysArk 原创品牌标识:盾形「方舟」+ 钥匙孔,寓意把密钥稳妥载于方舟之内。
// 纯几何 SVG,跟随 currentColor;不使用任何第三方品牌素材。

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M16 2.5 26 6.2v8.3c0 6.6-4.2 11.6-10 13.9C10.2 26.1 6 21.1 6 14.5V6.2L16 2.5Z"
        className="fill-[var(--color-primary)]"
      />
      <circle cx="16" cy="13" r="3.1" className="fill-[var(--color-primary-foreground)]" />
      <rect
        x="14.7"
        y="13"
        width="2.6"
        height="6.6"
        rx="1.3"
        className="fill-[var(--color-primary-foreground)]"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className ?? ""}`}>
      <Logo className="h-6 w-6" />
      <span>
        Keys<span className="text-[var(--color-primary)]">Ark</span>
      </span>
    </span>
  );
}
