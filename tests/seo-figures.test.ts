import { describe, expect, it } from "vitest";
import { REFERENCES } from "@/config/site";
import { buildQuestionnaireReport } from "@/lib/reportCore";
import { evalFigure, FigureError, perThousandBelow, rankLabel, rawPercentile, resolveFigureTokens, shownPercentile } from "@/lib/seoFigures";
import { normalCdf, normalQuantile, percentile, valueAtPercentile } from "@/lib/stats";
import { aboveText } from "@/lib/format";
import { frInt } from "@/lib/ticker";

describe("quantile de la loi normale", () => {
  it("inverse exact de la fonction de répartition", () => {
    for (const p of [0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 0.999]) expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 6);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(() => normalQuantile(0)).toThrow();
    expect(() => normalQuantile(1)).toThrow();
  });

  it("valeur au percentile : la médiane est la moyenne publiée", () => {
    const { mean, sd } = REFERENCES.erect.length;
    expect(valueAtPercentile(50, mean, sd)).toBeCloseTo(mean, 9);
    expect(percentile(valueAtPercentile(90, mean, sd), mean, sd)).toBeCloseTo(90, 4); // précision de l'approximation de erf
  });
});

describe("chiffres des pages de contenu : mêmes calculs que le rapport", () => {
  it("le percentile affiché est celui du rapport du questionnaire", () => {
    for (const cm of [10, 13.8, 14, 17]) {
      const report = buildQuestionnaireReport({ state: "erect", length: cm, girth: 11.7, curvature: "none", direction: "none" });
      expect(shownPercentile("erect-length", cm)).toBe(report.length.percentile);
    }
  });

  it("rang : partie entière, jamais arrondi à la hausse, cohérent avec « Au-dessus de X % »", () => {
    const p = shownPercentile("erect-length", 13.8);
    expect(rankLabel(rawPercentile("erect-length", 13.8))).toBe(`${Math.floor(p)}e percentile`);
    expect(aboveText(p)).toContain(`${Math.floor(p)} %`);
    expect(rankLabel(0.5)).toBe("sous le 1er percentile");
    expect(rankLabel(1.4)).toBe("1er percentile");
    expect(rankLabel(99.95)).toBe("au-delà du 99e percentile");
  });

  it("sur 1 000 hommes : partie entière du percentile affiché × 10", () => {
    expect(perThousandBelow("erect-length", 14)).toBe(Math.floor(shownPercentile("erect-length", 14) * 10));
  });

  it("jetons : valeurs mises en forme à la française", () => {
    expect(evalFigure("moyenne:erect-length")).toBe("13,12 cm");
    expect(evalFigure("ecart-type:erect-girth")).toBe("1,1 cm");
    expect(evalFigure("effectif:erect-length")).toBe("692");
    expect(evalFigure("effectif-total")).toBe(`15${frInt(1000).charAt(1)}521`); // même séparateur de milliers que le reste du site
    expect(evalFigure("pct:erect-length:13.12")).toBe("50 %");
    expect(evalFigure("quantile:erect-length:50")).toBe("13,1 cm");
    expect(evalFigure("sigma:erect-length:16.44")).toBe("2");
    expect(evalFigure("max-sigma")).toBe("4");
  });

  it("jeton inconnu ou mal formé : erreur explicite avec l'emplacement", () => {
    expect(() => evalFigure("inconnu")).toThrow(FigureError);
    expect(() => evalFigure("pct:erect-taille:14")).toThrow(/série inconnue/);
    expect(() => evalFigure("pct:erect-length")).toThrow(/manquant/);
    expect(() => evalFigure("entre:erect-length:14:12")).toThrow(/borne haute/);
    expect(() => resolveFigureTokens("Texte {{nimporte}} fin", "page.md, corps")).toThrow(/page\.md, corps/);
    expect(resolveFigureTokens("Moyenne : {{ moyenne:erect-length }}.", "x")).toBe("Moyenne : 13,12 cm.");
  });
});
