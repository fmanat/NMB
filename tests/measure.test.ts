import { describe, expect, it } from "vitest";
import { confidenceIndex, curvatureSigned, marginPct, symmetryScore, CARD_LONG_MM, CARD_SHORT_MM, cardHomography, curvatureDegrees, estimateMeasures, estimateMeasuresRuler, homography, project, sortCorners, type Pt } from "@/lib/measure";

// Simule une prise de vue : transforme des points en mm (plan de la carte) vers des pixels, avec perspective.
const W = 1600;
const H = 1200;
const mmToPx = homography(
  [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 150 }, { x: 0, y: 150 }],
  [{ x: 240, y: 260 }, { x: 1400, y: 300 }, { x: 1330, y: 1080 }, { x: 200, y: 1000 }],
);
const toNorm = (p: Pt): Pt => {
  const q = project(mmToPx, p);
  return { x: q.x / W, y: q.y / H };
};

function scene(lengthMm: number, widthMm: number) {
  const x0 = 100;
  const y0 = 100;
  const card = [
    { x: 20, y: 20 }, { x: 20 + CARD_LONG_MM, y: 20 }, { x: 20 + CARD_LONG_MM, y: 20 + CARD_SHORT_MM }, { x: 20, y: 20 + CARD_SHORT_MM },
  ];
  const line = Array.from({ length: 10 }, (_, i) => ({ x: x0 + (lengthMm * i) / 9, y: y0 }));
  const hs = ["base", "25", "50", "75", "sous_gland"];
  const edges = hs.map((hauteur, i) => {
    const x = x0 + (lengthMm * [0, 0.25, 0.5, 0.75, 0.95][i]);
    return { hauteur, gauche: toNorm({ x, y: y0 - widthMm / 2 }), droite: toNorm({ x, y: y0 + widthMm / 2 }) };
  });
  return {
    coins_carte: card.map(toNorm),
    base: toNorm(line[0]),
    extremite: toNorm(line[9]),
    ligne_mediane: line.slice(1, 9).map(toNorm),
    bords: edges,
  };
}

describe("homographie et mesures", () => {
  it("projette les coins sur eux-mêmes", () => {
    const h = homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 0, y: 3 }]);
    const p = project(h, { x: 0.5, y: 0.5 });
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(1.5, 9);
  });

  it("l'ordre des coins fournis par le modèle n'a pas d'importance", () => {
    const s = scene(130, 40);
    const shuffled = [s.coins_carte[2], s.coins_carte[0], s.coins_carte[3], s.coins_carte[1]];
    const a = estimateMeasures(s, W, H);
    const b = estimateMeasures({ ...s, coins_carte: shuffled }, W, H);
    expect(b.lengthCm).toBeCloseTo(a.lengthCm, 6);
  });

  it("retrouve longueur et largeur connues malgré la perspective", () => {
    const e = estimateMeasures(scene(130, 40), W, H);
    expect(e.lengthCm).toBeCloseTo(13, 1);
    expect(e.maxWidthCm).toBeCloseTo(4, 1);
    expect(e.girthFromMaxCm).toBeCloseTo(Math.PI * 4, 1);
    expect(e.curvatureDeg).toBeLessThan(1);
  });

  it("calcule la courbure d'un arc connu", () => {
    const line = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 8) * (Math.PI / 4); // arc de 45° au total
      return { x: Math.sin(a) * 100, y: (1 - Math.cos(a)) * 100 };
    });
    expect(curvatureDegrees(line)).toBeGreaterThan(20);
    expect(curvatureDegrees(line)).toBeLessThan(25);
  });

  it("refuse moins ou plus de 4 coins", () => {
    expect(() => sortCorners([{ x: 0, y: 0 }])).toThrow();
    expect(() => cardHomography([])).toThrow();
  });
});

describe("mesure avec une règle graduée", () => {
  // Vue de face, 10 px par mm : règle en pouces avec graduations 1 et 5 (4 pouces = 101,6 mm = 1016 px).
  const W2 = 2000;
  const H2 = 1500;
  const n = (x: number, y: number) => ({ x: x / W2, y: y / H2 });
  const subject = {
    base: n(200, 600),
    extremite: n(1200, 600), // 1000 px = 100 mm
    ligne_mediane: Array.from({ length: 8 }, (_, i) => n(200 + (1000 * (i + 1)) / 9, 600)),
    bords: ["base", "25", "50", "75", "sous_gland"].map((hauteur, i) => ({
      hauteur,
      gauche: n(200 + i * 200, 600 - 190),
      droite: n(200 + i * 200, 600 + 190), // largeur 380 px = 38 mm
    })),
  };

  it("retrouve longueur et largeur avec une règle en pouces", () => {
    const e = estimateMeasuresRuler(
      { ...subject, regle: { unite: "inch", graduation_a: { ...n(300, 1000), valeur: 1 }, graduation_b: { ...n(1316, 1000), valeur: 5 } } },
      W2,
      H2,
    );
    expect(e.lengthCm).toBeCloseTo(10, 1);
    expect(e.maxWidthCm).toBeCloseTo(3.8, 1);
    expect(e.girthFromMaxCm).toBeCloseTo(Math.PI * 3.8, 1);
  });

  it("donne le même résultat avec une règle en centimètres", () => {
    const e = estimateMeasuresRuler(
      { ...subject, regle: { unite: "cm", graduation_a: { ...n(300, 1000), valeur: 0 }, graduation_b: { ...n(1300, 1000), valeur: 10 } } },
      W2,
      H2,
    );
    expect(e.lengthCm).toBeCloseTo(10, 1);
  });

  it("refuse deux graduations identiques", () => {
    expect(() =>
      estimateMeasuresRuler(
        { ...subject, regle: { unite: "cm", graduation_a: { ...n(300, 1000), valeur: 2 }, graduation_b: { ...n(900, 1000), valeur: 2 } } },
        W2,
        H2,
      ),
    ).toThrow();
  });
});

describe("symétrie, conicité, confiance et marge", () => {
  it("symétrie proche de 100 pour un sujet symétrique, plus basse sinon", () => {
    const sym = estimateMeasures(scene(130, 40), W, H);
    expect(sym.symmetry).toBeGreaterThan(98);
    const line = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 }));
    const asym = symmetryScore(line, [{ gauche: { x: 20, y: -15 }, droite: { x: 20, y: 25 } }]);
    expect(asym).toBeCloseTo(50, 5);
  });

  it("conicité : largeur sous le gland / largeur à la base", () => {
    const s = scene(130, 40);
    // élargit la base : bord base deux fois plus large que les autres
    const tapered = {
      ...s,
      bords: s.bords.map((b, i) => (i === 0 ? { ...b, gauche: { ...b.gauche, y: b.gauche.y - 0.03 }, droite: { ...b.droite, y: b.droite.y + 0.03 } } : b)),
    };
    expect(estimateMeasures(s, W, H).taper).toBeCloseTo(1, 1);
    expect(estimateMeasures(tapered, W, H).taper).toBeLessThan(0.9);
  });

  it("courbure signée : droite et gauche de signes opposés", () => {
    const arc = (sign: number) =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 8) * (Math.PI / 4);
        return { x: Math.sin(a) * 100, y: sign * (1 - Math.cos(a)) * 100 };
      });
    expect(curvatureSigned(arc(1))).toBeGreaterThan(15);
    expect(curvatureSigned(arc(-1))).toBeLessThan(-15);
  });

  it("indice de confiance : moyenne des confiances, en pourcentage", () => {
    const s = scene(130, 40);
    const withConf = (c: number) => {
      const f = <T extends object>(p: T) => ({ ...p, confiance: c });
      return { ...s, coins_carte: s.coins_carte.map(f), base: f(s.base), extremite: f(s.extremite), ligne_mediane: s.ligne_mediane.map(f), bords: s.bords.map((b) => ({ ...b, gauche: f(b.gauche), droite: f(b.droite) })) };
    };
    expect(confidenceIndex(withConf(0.8))).toBeCloseTo(80, 6);
    expect(confidenceIndex(s)).toBe(0);
  });

  it("marge : jamais sous 10 %, augmente avec la faible confiance et la perspective", () => {
    const cfg = { floorPct: 10, perConfidencePct: 50, perspectivePct: 20 };
    expect(marginPct(100, 1, cfg)).toBe(10);
    expect(marginPct(95, 1, cfg)).toBe(10);
    expect(marginPct(60, 1, cfg)).toBe(20);
    expect(marginPct(60, 1.25, cfg)).toBe(25);
    expect(marginPct(0, 1, cfg)).toBe(50);
  });
});

