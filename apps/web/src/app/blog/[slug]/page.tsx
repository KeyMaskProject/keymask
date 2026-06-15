import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentShell } from "@/components/content-shell";
import { JsonLd } from "@/components/json-ld";
import { Prose } from "@/components/prose";
import { formatPostDate, getPost, getPostContent, POSTS } from "@/lib/content/blog";
import { buildLanguageAlternates, localeHref, translate } from "@/lib/i18n";
import { articleLd, breadcrumbLd } from "@/lib/seo";
import { getServerLocale } from "@/lib/locale-server";
import { testId } from "@/lib/test-id";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const locale = await getServerLocale();
  const c = getPostContent(post, locale);
  return {
    title: `${c.title} — KeysArk`,
    description: c.description,
    alternates: {
      canonical: localeHref(`/blog/${slug}`, locale),
      languages: buildLanguageAlternates(`/blog/${slug}`),
    },
    openGraph: {
      type: "article",
      title: c.title,
      description: c.description,
      publishedTime: post.date,
      modifiedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const locale = await getServerLocale();
  const c = getPostContent(post, locale);
  const urlPath = localeHref(`/blog/${slug}`, locale);
  return (
    <ContentShell locale={locale} scope="blog-post">
      <JsonLd
        data={[
          articleLd({
            title: c.title,
            description: c.description,
            datePublished: post.date,
            dateModified: post.date,
            locale,
            urlPath,
          }),
          breadcrumbLd([
            { name: "KeysArk", path: localeHref("/", locale) },
            { name: translate(locale, "nav_blog"), path: localeHref("/blog", locale) },
            { name: c.title, path: urlPath },
          ]),
        ]}
      />
      <a
        href={localeHref("/blog", locale)}
        className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
      >
        {translate(locale, "blog_back")}
      </a>
      <article {...testId("blog-post-article")} className="mt-6">
        <time className="text-xs text-[var(--color-muted-foreground)]">
          {formatPostDate(post.date, locale)}
        </time>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{c.title}</h1>
        <div className="mt-8">
          <Prose blocks={c.body} />
        </div>
      </article>
    </ContentShell>
  );
}
