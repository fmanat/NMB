// Contrôles de qualité des textes de contenu : mots interdits et paragraphes partagés entre pages.
// Fonctions pures, utilisées par les tests (tests/content-quality.test.ts) et par l'outil `npm run seo:check`.

/** Pages créées par la session SEO 1 (et toute page par centimètre) : soumises sans exception au contrôle des paragraphes partagés. */
export const NEW_PAGES = ["taille-penis-normale", "percentile-penis", "a-propos"] as const;
export const isNewPage = (p: { slug: string; kind: string }) => p.kind === "centimetre" || (NEW_PAGES as readonly string[]).includes(p.slug);

export const CONTENT_RULES = {
  /** Part maximale de triplets de mots qu'un paragraphe peut partager avec un paragraphe d'une autre page. */
  maxShared: 0.3,
  /** Paragraphes plus brefs ignorés (en mots) : une phrase de liaison ne fait pas une page quasi identique. */
  minWords: 15,
} as const;

/**
 * Règles d'écriture héritées du rapport photo : jamais « court », « petit », « insuffisant », « anormal », « défaut »,
 * sous aucune forme (féminin, pluriel, dérivés). Les mots qui les contiennent sans en être (courant, raccourci, courbure) passent.
 */
const FORBIDDEN = /(?<![\p{L}])(courte?s?|petite?s?|petitesse|insuffisante?s?|insuffisance|anormale?s?|anormaux|défauts?)(?![\p{L}])/giu;

/** Mots interdits trouvés dans un texte (dans l'ordre d'apparition). */
export function forbiddenWords(text: string): string[] {
  return [...text.matchAll(FORBIDDEN)].map((m) => m[0]);
}

/** Paragraphes et éléments de liste d'un HTML de page, en texte brut. */
export function paragraphsOf(html: string): string[] {
  return [...html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2].replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").trim());
}

/** Mots normalisés (minuscules, sans chiffres ni ponctuation) : deux phrases qui ne diffèrent que par leurs chiffres se ressemblent. */
const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[0-9]+([,.][0-9]+)?/g, " ")
    .split(/[^\p{L}'’-]+/u)
    .filter(Boolean);

// Mémoire des triplets par texte : chaque paragraphe est comparé à tous ceux des autres pages, on ne le découpe qu'une fois.
const cache = new Map<string, Set<string>>();
const shingles = (t: string) => {
  let s = cache.get(t);
  if (!s) {
    const w = words(t);
    s = new Set(w.slice(0, Math.max(0, w.length - 2)).map((_, i) => `${w[i]} ${w[i + 1]} ${w[i + 2]}`));
    cache.set(t, s);
  }
  return s;
};

/** Part de triplets de mots communs, rapportée au plus bref des deux textes (0 à 1). */
export function sharedScore(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let n = 0;
  for (const s of A) if (B.has(s)) n++;
  return n / Math.min(A.size, B.size);
}

/** Paires de paragraphes (un de chaque page) qui partagent plus de `maxShared` de leurs triplets de mots. */
export function sharedParagraphs(pa: string[], pb: string[], minWords: number = CONTENT_RULES.minWords) {
  const keep = (ps: string[]) => ps.filter((p) => words(p).length >= minWords);
  const out: { a: string; b: string; score: number }[] = [];
  for (const a of keep(pa))
    for (const b of keep(pb)) {
      const score = sharedScore(a, b);
      if (score > CONTENT_RULES.maxShared) out.push({ a, b, score });
    }
  return out;
}
