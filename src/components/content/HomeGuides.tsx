import Link from "next/link";
import { CM_SIZES, cmSlug, GIRTH_SIZES, girthSlug, PILLAR_SLUGS, visibleSeoPages } from "@/lib/seo";
import { SizeLinks } from "./ContentBlocks";

/**
 * Accueil : « Où vous situez-vous ? » (les 11 pages par centimètre) et les pages piliers.
 * Chaque lien n'apparaît que si sa page existe ; la section disparaît si aucune n'existe.
 */
export function HomeGuides() {
  const pages = visibleSeoPages();
  const pillars = PILLAR_SLUGS.map((s) => pages.find((p) => p.slug === s)).filter((p) => p !== undefined);
  const hasSizes = CM_SIZES.some((n) => pages.some((p) => p.slug === cmSlug(n)));
  const hasGirths = GIRTH_SIZES.some((n) => pages.some((p) => p.slug === girthSlug(n)));
  if (!hasSizes && pillars.length === 0) return null;
  return (
    <section id="reperes" aria-labelledby="reperes-titre" className="section bg-[var(--bm-gray-050)] border-y border-[var(--bm-gray-200)]">
      <div className="container-bm">
        <p className="t-eyebrow">Repères</p>
        <h2 id="reperes-titre" className="t-h2 mt-3 max-w-[28ch]">Où vous situez-vous ?</h2>
        {hasSizes && (
          <>
            <p className="t-lead text-muted mt-4 max-w-[46rem]">
              Longueur en érection, de 10 à 20 cm : chaque page donne le percentile calculé, la courbe de distribution et ce que la position signifie.
            </p>
            <div className="mt-8">
              <SizeLinks bare />
            </div>
          </>
        )}
        {hasGirths && (
          <div className="mt-10">
            <h3 className="t-h4">Et la circonférence ?</h3>
            <p className="t-small text-muted mt-2 max-w-[46rem]">Circonférence en érection, de 9 à 15 cm : le même calcul, sur la courbe du tour du pénis.</p>
            <div className="mt-4">
              <SizeLinks axis="girth" bare />
            </div>
          </div>
        )}
        {pillars.length > 0 && (
          <div className="mt-10">
            <h3 className="t-h4">Comprendre les chiffres</h3>
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {pillars.map((p) => (
                <li key={p.slug}>
                  <Link href={`/${p.slug}`} className="card card-hover block !p-5 no-underline h-full">
                    <span className="font-semibold text-foreground">{p.h1}</span>
                    <span className="block t-small text-muted mt-2">{p.metaDescription}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
