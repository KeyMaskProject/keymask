import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";
import { JsonLd } from "@/components/json-ld";
import { providerFlags, storageLabel } from "@/lib/providers";
import {
  buildLanguageAlternates,
  htmlLang,
  localeHref,
  translate,
  THEME_COOKIE,
  type MsgKey,
  type Theme,
} from "@/lib/i18n";
import { organizationLd, websiteLd, SITE_URL } from "@/lib/seo";
import { getServerLocale } from "@/lib/locale-server";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// SITE_URL 统一来自 @/lib/seo(含生产期未配置告警),用于把 OG / favicon / canonical 解析成绝对 URL。
const OG_BANNER = "/keysark-og-banner.png";

const ICONS: Metadata["icons"] = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/keysark-favicon.svg", type: "image/svg+xml" },
    { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
  ],
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
};

// 元信息随语言变化(标题/描述/OG locale),并声明 hreflang 备用链接,利于多语言 SEO。
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = (key: MsgKey, ...args: unknown[]) => translate(locale, key, ...args);
  const store = storageLabel(providerFlags(), {
    google: t("store_google"),
    baidu: t("store_baidu"),
  });
  const title = t("meta_title");
  const description = t("meta_description", store);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: t("meta_keywords"),
    applicationName: "KeysArk",
    manifest: "/site.webmanifest",
    icons: ICONS,
    // 站点根级 hreflang(覆盖全部语言),与各页面级 alternates 自洽。
    alternates: { languages: buildLanguageAlternates("/") },
    // Google Search Console 站点验证(HTML 法);未配置环境变量则不输出该 meta。
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
    openGraph: {
      type: "website",
      siteName: "KeysArk",
      locale: htmlLang(locale),
      url: localeHref("/", locale),
      title,
      description,
      images: [{ url: OG_BANNER, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_BANNER],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#211D52",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getServerLocale();
  const themeRaw = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = themeRaw === "light" || themeRaw === "dark" ? themeRaw : "system";
  // light/dark → 给 <html> 加 class;system → 不加,交给 CSS 媒体查询。
  const themeClass = theme === "system" ? "" : theme;

  return (
    <html
      lang={htmlLang(locale)}
      className={`${inter.variable} ${themeClass}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {/* 站点级结构化数据:Organization + WebSite(全站一次) */}
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <Providers initialLocale={locale} initialTheme={theme}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
