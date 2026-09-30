import { describe, expect, it } from "vitest";
import { globalScore, normalCdf, percentile, straightness } from "@/lib/stats";
import { buildQuestionnaireReport, isOutOfReferenceRange, questionnaireSchema } from "@/lib/report";
import { SCORE } from "@/config/site";

describe("loi normale", () => {
  it("valeurs connues", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1.96)).toBeCloseTo(0.0249979, 5);
    expect(normalCdf(3)).toBeCloseTo(0.99865, 4);
  });
  it("percentile de la moyenne = 50, à +1 écart-type = 84,1", () => {
    expect(percentile(13.12, 13.12, 1.66)).toBeCloseTo(50, 4);
    expect(percentile(13.12 + 1.66, 13.12, 1.66)).toBeCloseTo(84.13, 1);
  });
});

describe("rectitude", () => {
  it("1 à 0°, 0 à 45° et au-delà", () => {
    expect(straightness(0)).toBe(1);
    expect(straightness(22.5)).toBeCloseTo(0.5, 6);
    expect(straightness(45)).toBe(0);
    expect(straightness(80)).toBe(0);
  });
});

describe("score global", () => {
  it("plancher 40 et plafond 98", () => {
    expect(globalScore({ length: 0, girth: 0, symmetry: 0, straightness: 0 })).toBe(SCORE.floor);
    expect(globalScore({ length: 1, girth: 1, symmetry: 1, straightness: 1 })).toBe(SCORE.ceiling);
  });
  it("suit 40 + 58 × P^0,85", () => {
    expect(globalScore({ length: 0.5, girth: 0.5, symmetry: 0.5, straightness: 0.5 })).toBe(
      Math.round(40 + 58 * Math.pow(0.5, 0.85)),
    );
  });
  it("renormalise quand une composante manque", () => {
    expect(globalScore({ length: 0.5, girth: 0.5, straightness: 0.5 })).toBe(
      globalScore({ length: 0.5, girth: 0.5, symmetry: 0.5, straightness: 0.5 }),
    );
  });
  it("un profil médian sans courbure donne un score entre 72 et 78", () => {
    const r = buildQuestionnaireReport({
      state: "erect",
      length: 13.12,
      girth: 11.66,
      curvature: "none",
      direction: "none",
    });
    expect(r.score).toBeGreaterThanOrEqual(72);
    expect(r.score).toBeLessThanOrEqual(78);
  });
  it("le score est croissant avec la longueur", () => {
    const base = { state: "rest", girth: 9.31, curvature: "none", direction: "none" } as const;
    expect(buildQuestionnaireReport({ ...base, length: 12 }).score).toBeGreaterThan(
      buildQuestionnaireReport({ ...base, length: 8 }).score,
    );
  });
});

describe("rapport formule A", () => {
  it("mentionne un avis médical si courbure marquée, sinon non", () => {
    const base = { state: "erect", length: 13, girth: 11.5, direction: "left" } as const;
    expect(buildQuestionnaireReport({ ...base, curvature: "marked" }).comment).toContain("avis médical");
    expect(buildQuestionnaireReport({ ...base, curvature: "light" }).comment).not.toContain("avis médical");
  });
  it("ne présente jamais un percentile à 0 ou 100", () => {
    const hi = buildQuestionnaireReport({ state: "rest", length: 25, girth: 20, curvature: "none", direction: "none" });
    expect(hi.length.percentile).toBe(99.9);
    const lo = buildQuestionnaireReport({ state: "erect", length: 4, girth: 5, curvature: "none", direction: "none" });
    expect(lo.length.percentile).toBe(0.1);
  });
  it("refuse au-delà de 4 écarts-types de la moyenne de référence de l'état", () => {
    // repos : longueur 9,16 (σ 1,57) -> limite haute 15,44 ; circonférence 9,31 (σ 0,90) -> limite haute 12,91
    expect(isOutOfReferenceRange({ state: "rest", length: 15.4, girth: 9 })).toBe(false);
    expect(isOutOfReferenceRange({ state: "rest", length: 15.5, girth: 9 })).toBe(true);
    expect(isOutOfReferenceRange({ state: "rest", length: 9, girth: 12.95 })).toBe(true);
    // la même longueur est plausible en érection (13,12 ± 6,64) mais pas au repos
    expect(isOutOfReferenceRange({ state: "erect", length: 15.5, girth: 11.6 })).toBe(false);
    // vers le bas aussi : repos, longueur 9,16 - 6,28 = 2,88
    expect(isOutOfReferenceRange({ state: "rest", length: 2.8, girth: 9 })).toBe(true);
  });
  it("refuse les valeurs invraisemblables", () => {
    const ok = { state: "rest", length: 9, girth: 9, curvature: "none", direction: "none" };
    expect(questionnaireSchema.safeParse(ok).success).toBe(true);
    expect(questionnaireSchema.safeParse({ ...ok, length: 80 }).success).toBe(false);
    expect(questionnaireSchema.safeParse({ ...ok, girth: 0 }).success).toBe(false);
    expect(questionnaireSchema.safeParse({ ...ok, state: "autre" }).success).toBe(false);
  });
});
