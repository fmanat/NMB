import { FORMULAS, SITE } from "@/config/site";

// Données structurées schema.org (JSON-LD). Nom de marque seulement : aucune identité de personne ni de société.
// Le caractère « < » est échappé pour un usage sûr dans une balise script.

export const siteBase = () => (process.env.SITE_URL ?? `https://${SITE.domain}`).replace(/\/$/, "");

/** Signature des contenus (auteur des articles). */
export const EDITORIAL_NAME = `Rédaction ${SITE.name}`;

/** Image de partage propre à une page (titre et chiffre clé), générée par src/app/og/page/[slug]. */
export const ogImagePath = (slug: string) => `/og/page/${slug}`;

export const toJsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c");

const orgId = (base: string) => `${base}/#organisation`;

/** WebSite + Organization, sur toutes les pages. */
export function siteGraph(base = siteBase()) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${base}/#site`, url: `${base}/`, name: SITE.name, inLanguage: "fr", publisher: { "@id": orgId(base) } },
      { "@type": "Organization", "@id": orgId(base), name: SITE.name, url: `${base}/` },
    ],
  };
}

/** WebApplication (accueil) : le calculateur. Prix : gratuit pendant la bêta, sinon le prix du protocole le moins cher. */
export function webApplication(beta: boolean, base = siteBase()) {
  const prices = Object.values(FORMULAS).map((f) => f.priceEur);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${SITE.name} : calculateur de taille du pénis`,
    url: `${base}/`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Navigateur web",
    inLanguage: "fr",
    isAccessibleForFree: beta,
    offers: { "@type": "Offer", price: beta ? "0" : Math.min(...prices).toFixed(2), priceCurrency: "EUR" },
    publisher: { "@id": orgId(base) },
  };
}

export type Crumb = { name: string; path: string };

/** BreadcrumbList : chaque élément avec son adresse absolue. */
export function breadcrumbList(crumbs: Crumb[], base = siteBase()) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${base}${c.path === "/" ? "/" : c.path}` })),
  };
}

/** Article : page de contenu signée par la rédaction, datée de sa dernière vérification. */
export function article(a: { path: string; headline: string; description: string; verified: string | null; image: string }, base = siteBase()) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.headline,
    description: a.description,
    inLanguage: "fr",
    mainEntityOfPage: `${base}${a.path}`,
    image: `${base}${a.image}`,
    ...(a.verified ? { dateModified: a.verified, datePublished: a.verified } : {}),
    author: { "@type": "Organization", name: EDITORIAL_NAME, url: `${base}/a-propos` },
    publisher: { "@id": orgId(base) },
  };
}
