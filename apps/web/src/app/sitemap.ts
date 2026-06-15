import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/content/blog";
import { LANDING_PAGES } from "@/lib/content/landing-pages";
import { buildLanguageAlternates, localeHref } from "@/lib/i18n";
import { absUrl } from "@/lib/seo";

// 静态页的 lastmod:用最新一篇文章日期作为站点内容更新基线(无逐页 mtime 时的合理近似)。
const SITE_LASTMOD = POSTS.reduce((acc, p) => (p.date > acc ? p.date : acc), POSTS[0]?.date ?? "2026-01-01");

// 公开可索引的页面;每条带覆盖全部语言的 hreflang 备用链接 + lastmod。
const STATIC_PATHS = [
  "/",
  "/docs",
  "/about",
  "/privacy",
  "/blog",
  ...LANDING_PAGES.map((p) => `/${p.slug}`),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: { path: string; lastModified: string }[] = [
    ...STATIC_PATHS.map((path) => ({ path, lastModified: SITE_LASTMOD })),
    ...POSTS.map((p) => ({ path: `/blog/${p.slug}`, lastModified: p.date })),
  ];
  return entries.map(({ path, lastModified }) => {
    const langs = buildLanguageAlternates(path);
    return {
      url: absUrl(localeHref(path, "en")),
      lastModified,
      changeFrequency: "weekly",
      priority: path === "/" ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(Object.entries(langs).map(([k, v]) => [k, absUrl(v)])),
      },
    };
  });
}
