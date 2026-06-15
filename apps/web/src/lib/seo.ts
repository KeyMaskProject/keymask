// SEO 公共工具:统一站点 URL 解析 + JSON-LD 构造(Organization / WebSite / Article / BreadcrumbList)。
// 所有绝对 URL 都经 SITE_URL 解析,与 metadataBase 同源。
import { LOCALES, htmlLang, type Locale } from "./i18n";

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
// 生产构建未设站点 URL → canonical/OG/sitemap 会回退 localhost,污染线上链接。仅 warn,不阻断 dev。
if (!RAW_SITE_URL && process.env.NODE_ENV === "production") {
  console.warn(
    "[seo] NEXT_PUBLIC_SITE_URL is not set — canonical / OG / sitemap URLs fall back to localhost. " +
      "Set it to the production https origin before deploying.",
  );
}
export const SITE_URL = RAW_SITE_URL ?? "http://localhost:6134";

/** 应用路径 → 绝对 URL。 */
export function absUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}

const ORG_ID = `${SITE_URL}#organization`;
const WEBSITE_ID = `${SITE_URL}#website`;

/** 站点级 Organization(放根布局,全站一次)。 */
export function organizationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: "KeysArk",
    url: SITE_URL,
    logo: absUrl("/apple-touch-icon.png"),
  };
}

/** 站点级 WebSite(inLanguage 覆盖全部支持语言)。 */
export function websiteLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "KeysArk",
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
    inLanguage: LOCALES.map((l) => htmlLang(l)),
  };
}

/** 博客文章 Article。urlPath 为该语言下的应用路径(如 /zh/blog/slug)。 */
export function articleLd(input: {
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  locale: Locale;
  urlPath: string;
  imageUrl?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: htmlLang(input.locale),
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: absUrl(input.urlPath),
    image: input.imageUrl ?? absUrl("/keysark-og-banner.png"),
  };
}

/** FAQPage:问答必须与页面可见 FAQ 文本一致(Google 政策)。 */
export function faqLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** 面包屑:items 按层级顺序({name, path});path 为应用路径。 */
export function breadcrumbLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}
