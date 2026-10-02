import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { faqJsonLd, getSeoPage, isPublished, loadSeoPages } from "@/lib/seo";

// Pages de contenu : générées au build. Un slug inconnu renvoie une erreur 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadSeoPages().map((p) => ({ slug: p.slug }));
}

// En production, tant que SEO_PUBLISH n'est pas « on », ces pages n'existent pas pour le public.
const hidden = () => !isPublished() && process.env.NODE_ENV === "production";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page || hidden()) return { robots: { index: false, follow: false } };
  return {
    title: { absolute: page.title },
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    robots: isPublished() ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "article", title: page.title, description: page.metaDescription, url: `/${page.slug}`, images: [{ url: "/og/neutre", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: page.title, description: page.metaDescription, images: ["/og/neutre"] },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page || hidden()) notFound();

  const jsonLd = faqJsonLd(page);
  const related = loadSeoPages().filter((p) => p.slug !== page.slug);
  const toc = page.headings.filter((h) => h.depth === 2);

  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      {!isPublished() && (
        <p className="mb-6 text-sm border border-accent-2/50 rounded-lg px-3 py-2 text-accent-2">
          Mention interne : à relire avant publication. Cette page est en noindex et n&apos;apparaît pas dans le sitemap tant que la
          publication n&apos;est pas activée.
        </p>
      )}
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{page.title}</h1>

      {toc.length >= 3 && (
        <nav aria-label="Sommaire" className="panel p-4 mt-6 text-sm">
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

      <div className="prose-lab mt-6" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />

      {page.faq.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">Questions fréquentes</h2>
          <div className="space-y-2">
            {page.faq.map((f) => (
              <details key={f.q} className="panel p-4">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-2 text-muted leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <aside className="panel p-5 mt-10 text-center space-y-3">
        <p className="font-semibold">Situer vos propres mesures</p>
        <p className="text-sm text-muted">Obtenez un rapport chiffré avec percentiles et marges d&apos;erreur. Paiement unique, aucun compte.</p>
        <Link href="/analyse" className="btn btn-primary btn-block-mobile">Faire mon analyse</Link>
      </aside>

      {page.sources.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">Sources</h2>
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
            {related.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className="underline">{p.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <p className="mt-10 text-xs text-muted">
        Contenu informatif, sans valeur de conseil médical. {SITE.name} ne fournit pas de diagnostic ; en cas de gêne ou de douleur, consultez un professionnel de santé.
      </p>

      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
    </article>
  );
}
