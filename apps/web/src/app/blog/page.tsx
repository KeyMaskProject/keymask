import type { Metadata } from "next";
import { ContentShell } from "@/components/content-shell";
import { JsonLd } from "@/components/json-ld";
import { formatPostDate, getPostContent, POSTS } from "@/lib/content/blog";
import { buildLanguageAlternates, localeHref, translate } from "@/lib/i18n";
import { breadcrumbLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/locale-server";
import { testId } from "@/lib/test-id";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return {
    title: `${t("blog_title")} — KeysArk`,
    description: t("blog_subtitle"),
    alternates: {
      canonical: localeHref("/blog", locale),
      languages: buildLanguageAlternates("/blog"),
    },
  };
}

export default async function BlogIndexPage() {
  const locale = await getServerLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <ContentShell locale={locale} scope="blog">
      <JsonLd
        data={breadcrumbLd([
          { name: "KeysArk", path: localeHref("/", locale) },
          { name: t("blog_title"), path: localeHref("/blog", locale) },
        ])}
      />
      <header {...testId("blog-header")}>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("blog_title")}</h1>
        <p className="mt-3 text-[var(--color-muted-foreground)]">{t("blog_subtitle")}</p>
      </header>
      <ul {...testId("blog-list")} className="mt-10 flex flex-col gap-4">
        {POSTS.map((p) => {
          const c = getPostContent(p, locale);
          return (
            <li key={p.slug} {...testId("blog-list-item")}>
              <a
                href={localeHref(`/blog/${p.slug}`, locale)}
                className="group block rounded-[calc(var(--radius)+0.25rem)] border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-6 shadow-sm backdrop-blur transition-colors hover:border-[var(--color-primary)]/40"
              >
                <time className="text-xs text-[var(--color-muted-foreground)]">
                  {formatPostDate(p.date, locale)}
                </time>
                <h2 className="mt-1 text-lg font-semibold tracking-tight group-hover:text-[var(--color-primary)]">
                  {c.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                  {c.description}
                </p>
              </a>
            </li>
          );
        })}
      </ul>
    </ContentShell>
  );
}
