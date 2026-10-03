import { describe, expect, it } from "vitest";
import { calibrationSummary, summarizeDim } from "@/lib/admin/calibration";

const pair = (cardL: number, modelL: number, cardG = 12, modelG = 12) => ({ cardLengthCm: cardL, modelLengthCm: modelL, cardGirthCm: cardG, modelGirthCm: modelG });

describe("calibration du modèle : paires (mesure par la carte, estimation sans la carte)", () => {
  it("aucune paire : tranches vides, aucune moyenne, aucune pente", () => {
    const s = summarizeDim([], "length");
    expect(s.n).toBe(0);
    expect(s.bands.map((b) => b.n)).toEqual([0, 0, 0, 0, 0]);
    expect(s.bands.every((b) => b.meanGapCm === null)).toBe(true);
    expect(s.slope).toBeNull();
  });

  it("estimations parfaites : écart nul partout, pente 1", () => {
    const s = summarizeDim([pair(10, 10), pair(14, 14), pair(18, 18)], "length");
    expect(s.meanGapPct).toBe(0);
    expect(s.slope).toBeCloseTo(1, 9);
  });

  it("retour vers la moyenne : écart positif dans les petites tranches, négatif dans les grandes, pente < 1", () => {
    // Le modèle répond toujours 13 + 0,5 × (mesure − 13).
    const pairs = [10, 12, 14, 16, 18].map((c) => pair(c, 13 + 0.5 * (c - 13)));
    const s = summarizeDim(pairs, "length");
    expect(s.bands.map((b) => b.label)).toEqual(["moins de 11 cm", "11 à 13 cm", "13 à 15 cm", "15 à 17 cm", "17 cm et plus"]);
    expect(s.bands.map((b) => b.n)).toEqual([1, 1, 1, 1, 1]);
    expect(s.bands[0].meanGapCm).toBeCloseTo(1.5, 9);
    expect(s.bands[4].meanGapCm).toBeCloseTo(-2.5, 9);
    expect(s.bands[0].meanGapPct).toBeCloseTo(15, 9);
    expect(s.slope).toBeCloseTo(0.5, 9);
  });

  it("une tranche contient sa borne basse ; longueur et circonférence sont résumées séparément", () => {
    const s = calibrationSummary([pair(11, 11, 10, 11), pair(13, 13, 14.5, 14)]);
    expect(s.length.bands.map((b) => b.n)).toEqual([0, 1, 1, 0, 0]);
    expect(s.girth.bands.map((b) => b.n)).toEqual([0, 1, 0, 0, 1]);
    expect(s.girth.bands[1].meanGapCm).toBeCloseTo(1, 9);
  });
});
