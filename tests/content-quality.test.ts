import { describe, expect, it } from "vitest";
import { loadSeoPages, type SeoPage } from "@/lib/seo";
import { CONTENT_RULES, forbiddenWords, isNewPage, paragraphsOf, sharedParagraphs } from "@/lib/contentQuality";

// Contrôles de qualité des pages de contenu (content/seo) :
//  - aucun mot interdit par les règles d'écriture héritées du rapport (aucun dénigrement) ;
//  - aucun paragraphe partagé à plus de 30 % entre deux pages dont l'une au moins est une page nouvelle de la session SEO 1
//    (pages par centimètre, taille normale, percentile, à propos) : pas de pages quasi identiques. Les recoupements entre
//    guides d'origine (textes du propriétaire) sont signalés par `npm run seo:check`, sans faire échouer les tests ;
//  - questions fréquentes jamais répétées d'une page par centimètre à l'autre ;
//  - longueurs cibles (texte propre à la page : corps et questions-réponses) : 700 à 1 100 mots par page par centimètre,
//    900 à 1 500 mots par nouvelle page pilier.

const pages = loadSeoPages();
const cmPages = pages.filter((p) => p.kind === "centimetre");
const textOf = (p: SeoPage) => [p.title, p.h1, p.metaDescription, ...p.faq.flatMap((f) => [f.q, f.a]), p.bodyHtml.replace(/<[^>]+>/g, " ")].join("\n");

describe("règles d'écriture", () => {
  it("aucun mot interdit (court, petit, insuffisant, anormal, défaut et leurs formes)", () => {
    const found = pages.flatMap((p) => forbiddenWords(textOf(p)).map((w) => `${p.slug} : « ${w} »`));
    expect(found).toEqual([]);
  });

  it("le détecteur reconnaît les formes fléchies, sans faux positif sur les mots qui les contiennent", () => {
    expect(forbiddenWords("Une mesure courte, des petits écarts, une valeur anormale, par défaut, insuffisante.")).toHaveLength(5);
    expect(forbiddenWords("Les erreurs courantes ; un raccourci ; la courbure ; un discours.")).toEqual([]);
  });
});

describe("pages quasi identiques", () => {
  it(`aucun paragraphe partagé à plus de ${CONTENT_RULES.maxShared * 100} % entre une page nouvelle et une autre page`, () => {
    const all = pages.map((p) => ({ slug: p.slug, fresh: isNewPage(p), paragraphs: paragraphsOf(p.bodyHtml) }));
    const offenders: string[] = [];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        if (all[i].fresh || all[j].fresh)
        for (const s of sharedParagraphs(all[i].paragraphs, all[j].paragraphs))
          offenders.push(`${all[i].slug} ↔ ${all[j].slug} (${Math.round(s.score * 100)} %) : « ${s.a.slice(0, 80)}… »`);
    expect(offenders).toEqual([]);
  });

  it("réponses des questions fréquentes : aucune partagée à plus de 30 % entre deux pages par centimètre", () => {
    const offenders: string[] = [];
    for (let i = 0; i < cmPages.length; i++)
      for (let j = i + 1; j < cmPages.length; j++)
        for (const s of sharedParagraphs(cmPages[i].faq.map((f) => f.a), cmPages[j].faq.map((f) => f.a), 8))
          offenders.push(`${cmPages[i].slug} ↔ ${cmPages[j].slug} : « ${s.a.slice(0, 80)}… »`);
    expect(offenders).toEqual([]);
  });

  it("aucune question posée deux fois entre pages par centimètre", () => {
    const qs = cmPages.flatMap((p) => p.faq.map((f) => f.q.toLowerCase().replace(/\d+([,.]\d+)?/g, "#")));
    expect(qs.length).toBe(new Set(qs).size);
  });
});

describe("longueurs", () => {
  it("pages par centimètre : 4 à 6 questions, 700 à 1 100 mots", () => {
    for (const p of cmPages) {
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(4);
      expect(p.faq.length, p.slug).toBeLessThanOrEqual(6);
      expect(p.totalWords, `${p.slug} : ${p.totalWords} mots`).toBeGreaterThanOrEqual(700);
      expect(p.totalWords, `${p.slug} : ${p.totalWords} mots`).toBeLessThanOrEqual(1100);
    }
  });

  it("nouvelles pages piliers et à propos : 900 à 1 500 mots", () => {
    for (const p of pages.filter((x) => isNewPage(x) && x.kind !== "centimetre")) {
      expect(p.totalWords, `${p.slug} : ${p.totalWords} mots`).toBeGreaterThanOrEqual(900);
      expect(p.totalWords, `${p.slug} : ${p.totalWords} mots`).toBeLessThanOrEqual(1500);
    }
  });
});
