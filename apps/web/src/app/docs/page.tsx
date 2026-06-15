import type { Metadata } from "next";
import { Docs } from "@/components/docs";
import { buildLanguageAlternates, localeHref, translate } from "@/lib/i18n";
import { getServerLocale } from "@/lib/locale-server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title: `${translate(locale, "docs_title")} — KeysArk`,
    description: translate(locale, "docs_subtitle"),
    alternates: {
      canonical: localeHref("/docs", locale),
      languages: buildLanguageAlternates("/docs"),
    },
  };
}

export default async function DocsPage() {
  const locale = await getServerLocale();
  return <Docs locale={locale} />;
}
