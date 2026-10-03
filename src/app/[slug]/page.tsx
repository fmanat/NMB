import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { SITE } from "@/config/site";
import { faqJsonLd, getSeoPage, isPublished, loadSeoPages, PILLAR_SLUGS, type BlockName, type SeoPage } from "@/lib/seo";
import { EDITORIAL_NAME, article, ogImagePath, toJsonLd, type Crumb } from "@/lib/structuredData";
import {
  Breadcrumbs,
  CmAnswer,
  MeasureCheck,
  MiniCalculator,
  NeighborSizes,
  PercentileTables,
  QuestionnaireCta,
  ReferenceCurve,
  SizeLinks,
} from "@/components/content/ContentBlocks";

// Pages de contenu : générées au build. Un slug inconnu renvoie une erreur 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadSeoPages().map((p) => ({ slug: p.slug }));
}

// En production, si la publication est coupée (SEO_PUBLISH=off), ces pages n'existent pas pour le public.
const hidden = () => !isPublished() && process.env.NODE_ENV === "production";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page || hidden()) return { robots: { index: false, follow: false } };
  const image = { url: ogImagePath(page.slug), width: 1200, height: 630, alt: page.h1 };
  return {
    title: { absolute: page.title },
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    robots: isPublished() ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "article", title: page.title, description: page.metaDescription, url: `/${page.slug}`, siteName: SITE.name, locale: "fr_FR", images: [image] },
    twitter: { card: "summary_large_image", title: page.title, description: page.metaDescription, images: [image.url] },
  };
}

const DATE_FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Fil d'Ariane : Accueil › (Percentile du pénis, pour les pages par centimètre) › page. */
function crumbsFor(page: SeoPage): Crumb[] {
  const crumbs: Crumb[] = [{ name: "Accueil", path: "/" }];
  if (page.kind === "centimetre") crumbs.push({ name: "Percentile du pénis", path: "/percentile-penis" });
  crumbs.push({ name: page.breadcrumb, path: `/${page.slug}` });
  return crumbs;
}

function Block({ name, page }: { name: BlockName; page: SeoPage }) {
  switch (name) {
    case "calculateur":
      return <MiniCalculator cm={page.cm} />;
    case "distribution":
      return (
        <>
          <ReferenceCurve series="erect-length" title="Longueur en érection" />
          <ReferenceCurve series="erect-girth" title="Circonférence en érection" />
        </>
      );
    case "tableau-percentiles":
      return <PercentileTables />;
    case "tailles":
      return <SizeLinks current={page.cm} />;
    case "mesure":
      return <MeasureCheck />;
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page || hidden()) notFound();

  const all = loadSeoPages();
  const placed = new Set(page.segments.flatMap((s) => (s.type === "block" ? [s.name] : [])));
  const toc = page.headings.filter((h) => h.depth === 2);
  const faq = faqJsonLd(page);
  const articleLd = toJsonLd(article({ path: `/${page.slug}`, headline: page.h1, description: page.metaDescription, verified: page.verified, image: ogImagePath(page.slug) }));

  // « À lire aussi » : les pages piliers d'abord, puis les guides ; jamais les pages par centimètre (elles ont leur propre grille).
  const related = [
    ...all.filter((p) => (PILLAR_SLUGS as readonly string[]).includes(p.slug)),
    ...all.filter((p) => p.kind === "guide"),
  ].filter((p) => p.slug !== page.slug);

  return (
    <article className="container-bm container-narrow py-8 md:py-12">
      <Breadcrumbs crumbs={crumbsFor(page)} />
      {!isPublished() && (
        <p className="mt-4 text-sm border border-accent-2/50 rounded-lg px-3 py-2 text-accent-2">
          Mention interne : publication coupée (SEO_PUBLISH=off). Cette page est en noindex et n&apos;apparaît pas dans le sitemap.
        </p>
      )}
      <h1 className="t-h1 mt-4 !text-[30px] !leading-[36px] md:!text-[40px] md:!leading-[46px]">{page.h1}</h1>
      <p className="t-small text-muted mt-3">
        {all.some((p) => p.slug === "a-propos") ? <Link href="/a-propos" className="underline">{EDITORIAL_NAME}</Link> : EDITORIAL_NAME}
        {page.verified && (
          <>
            {" · "}Vérifié le <time dateTime={page.verified}>{DATE_FR.format(new Date(page.verified))}</time>
          </>
        )}
      </p>

      {page.cm && <CmAnswer cm={page.cm} />}

      {toc.length >= 3 && (
        <nav aria-label="Sommaire" className="card !p-4 mt-6 text-sm">
          <p className="text-muted mb-2">Sommaire</p>
          <ol className="list-decimal pl-5 space-y-1">
            {toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="underline">{h.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="prose-lab mt-6">
        {page.segments.map((s, i) =>
          s.type === "html" ? <div key={i} dangerouslySetInnerHTML={{ __html: s.html }} /> : <Fragment key={i}><Block name={s.name} page={page} /></Fragment>,
        )}
      </div>

      {page.cm && !placed.has("mesure") && <MeasureCheck />}
      {!placed.has("calculateur") && page.kind !== "info" && <MiniCalculator cm={page.cm} />}
      {page.cm && <NeighborSizes cm={page.cm} />}

      {page.faq.length > 0 && (
        <section className="mt-10" aria-labelledby="faq-titre">
          <h2 id="faq-titre" className="t-h3 mb-3">Questions fréquentes</h2>
          <div className="space-y-2">
            {page.faq.map((f) => (
              <details key={f.q} className="accordion">
                <summary>{f.q}</summary>
                <p className="accordion-body">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <QuestionnaireCta cm={page.cm} />

      {!placed.has("tailles") && page.kind !== "info" && <SizeLinks current={page.cm} title={page.cm ? "Les autres tailles" : "Où vous situez-vous ?"} />}

      {page.sources.length > 0 && (
        <section className="mt-10" aria-labelledby="references-titre">
          <h2 id="references-titre" className="t-h3 mb-3">Références</h2>
          <ol className="prose-lab list-decimal pl-5 space-y-1 text-sm">
            {page.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener nofollow" target="_blank" className="underline">{s.title}</a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {related.length > 0 && (
        <nav aria-label="À lire aussi" className="mt-10 text-sm">
          <p className="text-muted mb-2">À lire aussi</p>
          <ul className="space-y-1">
            <li><Link href="/" className="underline">Calculateur de taille du pénis (accueil)</Link></li>
            {related.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="underline">{p.h1}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="mt-10 text-xs text-muted">
        Contenu informatif, sans valeur de conseil médical. {SITE.name} ne fournit pas de diagnostic ; en cas de gêne ou de douleur, consultez un professionnel de santé.
      </p>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faq }} />}
    </article>
  );
}
