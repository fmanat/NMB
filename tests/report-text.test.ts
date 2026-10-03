import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MORPHO } from "@/config/site";
import { computeIndicators, favourableIndicators, INDICATOR_KEYS, type MorphoIndicators } from "@/lib/morpho";
import { partialText } from "@/lib/photoReport2";
import { PROMPT_VERSION, PROMPT_VISION_V2, SYSTEM_TEXT_V2, SYSTEM_VISION_V2, TARGET_SCHEMA_VERSION, textPrompt } from "@/lib/vision/prompts";
import {
  allTexts,
  checkReportText,
  citableNumbers,
  FORBIDDEN_RULES,
  repeatedExpressions,
  reportTextJsonSchema,
  reportWordCount,
  SECTION_KEYS,
  sentenceCount,
  wordCount,
  type ReportText,
} from "@/lib/vision/reportText";
import { PHOTO_REPORT_V2, validateVisionV2, VISION_SCHEMA_V2 } from "@/lib/vision/schema2";
import { SIMULATED_ESTIMATES, SIMULATED_OBSERVATIONS, simulatedReportText } from "@/lib/vision/simulation";
import { simulateShot, DEFAULT_SHOT } from "@/lib/vision/camera-sim";

const base = { state: "erect" as const, lengthCm: 14.2, girthCm: 12.1, curvatureDeg: 8, direction: "left" as const, symmetry: 93, glansRatio: 0.24, taperRatio: 0.92 };
const CASES: Record<string, Parameters<typeof computeIndicators>[0]> = {
  nominal: base,
  droit: { ...base, lengthCm: 13, girthCm: 12.6, curvatureDeg: 2, direction: "none", symmetry: 96, taperRatio: 0.95 },
  repos: { ...base, state: "rest", lengthCm: 9.6, girthCm: 9.5 },
  courbe: { ...base, curvatureDeg: 35, direction: "up" },
  bas: { ...base, lengthCm: 11.3, girthCm: 10.4 },
};

function sample(ind: MorphoIndicators) {
  const allowedHighlights = favourableIndicators(ind);
  const text = simulatedReportText({ indicators: ind, method: "visuelle", allowedHighlights });
  return { text, ctx: { indicators: ind, allowedHighlights }, json: (over: Partial<ReportText> = {}) => ({ schemaVersion: PHOTO_REPORT_V2, ...text, ...over }) };
}
const nominal = () => sample(computeIndicators(base));

describe("rapport simulé : conforme à toutes les règles (sinon toute la chaîne simulée serait fausse)", () => {
  for (const [name, c] of Object.entries(CASES)) {
    it(`${name} : aucune règle stricte ni souple violée, ${MORPHO.reportWords.min} à ${MORPHO.reportWords.max} mots`, () => {
      const s = sample(computeIndicators(c));
      const r = checkReportText(s.json(), s.ctx);
      expect(r.ok ? [] : r.hard).toEqual([]);
      expect(r.soft).toEqual([]);
      const n = reportWordCount(s.text);
      expect(n).toBeGreaterThanOrEqual(MORPHO.reportWords.min);
      expect(n).toBeLessThanOrEqual(MORPHO.reportWords.max);
    });
  }
});

describe("interdits vérifiés par le code (règles strictes)", () => {
  const rejected = (over: Partial<ReportText>, s = nominal()) => {
    const r = checkReportText(s.json(over), s.ctx);
    expect(r.ok).toBe(false);
    return r.ok ? [] : r.hard;
  };

  it.each([
    ["court", "La tige paraît courte."],
    ["petit", "Un petit écart."],
    ["faible", "Une faible inflexion."],
    ["insuffisant", "Un calibre insuffisant."],
    ["anormal", "Rien d'anormal."],
    ["défaut", "Aucun défaut visible."],
    ["malformation", "Sans malformation."],
    ["dénigrement", "Une longueur modeste."],
  ])("dénigrement : « %s »", (_w, phrase) => {
    expect(rejected({ aspect_surface: `${nominal().text.aspect_surface} ${phrase}` }).join()).toMatch(/dévalorisant/);
  });

  it.each(["La teinte est uniforme.", "Les veines bleues se devinent.", "Un aspect rosé.", "Une couleur homogène."])("couleur ou teinte : « %s »", (phrase) => {
    expect(rejected({ aspect_surface: `${nominal().text.aspect_surface} ${phrase}` }).join()).toMatch(/couleur/);
  });

  it.each(["Le prépuce recouvre la couronne.", "Le gland est découvert.", "Sujet circoncis."])("prépuce, gland couvert ou découvert, circoncision : « %s »", (phrase) => {
    expect(rejected({ gland_couronne: `${nominal().text.gland_couronne} ${phrase}` }).join()).toMatch(/prépuce/);
  });

  it.each(["La longueur part du pubis.", "Les testicules ne sont pas décrits.", "La cuisse est visible."])("parties du corps voisines : « %s »", (phrase) => {
    expect(rejected({ morphologie_generale: `${nominal().text.morphologie_generale} ${phrase}` }).join()).toMatch(/corps voisine/);
  });

  it.each(["L'éclairage est bon.", "Le cadrage est net.", "La posture est droite.", "La pesanteur infléchit l'axe."])("éclairage, cadrage, posture, pesanteur : « %s »", (phrase) => {
    expect(rejected({ axe_courbure: `${nominal().text.axe_courbure} ${phrase}` }).join()).toMatch(/éclairage, cadrage/);
  });

  it("précaution sur la précision : interdite hors de la Note du laboratoire, admise dans la Note", () => {
    expect(rejected({ synthese: `${nominal().text.synthese} La longueur vaut environ cette valeur.` }).join()).toMatch(/précaution/);
    expect(rejected({ conclusion: `${nominal().text.conclusion} Sous réserve de confirmation.` }).join()).toMatch(/précaution/);
    const s = nominal();
    const ok = checkReportText(s.json({ note_laboratoire: "Ces valeurs sont des estimations visuelles, avec une marge d'erreur et une précision limitées." }), s.ctx);
    expect(ok.ok).toBe(true);
  });

  it("vulgarité refusée", () => {
    expect(rejected({ synthese: `${nominal().text.synthese} Une belle queue.` }).join()).toMatch(/vulgaire/);
  });

  it("valeurs : le texte n'utilise que les valeurs fournies (aucun recalcul, aucun arrondi)", () => {
    expect(rejected({ conclusion: `${nominal().text.conclusion} L'écart à la médiane atteint 1,1 cm.` }).join()).toMatch(/valeurs non fournies.*1,1/);
    expect(rejected({ conclusion: `${nominal().text.conclusion} Soit 14 cm.` }).join()).toMatch(/valeurs non fournies/); // 14,2 arrondi
    const ind = computeIndicators(base);
    expect(citableNumbers(ind)).toEqual(expect.arrayContaining([14.2, 12.1, ind.rectitude, ind.symetrie, ind.typicite, ind.score, 100, 2015]));
  });

  it("courbure de 30° ou plus : phrase d'avis médical exigée dans « Axe et courbure », nulle part ailleurs ; jamais de diagnostic", () => {
    const s = sample(computeIndicators(CASES.courbe));
    expect(checkReportText(s.json(), s.ctx).ok).toBe(true);
    const without = checkReportText(s.json({ axe_courbure: "L'axe suit une trajectoire continue. La courbure atteint 35°. Elle est régulière." }), s.ctx);
    expect(without.ok ? [] : without.hard.join()).toMatch(/avis médical/);
    const elsewhere = checkReportText(s.json({ conclusion: `${s.text.conclusion} Un avis médical peut être utile.` }), s.ctx);
    expect(elsewhere.ok ? [] : elsewhere.hard.join()).toMatch(/hors de « Axe et courbure »/);
    const diag = checkReportText(s.json({ axe_courbure: `${s.text.axe_courbure} Il pourrait s'agir d'une maladie de La Peyronie.` }), s.ctx);
    expect(diag.ok ? [] : diag.hard.join()).toMatch(/diagnostic/);
  });

  it("courbure inférieure à 30° : aucun vocabulaire médical", () => {
    expect(rejected({ axe_courbure: `${nominal().text.axe_courbure} Un avis médical n'est pas nécessaire.` }).join()).toMatch(/vocabulaire médical/);
  });

  it("état « repos » : la Note doit indiquer qu'une observation en érection donne une lecture complète", () => {
    const s = sample(computeIndicators(CASES.repos));
    expect(checkReportText(s.json(), s.ctx).ok).toBe(true);
    const r = checkReportText(s.json({ note_laboratoire: "Ce rapport repose sur une estimation visuelle." }), s.ctx);
    expect(r.ok ? [] : r.hard.join()).toMatch(/érection/);
  });

  it("« gabarit compact » : une seule fois, et seulement pour une valeur basse", () => {
    const low = sample(computeIndicators(CASES.bas));
    expect(checkReportText(low.json(), low.ctx).ok).toBe(true);
    const twice = checkReportText(low.json({ conclusion: `${low.text.conclusion} Un gabarit compact, à nouveau.` }), low.ctx);
    expect(twice.ok ? [] : twice.hard.join()).toMatch(/qu'une fois/);
    expect(rejected({ conclusion: `${nominal().text.conclusion} Un gabarit compact.` }).join()).toMatch(/réservé à une valeur basse/);
  });

  it("structure : clés, trois points remarquables distincts pris dans la liste des indicateurs favorables, version exigée", () => {
    const s = nominal();
    const bad = (j: unknown) => checkReportText(j, s.ctx);
    expect(bad({ ...s.json(), schemaVersion: "photo-report/1" }).ok).toBe(false);
    expect(bad({ ...s.json(), points_remarquables: s.text.points_remarquables.slice(0, 2) }).ok).toBe(false);
    expect(bad({ ...s.json(), points_remarquables: [s.text.points_remarquables[0], s.text.points_remarquables[0], s.text.points_remarquables[1]] }).ok).toBe(false);
    expect(bad({ ...s.json(), points_remarquables: [{ indicateur: "courbure", texte: "Une courbure de 8°." }, ...s.text.points_remarquables.slice(1)] }).ok).toBe(false);
    const { conclusion: _c, ...noConclusion } = s.json();
    void _c;
    expect(bad(noConclusion).ok).toBe(false);
    expect(bad(null).ok).toBe(false);
  });
});

describe("règles souples (relance, puis tolérées) : longueur, phrases, répétitions", () => {
  it("compte les mots et les phrases (abréviations et décimales protégées)", () => {
    expect(wordCount("L'axe, rectiligne, mesure 14,2 cm.")).toBe(5);
    expect(sentenceCount("Une phrase. Une autre phrase !")).toBe(2);
    expect(sentenceCount("D'après Veale et al. (2015), la médiane est de 13,1 cm. Fin.")).toBe(2);
    expect(sentenceCount("Valeur 13.1 retenue.")).toBe(1);
  });

  it("une synthèse de deux phrases, un texte trop court, une expression répétée sont des écarts souples (pas des interdits)", () => {
    const s = nominal();
    const r = checkReportText(s.json({ synthese: "Première phrase assez longue pour compter. Seconde phrase.", aspect_surface: "Contour régulier." }), s.ctx);
    expect(r.ok).toBe(true);
    expect(r.soft.join(" | ")).toMatch(/synthèse : 2 phrase/);
    expect(r.soft.join(" | ")).toMatch(/Aspect de surface : 1 phrase/);
    expect(repeatedExpressions(["un profil très net", "un profil très net", "un profil très net"])).toEqual(["un profil très net"]);
    expect(repeatedExpressions(["un profil très net", "un profil très net"])).toEqual([]);
    expect(repeatedExpressions(["l'Index de conicité distale", "l'Index de conicité distale", "l'Index de conicité distale"])).toEqual([]); // nom d'indicateur
  });

  it("percentile formulé deux fois dans la même phrase, majuscules fautives : écarts souples (relance avec la consigne)", () => {
    const s = nominal();
    const r = checkReportText(s.json({ conclusion: "La longueur se place au percentile 74, au-dessus de 74 % de la population de référence. La Longueur reste lisible et l'Indice de Rectitude Axiale aussi." }), s.ctx);
    expect(r.ok).toBe(true);
    expect(r.soft.join(" | ")).toMatch(/percentile formulé deux fois/);
    expect(r.soft.join(" | ")).toMatch(/majuscule fautive \(« Longueur »\)/);
    const caps = checkReportText(s.json({ conclusion: "L'Indice de Rectitude Axiale reste lisible. Le profil est net." }), s.ctx);
    expect(caps.soft.join()).toMatch(/majuscule fautive \(« (Rectitude|Indice de R) »\)/);
    const fine = checkReportText(s.json({ conclusion: "Longueur en tête de phrase : aucune faute ici. Puis la longueur, au percentile 74, puis l'Indice de rectitude axiale." }), s.ctx);
    expect(fine.soft.join()).not.toMatch(/percentile formulé|majuscule/);
  });

  it("« variante de la normale » au plus une fois", () => {
    const s = nominal();
    const r = checkReportText(s.json({ conclusion: `${s.text.conclusion} Une variante de la normale.`, aspect_surface: `${s.text.aspect_surface} Une variante de la normale.` }), s.ctx);
    expect(r.soft.join()).toMatch(/variante de la normale/);
  });
});

describe("rapport partiel (construit par le code)", () => {
  it.each(["rest", "erect"] as const)("%s : aucun terme interdit", (state) => {
    const t = partialText(state);
    for (const rule of FORBIDDEN_RULES) for (const x of allTexts(t)) expect(x.match(rule.re)?.[0], `${rule.id} : ${x}`).toBeUndefined();
  });
});

describe("schéma de l'appel vision (photo-report/2)", () => {
  const ok = { schemaVersion: PHOTO_REPORT_V2, recevabilite: { recevable: true, motif: "ok" }, estimations: { ...SIMULATED_ESTIMATES }, observations: { ...SIMULATED_OBSERVATIONS }, reperage: { coins_carte: [], base: { x: 0, y: 0, confiance: 0 }, extremite: { x: 0, y: 0, confiance: 0 }, ligne_mediane: [], bords: [] } };

  it("accepte une réponse recevable sans carte (pas de points retenus)", () => {
    const v = validateVisionV2(ok);
    expect(v?.recevable).toBe(true);
    if (v?.recevable) {
      expect(v.reperage).toBeNull();
      expect(v.estimations.longueur_cm).toBe(14.2);
    }
  });

  it("retient les points seulement si la carte est présente ET lisible ET les points complets", () => {
    const reperage = simulateShot(DEFAULT_SHOT).reperage;
    const withCard = { ...ok, estimations: { ...ok.estimations, carte_presente: true, carte_lisible: true }, reperage };
    const v = validateVisionV2(withCard);
    expect(v?.recevable && v.reperage?.coins_carte.length).toBe(4);
    const unreadable = validateVisionV2({ ...withCard, estimations: { ...withCard.estimations, carte_lisible: false } });
    expect(unreadable?.recevable && unreadable.reperage).toBeNull();
    const incomplete = validateVisionV2({ ...withCard, reperage: { ...reperage, coins_carte: reperage.coins_carte.slice(0, 3) } });
    expect(incomplete?.recevable && incomplete.reperage).toBeNull(); // carte inexploitable : la taille reste estimée, ce n'est pas un échec
  });

  it("non recevable : seul le motif compte ; « recevable » avec un motif de refus est traité comme un refus", () => {
    expect(validateVisionV2({ schemaVersion: PHOTO_REPORT_V2, recevabilite: { recevable: false, motif: "doute_majorite" } })).toEqual({ recevable: false, motif: "doute_majorite" });
    expect(validateVisionV2({ ...ok, recevabilite: { recevable: true, motif: "visage_visible" } })).toEqual({ recevable: false, motif: "visage_visible" });
    expect(validateVisionV2({ ...ok, recevabilite: { recevable: false, motif: "ok" } })).toEqual({ recevable: false, motif: "sujet_non_conforme" });
  });

  it("rejette une version absente ou différente, un motif inconnu, des estimations hors bornes ou des observations manquantes", () => {
    expect(validateVisionV2({ ...ok, schemaVersion: "photo-report/1" })).toBeNull();
    expect(validateVisionV2({ ...ok, recevabilite: { recevable: false, motif: "inconnu" } })).toBeNull();
    expect(validateVisionV2({ ...ok, estimations: { ...ok.estimations, symetrie: 140 } })).toBeNull();
    expect(validateVisionV2({ ...ok, estimations: { ...ok.estimations, etat: "autre" } })).toBeNull();
    expect(validateVisionV2({ ...ok, observations: { ...ok.observations, surface: undefined } })).toBeNull();
    expect(validateVisionV2(null)).toBeNull();
  });

  it("le schéma JSON envoyé à l'API est strict et porte la version", () => {
    expect(VISION_SCHEMA_V2.additionalProperties).toBe(false);
    expect(VISION_SCHEMA_V2.properties.schemaVersion.enum).toEqual([PHOTO_REPORT_V2]);
    expect(VISION_SCHEMA_V2.properties.recevabilite.properties.motif.enum).toContain("qualite_insuffisante");
    const s = reportTextJsonSchema(["symetrie", "rectitude", "conicite"]);
    expect(s.properties.points_remarquables.items.properties.indicateur.enum).toEqual(["symetrie", "rectitude", "conicite"]);
    expect(s.required).toEqual(expect.arrayContaining(["synthese", "appreciations", ...SECTION_KEYS, "points_remarquables", "conclusion", "note_laboratoire"]));
    expect(Object.keys(s.properties.appreciations.properties)).toEqual([...INDICATOR_KEYS]);
  });
});

describe("prompts versionnés (deux fichiers : vision et texte, dans src/lib/vision/prompts/)", () => {
  const dir = resolve(__dirname, "../src/lib/vision/prompts");

  it("le fichier en service est photo-report-v2.ts ; versions cohérentes avec le code", () => {
    expect(readdirSync(dir).sort()).toEqual(["index.ts", "photo-report-v2.ts"]);
    expect(readFileSync(resolve(dir, "index.ts"), "utf8")).toMatch(/from "\.\/photo-report-v2"/);
    expect(PROMPT_VERSION).toBe("photo-report-prompts/2");
    expect(TARGET_SCHEMA_VERSION).toBe(PHOTO_REPORT_V2);
    for (const p of [SYSTEM_VISION_V2, SYSTEM_TEXT_V2]) expect(p).toContain(`"${PHOTO_REPORT_V2}"`);
  });

  it("le prompt vision reprend les règles : recevabilité, carte 85,60 × 53,98 mm, longueur pubis-extrémité côté dorsal, estimations sans la carte", () => {
    for (const s of ["visage_visible", "plusieurs_personnes", "image_non_originale", "doute_majorite", "qualite_insuffisante", "85,60 × 53,98 mm", "du pubis à l'extrémité, côté dorsal", "mi-tige", "SANS tenir compte de la carte", "aucune couleur"]) {
      expect(PROMPT_VISION_V2).toContain(s);
    }
  });

  it("le prompt texte énonce le ton, les interdits et la structure, et transmet les valeurs calculées, les observations et les relances", () => {
    for (const s of ["Aucun humour", "traduction entre parenthèses", "gabarit compact", "Note du laboratoire", "600 à 800 mots", "exactement trois phrases", "trois points forts", "« court »", "malformation"]) {
      expect(SYSTEM_TEXT_V2).toContain(s);
    }
    const ind = computeIndicators(base);
    const p = textPrompt({ indicators: ind, method: "visuelle", observations: SIMULATED_OBSERVATIONS, allowedHighlights: favourableIndicators(ind), previousViolations: ["interdit : couleur (« teinte »)"] });
    expect(p).toContain("14,2 cm");
    expect(p).toContain(SIMULATED_OBSERVATIONS.surface);
    expect(p).toContain("REJETÉE");
    expect(p).toContain("teinte");
    const rest = computeIndicators(CASES.repos);
    expect(textPrompt({ indicators: rest, method: "visuelle", observations: SIMULATED_OBSERVATIONS, allowedHighlights: favourableIndicators(rest) })).toMatch(/aucun percentile de longueur/);
  });
});
