import { describe, expect, it } from "vitest";
import { MORPHO, REFERENCES } from "@/config/site";
import {
  computeIndicators,
  conicityIndex,
  favourableIndicators,
  indicatorValue,
  INDICATOR_KEYS,
  lowIndicators,
  needsMedicalSentence,
  rectitudeIndex,
  typicality,
  typicalityLabel,
} from "@/lib/morpho";
import { buildMorphoResults, buildPartialResults, newReportNumber, partialText } from "@/lib/photoReport2";
import { globalScore, percentile, straightness } from "@/lib/stats";
import { simulatedReportText } from "@/lib/vision/simulation";

const base = { state: "erect" as const, lengthCm: 14.2, girthCm: 12.1, curvatureDeg: 8, direction: "left" as const, symmetry: 93, glansRatio: 0.24, taperRatio: 0.92 };
const versions = { schemaVersion: "photo-report/2", promptVersion: "photo-report-prompts/2" };

describe("indice de typicité (moyenne de 100 − 2 × |percentile − 50|)", () => {
  it("vaut 100 au centre, 0 aux extrêmes, et fait la moyenne des percentiles disponibles", () => {
    expect(typicality([50])).toBe(100);
    expect(typicality([0])).toBe(0);
    expect(typicality([100])).toBe(0);
    expect(typicality([75])).toBe(50);
    expect(typicality([25, 75])).toBe(50);
    expect(typicality([50, 90])).toBe(Math.round((100 + 20) / 2));
    expect(() => typicality([])).toThrow();
  });

  it("libellés : classique à partir de 70, distinctif de 40 à 69, singulier en dessous de 40", () => {
    expect(MORPHO.typicality).toEqual({ classicFrom: 70, distinctiveFrom: 40 });
    expect(typicalityLabel(100)).toBe("morphotype classique");
    expect(typicalityLabel(70)).toBe("morphotype classique");
    expect(typicalityLabel(69)).toBe("morphotype distinctif");
    expect(typicalityLabel(40)).toBe("morphotype distinctif");
    expect(typicalityLabel(39)).toBe("morphotype singulier");
    expect(typicalityLabel(0)).toBe("morphotype singulier");
  });
});

describe("indices sur 100", () => {
  it("rectitude axiale : 100 à 0°, même règle que le score, 0 à partir de 45°", () => {
    expect(rectitudeIndex(0)).toBe(100);
    expect(rectitudeIndex(9)).toBe(Math.round(100 * straightness(9)));
    expect(rectitudeIndex(45)).toBe(0);
    expect(rectitudeIndex(60)).toBe(0);
  });

  it("conicité distale : 100 pour une largeur constante, décroît avec l'écart au rapport 1, bornée", () => {
    expect(conicityIndex(1)).toBe(100);
    expect(conicityIndex(0.9)).toBe(80);
    expect(conicityIndex(1.1)).toBe(80);
    expect(conicityIndex(0.5)).toBe(0);
    expect(conicityIndex(0.3)).toBe(0);
  });
});

describe("indicateurs calculés par le code", () => {
  it("en érection : percentiles de longueur et de circonférence d'après Veale 2015 (configuration), score comme aujourd'hui", () => {
    const ind = computeIndicators(base);
    const e = REFERENCES.erect;
    expect(ind.percentileLongueur).toBeCloseTo(percentile(14.2, e.length.mean, e.length.sd), 1);
    expect(ind.percentileCirconference).toBeCloseTo(percentile(12.1, e.girth.mean, e.girth.sd), 1);
    expect(ind.medianeLongueurCm).toBe(e.length.mean);
    expect(ind.typicite).toBe(typicality([ind.percentileLongueur!, ind.percentileCirconference]));
    expect(ind.score).toBe(
      globalScore({ length: ind.percentileLongueur! / 100, girth: ind.percentileCirconference / 100, symmetry: 0.93, straightness: straightness(8) }),
    );
    expect(ind.symetrie).toBe(93);
    expect(ind.rectitude).toBe(rectitudeIndex(8));
    expect(ind.conicite).toBe(conicityIndex(0.92));
    expect(ind.courbureDirection).toBe("left");
  });

  it("au repos : AUCUN percentile de longueur ; seule la circonférence est positionnée (typicité et score sans la longueur)", () => {
    const ind = computeIndicators({ ...base, state: "rest", lengthCm: 9.6, girthCm: 9.5 });
    const f = REFERENCES.flaccid;
    expect(ind.percentileLongueur).toBeNull();
    expect(ind.percentileCirconference).toBeCloseTo(percentile(9.5, f.girth.mean, f.girth.sd), 1);
    expect(ind.typicite).toBe(typicality([ind.percentileCirconference]));
    expect(ind.score).toBe(globalScore({ girth: ind.percentileCirconference / 100, symmetry: 0.93, straightness: straightness(8) }));
    expect(indicatorValue(ind, "longueur")).toBe("9,6 cm"); // valeur seule, sans percentile
    expect(favourableIndicators(ind)).not.toContain("longueur");
  });

  it("une courbure de moins de 5° n'a pas de direction ; l'avis médical est demandé à partir de 30°", () => {
    expect(computeIndicators({ ...base, curvatureDeg: 3 }).courbureDirection).toBe("none");
    expect(needsMedicalSentence(computeIndicators({ ...base, curvatureDeg: 29 }))).toBe(false);
    expect(needsMedicalSentence(computeIndicators({ ...base, curvatureDeg: 30 }))).toBe(true);
  });

  it("indicateurs favorables : triés du plus fort au moins fort, au moins trois, jamais la courbure", () => {
    const ind = computeIndicators(base);
    const fav = favourableIndicators(ind);
    expect(fav.length).toBeGreaterThanOrEqual(3);
    expect(fav).not.toContain("courbure");
    const strength = (k: string) => (k === "longueur" ? ind.percentileLongueur! : k === "circonference" ? ind.percentileCirconference : (ind as never)[k === "rectitude" ? "rectitude" : k === "symetrie" ? "symetrie" : k === "conicite" ? "conicite" : "typicite"]);
    for (let i = 1; i < fav.length; i++) expect(strength(fav[i - 1])).toBeGreaterThanOrEqual(strength(fav[i]));
    for (const k of fav) expect(strength(k)).toBeGreaterThanOrEqual(MORPHO.favourableFrom);
  });

  it("valeurs basses (percentile < 25) : longueur et circonférence seulement", () => {
    expect(lowIndicators(computeIndicators(base))).toEqual([]);
    expect(lowIndicators(computeIndicators({ ...base, lengthCm: 11.3, girthCm: 10.4 }))).toEqual(["longueur", "circonference"]);
    expect(lowIndicators(computeIndicators({ ...base, state: "rest", lengthCm: 6, girthCm: 9.3 }))).toEqual([]); // au repos, la longueur n'est pas classée
  });

  it("valeurs affichées dans le tableau : virgule décimale, unités, libellé de typicité", () => {
    const ind = computeIndicators(base);
    expect(indicatorValue(ind, "longueur")).toMatch(/^14,2 cm · percentile \d+$/);
    expect(indicatorValue(ind, "courbure")).toBe("8° vers la gauche");
    expect(indicatorValue(ind, "typicite")).toBe(`${ind.typicite} / 100 · ${ind.typiciteLibelle}`);
    expect(INDICATOR_KEYS).toEqual(["longueur", "circonference", "courbure", "rectitude", "symetrie", "conicite", "typicite"]);
  });
});

describe("assemblage du rapport version 2", () => {
  it("numéro à 5 chiffres généré par le code", () => {
    for (let i = 0; i < 50; i++) expect(newReportNumber()).toMatch(/^[1-9]\d{4}$/);
  });

  it("rapport complet : champs communs remplis (carte, défi), percentile de longueur absent au repos", () => {
    const ind = computeIndicators({ ...base, state: "rest", lengthCm: 9.6, girthCm: 9.5 });
    const text = simulatedReportText({ indicators: ind, method: "visuelle", allowedHighlights: favourableIndicators(ind) });
    const r = buildMorphoResults({ formula: "B", indicators: ind, method: "visuelle", text, numero: "48213", versions });
    expect(r.length.percentile).toBeUndefined();
    expect(r.girth.percentile).toBe(ind.percentileCirconference);
    expect(r.score).toBe(ind.score);
    expect(r.morpho?.numero).toBe("48213");
    expect(r.morpho?.partielle).toBe(false);
    expect(r.comment).toBe(text.synthese);
  });

  it("rapport partiel : valeurs de référence de l'état déclaré, aucune mesure, aucun indicateur, aucun point remarquable", () => {
    for (const state of ["rest", "erect"] as const) {
      const r = buildPartialResults({ formula: "B", state, numero: "10000", versions });
      const ref = REFERENCES[state === "rest" ? "flaccid" : "erect"];
      expect(r.morpho?.partielle).toBe(true);
      expect(r.morpho?.methode).toBe("reference");
      expect(r.morpho?.indicateurs).toBeNull();
      expect(r.morpho?.reference).toEqual({ state, longueurMedianeCm: ref.length.mean, circonferenceMedianeCm: ref.girth.mean });
      expect(r.length.percentile).toBeUndefined();
      expect(r.girth.percentile).toBeUndefined();
      expect(r.morpho?.texte.points_remarquables).toEqual([]);
      const t = partialText(state);
      expect(t.synthese).toMatch(/Aucune valeur personnelle/);
      if (state === "rest") expect(t.note_laboratoire).toMatch(/érection donne une lecture complète des dimensions/);
    }
  });
});
