import { describe, expect, it } from "vitest";
import { errorPct, MIN_SAMPLES_FOR_MARGIN, quantile, suggestedMargin, summarize } from "@/lib/calibration";

describe("calibration", () => {
  it("écart en pourcentage, signé", () => {
    expect(errorPct(11, 10)).toBeCloseTo(10, 9);
    expect(errorPct(9, 10)).toBeCloseTo(-10, 9);
  });

  it("quantiles par interpolation", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.9)).toBeCloseTo(9, 9);
    expect(quantile([], 0.5)).toBeNaN();
    expect(quantile([7], 0.9)).toBe(7);
  });

  it("résumé : biais, erreur absolue, part dans 10 % et dans la marge affichée", () => {
    const s = summarize([
      { real: 10, est: 11, marginPct: 10 }, // +10 %
      { real: 10, est: 9, marginPct: 10 }, // -10 %
      { real: 10, est: 12, marginPct: 10 }, // +20 % hors marge
      { real: 10, est: 10, marginPct: 10 }, // 0
    ])!;
    expect(s.n).toBe(4);
    expect(s.meanSignedPct).toBeCloseTo(5, 6);
    expect(s.meanAbsPct).toBeCloseTo(10, 6);
    expect(s.within10).toBe(0.75);
    expect(s.withinMargin).toBe(0.75);
  });

  it("aucune donnée : pas de résumé", () => {
    expect(summarize([])).toBeNull();
  });

  it("marge suggérée : refusée sous 15 mesures, jamais sous le plancher", () => {
    const few = summarize(Array.from({ length: MIN_SAMPLES_FOR_MARGIN - 1 }, () => ({ real: 10, est: 10.2, marginPct: 10 })))!;
    expect(suggestedMargin(few, 10)).toBeNull();
    const good = summarize(Array.from({ length: 20 }, () => ({ real: 10, est: 10.2, marginPct: 10 })))!;
    expect(suggestedMargin(good, 10)).toBe(10); // écart de 2 % : le plancher s'applique
    const bad = summarize(Array.from({ length: 20 }, () => ({ real: 10, est: 13.3, marginPct: 10 })))!;
    expect(suggestedMargin(bad, 10)).toBe(34); // 33 % arrondi au supérieur
  });
});
