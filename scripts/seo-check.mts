// Vérifie les pages de contenu de content/seo : format de l'en-tête, corps, liens, longueur, sources.
//
// Utilisation :
//   npm run seo:check              contrôles locaux (format, longueur, liens)
//   npm run seo:check -- --urls    contrôle aussi que chaque adresse de source répond (réseau)
//
// Ce que l'outil NE fait PAS : vérifier qu'un chiffre cité figure bien dans sa source. Cela demande de lire la source
// et se fait page par page, à la relecture.

import { SEO_LIMITS, SEO_SLUGS, loadSeoPagesReport } from "@/lib/seo";
import { CONTENT_RULES, forbiddenWords, isNewPage, paragraphsOf, sharedParagraphs } from "@/lib/contentQuality";

const checkUrls = process.argv.includes("--urls");
let errors = 0;
let warnings = 0;
const err = (m: string) => {
  errors++;
  console.log(`  ✗ ${m}`);
};
const warn = (m: string) => {
  warnings++;
  console.log(`  ⚠ ${m}`);
};

const { pages, errors: loadErrors } = loadSeoPagesReport();
for (const e of loadErrors) {
  console.log(`✗ ${e.message}`);
  errors++;
}

console.log(`Pages valides : ${pages.length} / ${SEO_SLUGS.length}${loadErrors.length ? ` (${loadErrors.length} fichier(s) refusé(s), voir ci-dessus)` : ""}`);
const missing = SEO_SLUGS.filter((s) => !pages.some((p) => p.slug === s) && !loadErrors.some((e) => e.file === `${s}.md`));
if (missing.length) console.log(`Pages à venir : ${missing.join(", ")}\n`);

async function probe(url: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; verification-de-sources)", accept: "text/html,application/pdf,*/*" },
    });
    if (res.ok) return `OK (${res.status})`;
    if (res.status === 403 || res.status === 429 || res.status === 401) return `BLOQUÉ (${res.status}) : à vérifier à la main`;
    return `ÉCHEC (${res.status})`;
  } catch (e) {
    return `ÉCHEC (${(e as Error).name === "AbortError" ? "délai dépassé" : (e as Error).message})`;
  } finally {
    clearTimeout(timer);
  }
}

for (const p of pages) {
  console.log(`\n${p.slug}.md`);
  console.log(`  titre : ${[...p.title].length}/${SEO_LIMITS.titleMax} caractères · description : ${[...p.metaDescription].length}/${SEO_LIMITS.metaDescriptionMax} · mot-clé : ${p.targetKeyword}`);
  console.log(`  corps : ${p.words} mots · ${p.headings.filter((h) => h.depth === 2).length} titres H2, ${p.headings.filter((h) => h.depth === 3).length} H3 · FAQ : ${p.faq.length} · sources : ${p.sources.length}`);
  // Cible de longueur : pages par centimètre 700 à 1 100 mots (corps et questions-réponses) ; autres pages, corps de 600 à 1 500 mots.
  if (p.kind === "centimetre") {
    if (p.totalWords < 700 || p.totalWords > 1100) warn(`longueur ${p.totalWords} mots (corps et questions-réponses), hors de la cible 700 à 1 100`);
  } else if (p.words < SEO_LIMITS.wordsMin || p.words > SEO_LIMITS.wordsMax) warn(`longueur ${p.words} mots, hors de la cible ${SEO_LIMITS.wordsMin} à ${SEO_LIMITS.wordsMax}`);
  for (const w of forbiddenWords([p.title, p.h1, p.metaDescription, ...p.faq.flatMap((f) => [f.q, f.a]), p.bodyHtml.replace(/<[^>]+>/g, " ")].join("\n"))) err(`mot interdit par les règles d'écriture : « ${w} »`);
  if (p.sources.length === 0) warn("aucune source citée");
  if (p.faq.length === 0) warn("aucune question FAQ (le balisage schema.org ne sera pas généré)");
  // Pages par centimètre : l'appel vers le questionnaire est ajouté par la mise en page.
  if (p.kind !== "centimetre" && !/\]\(\/?analyse\b/.test(p.bodyHtml) && !p.bodyHtml.includes('href="/analyse"')) warn("aucun lien vers /analyse dans le corps");
  if (!SEO_SLUGS.some((s) => s !== p.slug && p.bodyHtml.includes(`href="/${s}`))) warn("aucun lien interne vers une autre page");
  if (p.pendingLinks.length) console.log(`  ℹ liens vers des pages pas encore présentes : ${p.pendingLinks.join(", ")}`);
  const urls = p.sources.map((s) => s.url);
  if (new Set(urls).size !== urls.length) warn("source en double");

  if (checkUrls) {
    for (const s of p.sources) {
      const r = await probe(s.url);
      if (r.startsWith("OK")) console.log(`  ✓ ${r} ${s.url}`);
      else if (r.startsWith("BLOQUÉ")) warn(`${r} ${s.url}`);
      else err(`${r} ${s.url}`);
    }
  }
}

// Paragraphes partagés entre deux pages (plus de 30 % de triplets de mots communs). Bloquant si une page nouvelle est en cause
// (le test tests/content-quality.test.ts le vérifie aussi) ; simple avertissement entre deux guides d'origine.
console.log(`\nParagraphes partagés à plus de ${CONTENT_RULES.maxShared * 100} % entre deux pages :`);
let shared = 0;
for (let i = 0; i < pages.length; i++)
  for (let j = i + 1; j < pages.length; j++)
    for (const s of sharedParagraphs(paragraphsOf(pages[i].bodyHtml), paragraphsOf(pages[j].bodyHtml))) {
      shared++;
      const msg = `${pages[i].slug} ↔ ${pages[j].slug} (${Math.round(s.score * 100)} %) : « ${s.a.slice(0, 70)}… »`;
      if (isNewPage(pages[i]) || isNewPage(pages[j])) err(msg);
      else warn(msg);
    }
if (shared === 0) console.log("  aucun");

console.log(`\nRésultat : ${errors} erreur(s), ${warnings} avertissement(s).`);
process.exit(errors > 0 ? 1 : 0);
