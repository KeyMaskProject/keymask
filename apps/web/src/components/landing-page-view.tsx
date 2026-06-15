// SEO 长尾着陆页的统一渲染:外壳复用 ContentShell,内容来自 landing-pages.ts(每页原创)。
// 注入 FAQPage + BreadcrumbList JSON-LD;问答与可见 FAQ 文本逐字一致(Google 政策)。
import { notFound } from "next/navigation";
import { ContentShell } from "./content-shell";
import { JsonLd } from "./json-ld";
import { Prose } from "./prose";
import { getLandingPage } from "@/lib/content/landing-pages";
import { localeHref, pickLocale, translate, type Locale } from "@/lib/i18n";
import { breadcrumbLd, faqLd } from "@/lib/seo";
import { testId } from "@/lib/test-id";

export function LandingPageView({ slug, locale }: { slug: string; locale: Locale }) {
  const page = getLandingPage(slug);
  if (!page) notFound();
  const c = pickLocale(page.locales, locale);
  const urlPath = localeHref(`/${slug}`, locale);
  const related = page.related
    .map((s) => {
      const rp = getLandingPage(s);
      return rp ? { slug: s, label: pickLocale(rp.locales, locale).h1 } : null;
    })
    .filter((x): x is { slug: string; label: string } => x !== null);

  return (
    <ContentShell locale={locale} scope={`lp-${slug}`}>
      <JsonLd
        data={[
          faqLd(c.faqs),
          breadcrumbLd([
            { name: "KeysArk", path: localeHref("/", locale) },
            { name: c.h1, path: urlPath },
          ]),
        ]}
      />
      <article {...testId("landing-page-article")}>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.h1}</h1>
        <div className="mt-8">
          <Prose blocks={c.lead} />
        </div>

        <a
          href={localeHref("/", locale)}
          className="mt-10 inline-flex items-center rounded-[calc(var(--radius)+0.25rem)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
        >
          {translate(locale, "lp_cta")}
        </a>

        <section {...testId("landing-page-faq")} className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight">{translate(locale, "lp_faq_title")}</h2>
          <div className="mt-6 space-y-6">
            {c.faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold">{f.q}</h3>
                <p className="mt-1.5 text-[var(--color-muted-foreground)] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {related.length > 0 ? (
          <nav {...testId("landing-page-related")} className="mt-14 border-t border-[var(--color-border)] pt-8">
            <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)]">
              {translate(locale, "lp_related_title")}
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <a
                    href={localeHref(`/${r.slug}`, locale)}
                    className="text-[var(--color-primary)] transition-opacity hover:opacity-80"
                  >
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </article>
    </ContentShell>
  );
}
