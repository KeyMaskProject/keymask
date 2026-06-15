import type { Metadata } from "next";
import { ContentShell } from "@/components/content-shell";
import { Prose } from "@/components/prose";
import { ABOUT } from "@/lib/content/about";
import { buildLanguageAlternates, localeHref, pickLocale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/locale-server";
import { testId } from "@/lib/test-id";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const c = pickLocale(ABOUT, locale);
  return {
    title: `${c.title} — KeysArk`,
    description: c.description,
    alternates: {
      canonical: localeHref("/about", locale),
      languages: buildLanguageAlternates("/about"),
    },
  };
}

export default async function AboutPage() {
  const locale = await getServerLocale();
  const c = pickLocale(ABOUT, locale);
  return (
    <ContentShell locale={locale} scope="about">
      <article {...testId("about-article")}>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.title}</h1>
        <div className="mt-8">
          <Prose blocks={c.body} />
        </div>
      </article>
    </ContentShell>
  );
}
