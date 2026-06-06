// 未登录落地页:营销 hero 风格 + 「连接百度网盘」CTA。
// 服务端组件,纯展示;登录入口是 /api/auth/login。
import { Button } from "@keysark/ui";
import { Logo, Wordmark } from "./brand";

const FEATURES = [
  {
    title: "端到端加密",
    body: "内容在你的浏览器里用 AES-256-GCM 加密后才离开设备。服务端与百度网盘只经手不透明密文,永远看不到明文。",
  },
  {
    title: "助记词即主密钥",
    body: "12 词 BIP39 助记词在本地派生密钥,对齐 MetaMask。助记词只属于你,绝不上传——丢失即无法恢复,也无人能替你解密。",
  },
  {
    title: "存在你的网盘",
    body: "密文保存在你自己的百度网盘 /apps/Keyper/ 沙盒目录。数据归属清晰,随时可迁移,不被平台绑架。",
  },
];

export function Landing({ error }: { error?: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* 顶栏 */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark className="text-lg" />
        <a href="/api/auth/login">
          <Button variant="outline" size="sm">
            连接百度网盘
          </Button>
        </a>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
          零知识 · 端到端加密
        </span>
        <h1 className="text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          你的秘密,
          <br />
          只有你能打开。
        </h1>
        <p className="mt-6 max-w-xl text-balance text-lg text-[var(--color-muted-foreground)]">
          KeysArk 是端到端加密的文本保管库。用一组助记词守护一切,
          密文存进你自己的百度网盘——除了你,没有人能读到里面的内容。
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <a href="/api/auth/login">
            <Button size="lg" className="px-8">
              连接百度网盘,免费开始
            </Button>
          </a>
          <a href="#how">
            <Button size="lg" variant="ghost">
              了解工作原理
            </Button>
          </a>
        </div>
        {error ? (
          <p className="mt-6 text-sm text-[var(--color-danger)]">
            {error === "oauth_state"
              ? "登录校验失败,请重试。"
              : error === "oauth_exchange"
                ? "授权交换失败,请重试。"
                : "登录出错,请重试。"}
          </p>
        ) : null}
      </section>

      {/* 三特性 */}
      <section id="how" className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-[calc(var(--radius)+0.25rem)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
            >
              <Logo className="h-7 w-7" />
              <h3 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 页脚 */}
      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 text-xs text-[var(--color-muted-foreground)]">
        <Wordmark className="text-sm font-medium" />
        <span>端到端加密 · 百度网盘为唯一存储后端</span>
      </footer>
    </div>
  );
}
