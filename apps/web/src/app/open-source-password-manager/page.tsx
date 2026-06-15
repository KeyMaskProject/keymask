import type { Metadata } from "next";
import { LandingPageView } from "@/components/landing-page-view";
import { getLandingPage } from "@/lib/content/landing-pages";
import { buildLanguageAlternates, localeHref, pickLocale } from "@/lib/i18n";
import { getServerLocale } from "@/lib/locale-server";

const SLUG = "open-source-password-manager";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const c = pickLocale(getLandingPage(SLUG)!.locales, locale);
  return {
    title: `${c.title} — KeysArk`,
    description: c.description,
    alternates: {
      canonical: localeHref(`/${SLUG}`, locale),
      languages: buildLanguageAlternates(`/${SLUG}`),
    },
  };
}

export default async function Page() {
  const locale = await getServerLocale();
  return <LandingPageView slug={SLUG} locale={locale} />;
}
