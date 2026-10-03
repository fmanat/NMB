import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REFERENCES } from "@/config/site";
import { exampleReport } from "@/lib/exampleReport";
import {
  LENGTH_TO_DIAMETER,
  MAX_RENDER_BEND_DEG,
  PROFILE,
  RING_PARAMS,
  SCAN_DISC_RADIUS,
  SILHOUETTE_DIAMETER,
  SILHOUETTE_LENGTH,
  SILHOUETTE_REFERENCE,
  SILHOUETTE_SHAFT_RADIUS,
  axisFrame,
  axisPoint,
  generateSilhouettePoints,
  radiusAt,
  radiusProfile,
  renderedBendRad,
  ringFactor,
  scanDisc,
  scanFraction,
  silhouetteAxis,
  silhouetteRing,
  silhouetteSpec,
  surfacePoint,
  type BendDirection,
} from "@/lib/scannerSilhouette";

// Géométrie de la silhouette du moteur animé (bandeau scanner de l'accueil) : fonction pure, jamais utilisée ailleurs
// (voir tests/scanner-separation.test.ts).

const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;
const grid = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe("proportions : lues dans les constantes de référence du site", () => {
  it("le rapport longueur / diamètre vient des moyennes de Veale 2015 en érection (longueur et circonférence / π)", () => {
    expect(SILHOUETTE_REFERENCE.length).toBe(REFERENCES.erect.length.mean);
    expect(SILHOUETTE_REFERENCE.girth).toBe(REFERENCES.erect.girth.mean);
    expect(SILHOUETTE_DIAMETER).toBeCloseTo(REFERENCES.erect.girth.mean / Math.PI, 12);
    expect(LENGTH_TO_DIAMETER).toBeCloseTo(REFERENCES.erect.length.mean / (REFERENCES.erect.girth.mean / Math.PI), 12);
    // Valeur attendue avec 13,1 cm et 11,7 cm (chiffres du propriétaire) : 13,1 / (11,7 / π) ≈ 3,52 ; avec les constantes du code ≈ 3,53.
    expect(LENGTH_TO_DIAMETER).toBeGreaterThan(3.5);
    expect(LENGTH_TO_DIAMETER).toBeLessThan(3.56);
    expect(13.1 / (11.7 / Math.PI)).toBeCloseTo(LENGTH_TO_DIAMETER, 1);
  });

  it("l'objet de la scène respecte ce rapport (longueur / diamètre du fût)", () => {
    expect(SILHOUETTE_LENGTH / (2 * SILHOUETTE_SHAFT_RADIUS)).toBeCloseTo(LENGTH_TO_DIAMETER, 12);
    const spec = silhouetteSpec();
    expect(spec.length / (2 * spec.shaftRadius)).toBeCloseTo(LENGTH_TO_DIAMETER, 12);
  });

  it("les nombres de référence ne sont écrits en dur ni dans la géométrie ni dans le moteur", () => {
    for (const f of ["src/lib/scannerSilhouette.ts", "src/components/scanner/scannerEngine.ts"]) {
      const code = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)) // hors commentaires
        .join("\n");
      for (const lit of ["13.12", "11.66", "13.1", "11.7", "13,1", "11,7", "1.66", "3.53", "3.52", "3.7"]) {
        expect(code.includes(lit), `${f} contient ${lit}`).toBe(false);
      }
    }
  });
});

describe("profil de rayon r(t)", () => {
  const ts = grid(2000);

  it("est fini et jamais négatif sur [0, 1], valant 1 à la base et 0 à l'extrémité", () => {
    for (const t of ts) {
      const r = radiusProfile(t);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThanOrEqual(0);
    }
    expect(radiusProfile(0)).toBe(1);
    expect(radiusProfile(1)).toBe(0);
  });

  it("ramène t hors intervalle (et non fini) dans [0, 1] sans NaN", () => {
    expect(radiusProfile(-3)).toBe(radiusProfile(0));
    expect(radiusProfile(7)).toBe(radiusProfile(1));
    expect(radiusProfile(NaN)).toBe(radiusProfile(0));
    expect(radiusProfile(Infinity)).toBe(radiusProfile(0));
  });

  it("le fût est de rayon constant jusqu'à l'amont de la collerette", () => {
    const end = PROFILE.collarAt - PROFILE.collarWidth;
    for (const t of ts.filter((x) => x <= end)) expect(radiusProfile(t)).toBe(1);
  });

  it("présente un léger rétrécissement à la jonction, puis un renflement arrondi plus large que le fût, puis se referme", () => {
    const collar = radiusProfile(PROFILE.collarAt);
    expect(collar).toBeCloseTo(1 - PROFILE.collarDepth, 12);
    expect(collar).toBeLessThan(1);
    expect(collar).toBeGreaterThan(0.9); // un rétrécissement léger, pas une encoche
    const max = Math.max(...ts.map(radiusProfile));
    expect(max).toBeCloseTo(1 + PROFILE.swell, 9);
    expect(radiusProfile(PROFILE.swellEnd)).toBeCloseTo(max, 12);
    expect(max).toBeGreaterThan(1);
  });

  it("est monotone là où attendu : décroissant vers la collerette, croissant jusqu'au renflement, décroissant jusqu'à l'extrémité", () => {
    const seg = (a: number, b: number, n = 400) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n).map(radiusProfile);
    const nonDecreasing = (v: number[]) => v.every((x, i) => i === 0 || x >= v[i - 1] - 1e-12);
    const nonIncreasing = (v: number[]) => v.every((x, i) => i === 0 || x <= v[i - 1] + 1e-12);
    expect(nonIncreasing(seg(PROFILE.collarAt - PROFILE.collarWidth, PROFILE.collarAt))).toBe(true);
    expect(nonDecreasing(seg(PROFILE.collarAt, PROFILE.swellEnd))).toBe(true);
    expect(nonIncreasing(seg(PROFILE.swellEnd, 1))).toBe(true);
  });

  it("est lisse : continu partout, sans saut de pente aux raccords, sans pente excessive (hors extrémité arrondie)", () => {
    const h = 1e-5;
    const slope = (t: number) => (radiusProfile(t + h) - radiusProfile(t - h)) / (2 * h);
    // Pente bornée jusqu'au renflement (la calotte arrondie du bout, elle, finit par une tangente verticale en t = 1).
    for (const t of grid(1000).filter((x) => x > 0 && x <= PROFILE.swellEnd)) expect(Math.abs(slope(t))).toBeLessThan(6);
    // Raccords : la pente ne saute pas.
    for (const t of [PROFILE.collarAt - PROFILE.collarWidth, PROFILE.collarAt, PROFILE.collarAt + PROFILE.collarWidth, PROFILE.swellEnd]) {
      const left = (radiusProfile(t) - radiusProfile(t - 2 * h)) / (2 * h);
      const right = (radiusProfile(t + 2 * h) - radiusProfile(t)) / (2 * h);
      expect(Math.abs(left - right), `raccord t = ${t}`).toBeLessThan(0.05);
    }
    // Continu : aucun écart brusque entre deux points voisins.
    for (let i = 1; i < ts.length * 0.95; i++) expect(Math.abs(radiusProfile(ts[i]) - radiusProfile(ts[i - 1]))).toBeLessThan(0.01);
  });

  it("l'extrémité est arrondie (calotte) : le rayon décroît comme une racine, sans pointe", () => {
    // Pointe aiguë (cône) : rayon proportionnel à la distance à l'extrémité. Calotte arrondie : bien plus large près de l'extrémité.
    const d = 0.01;
    const cone = (1 + PROFILE.swell) * (d / (1 - PROFILE.swellEnd));
    expect(radiusProfile(1 - d)).toBeGreaterThan(3 * cone);
  });

  it("le rayon absolu est le rayon relatif × rayon du fût", () => {
    for (const t of [0, 0.3, 0.8, 0.9, 1]) expect(radiusAt(t)).toBeCloseTo(SILHOUETTE_SHAFT_RADIUS * radiusProfile(t), 12);
    expect(radiusAt(0.5, 2)).toBeCloseTo(2 * radiusProfile(0.5), 12);
  });
});

describe("courbure de l'axe : dérivée du rapport d'exemple et bornée", () => {
  const ex = exampleReport();

  it("l'angle et la direction viennent du rapport d'exemple (aucun chiffre inventé)", () => {
    const spec = silhouetteSpec(ex.curvature);
    expect(spec.bendRad).toBeCloseTo((ex.curvature.angleDeg * Math.PI) / 180, 12);
    expect(ex.curvature.direction).toBe("left");
    expect(spec.bendDir).toEqual({ x: -1, z: 0 });
    // L'exemple est « légèrement » incurvé : non nul et sous la borne de rendu.
    expect(ex.curvature.angleDeg).toBeGreaterThan(0);
    expect(ex.curvature.angleDeg).toBeLessThanOrEqual(MAX_RENDER_BEND_DEG);
  });

  it("l'angle rendu est borné (valeur absolue, plafond, non fini = 0)", () => {
    expect(renderedBendRad(0)).toBe(0);
    expect(renderedBendRad(10)).toBeCloseTo((10 * Math.PI) / 180, 12);
    expect(renderedBendRad(-10)).toBeCloseTo((10 * Math.PI) / 180, 12);
    expect(renderedBendRad(35)).toBeCloseTo((MAX_RENDER_BEND_DEG * Math.PI) / 180, 12);
    expect(renderedBendRad(1e6)).toBeCloseTo((MAX_RENDER_BEND_DEG * Math.PI) / 180, 12);
    expect(renderedBendRad(NaN)).toBe(0);
    expect(renderedBendRad(Infinity)).toBe(0);
    expect(MAX_RENDER_BEND_DEG).toBeLessThanOrEqual(25); // « légèrement incurvé »
  });

  it("sans direction ou sans spécification : axe parfaitement droit", () => {
    for (const spec of [silhouetteSpec(), silhouetteSpec({ angleDeg: 15, direction: "none" }), silhouetteSpec({ angleDeg: 0, direction: "left" })]) {
      expect(spec.bendRad).toBe(0);
      for (const t of grid(20)) {
        const p = axisPoint(spec, t);
        expect(p.x).toBeCloseTo(0, 12);
        expect(p.z).toBeCloseTo(0, 12);
      }
    }
  });

  const dirs = ["left", "right", "up", "down"] as const satisfies readonly BendDirection[];
  for (const direction of dirs) {
    it(`direction « ${direction} » : l'axe garde sa longueur, s'incurve de l'angle voulu dans le bon sens et reste centré`, () => {
      const spec = silhouetteSpec({ angleDeg: 15, direction });
      // Longueur de l'axe = longueur de l'objet (somme des segments, erreur de corde négligeable).
      const axis = silhouetteAxis(spec, 400);
      let len = 0;
      for (let i = 3; i < axis.length; i += 3) len += Math.hypot(axis[i] - axis[i - 3], axis[i + 1] - axis[i - 2], axis[i + 2] - axis[i - 1]);
      expect(len).toBeCloseTo(spec.length, 3);
      // Angle entre la tangente de la base et celle de l'extrémité = angle rendu.
      const t0 = axisFrame(spec, 0).T;
      const t1 = axisFrame(spec, 1).T;
      expect(Math.acos(Math.min(1, dot(t0, t1)))).toBeCloseTo(spec.bendRad, 9);
      // Repère orthonormé tout du long.
      for (const t of grid(10)) {
        const { T, N, B } = axisFrame(spec, t);
        expect(dot(T, T)).toBeCloseTo(1, 9);
        expect(dot(N, N)).toBeCloseTo(1, 9);
        expect(dot(B, B)).toBeCloseTo(1, 9);
        expect(dot(T, N)).toBeCloseTo(0, 9);
        expect(dot(T, B)).toBeCloseTo(0, 9);
        expect(dot(N, B)).toBeCloseTo(0, 9);
      }
      // Sens : l'extrémité s'écarte de la base du côté demandé, et seulement de ce côté.
      const a = axisPoint(spec, 0);
      const b = axisPoint(spec, 1);
      const sign = { left: [-1, 0], right: [1, 0], up: [0, 1], down: [0, -1] }[direction];
      expect((b.x - a.x) * sign[0] + (b.z - a.z) * sign[1]).toBeGreaterThan(0.05);
      expect(Math.abs((b.x - a.x) * sign[1]) + Math.abs((b.z - a.z) * sign[0])).toBeLessThan(1e-9);
      // Bornée : l'écart latéral reste modeste (« légèrement incurvé » : moins d'un diamètre et demi... de l'axe droit, ici < 20 % de la longueur).
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.2 * spec.length);
      // Centré : le milieu de la corde est à l'origine.
      expect((a.x + b.x) / 2).toBeCloseTo(0, 9);
      expect((a.y + b.y) / 2).toBeCloseTo(0, 9);
      expect((a.z + b.z) / 2).toBeCloseTo(0, 9);
      // La base monte (y croissant) : l'axe est orienté de la base vers l'extrémité.
      expect(b.y).toBeGreaterThan(a.y);
    });
  }

  it("la courbure maximale rendue reste « légère » : angle total ≤ borne, écart latéral de l'extrémité < 20 % de la longueur", () => {
    const spec = silhouetteSpec({ angleDeg: 90, direction: "right" });
    expect(spec.bendRad).toBeCloseTo((MAX_RENDER_BEND_DEG * Math.PI) / 180, 12);
    const a = axisPoint(spec, 0);
    const b = axisPoint(spec, 1);
    expect(Math.abs(b.x - a.x)).toBeLessThan(0.2 * spec.length);
  });
});

describe("nuage de points de la silhouette", () => {
  const specs = [
    silhouetteSpec(),
    silhouetteSpec(exampleReport().curvature),
    silhouetteSpec({ angleDeg: 35, direction: "right" }),
    silhouetteSpec({ angleDeg: 15, direction: "up" }),
  ];

  it("donne un nombre de points proche de la demande, en triplets, avec un paramètre axial par point", () => {
    for (const spec of specs) {
      const { points, params } = generateSilhouettePoints(spec, 800, 7);
      expect(points.length % 3).toBe(0);
      expect(params.length).toBe(points.length / 3);
      expect(points.length / 3).toBeGreaterThan(800 * 0.88);
      expect(points.length / 3).toBeLessThan(800 * 1.15);
    }
  });

  it("aucun point NaN ni infini, paramètres dans ]0, 1[, pour de petits et de gros nombres de points", () => {
    for (const spec of specs) {
      for (const c of [1, 10, 50, 460, 800, 3000]) {
        const { points, params } = generateSilhouettePoints(spec, c, 3);
        expect(points.length).toBeGreaterThan(0);
        expect(Array.from(points).every(Number.isFinite)).toBe(true);
        for (const t of params) {
          expect(Number.isFinite(t)).toBe(true);
          expect(t).toBeGreaterThan(0);
          expect(t).toBeLessThan(1);
        }
      }
    }
  });

  it("est déterministe pour une même graine et change avec une autre", () => {
    const spec = specs[1];
    const a = generateSilhouettePoints(spec, 460, 11);
    const b = generateSilhouettePoints(spec, 460, 11);
    expect(Array.from(a.points)).toEqual(Array.from(b.points));
    expect(Array.from(a.params)).toEqual(Array.from(b.params));
    expect(Array.from(generateSilhouettePoints(spec, 460, 12).points)).not.toEqual(Array.from(a.points));
    // Graine par défaut stable d'un appel à l'autre.
    expect(Array.from(generateSilhouettePoints(spec, 200).points)).toEqual(Array.from(generateSilhouettePoints(spec, 200).points));
  });

  it("chaque point est exactement sur la surface : à la distance du rayon local de l'axe, dans le plan de coupe", () => {
    for (const spec of specs) {
      const { points, params } = generateSilhouettePoints(spec, 900, 5);
      for (let i = 0; i < params.length; i++) {
        const p = { x: points[i * 3], y: points[i * 3 + 1], z: points[i * 3 + 2] };
        const t = params[i];
        const c = axisPoint(spec, t);
        const d = { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z };
        const { T } = axisFrame(spec, t);
        expect(Math.abs(dot(d, T))).toBeLessThan(2e-6); // dans le plan perpendiculaire à l'axe
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(radiusAt(t, spec.shaftRadius), 4);
      }
    }
  });

  it("couvre toute la longueur, des deux côtés, et le renflement est plus large que le fût", () => {
    const spec = specs[1];
    const { points, params } = generateSilhouettePoints(spec, 900, 5);
    expect(Math.min(...params)).toBeLessThan(0.05);
    expect(Math.max(...params)).toBeGreaterThan(0.97);
    // Les 10 tranches égales de l'axe contiennent toutes des points.
    const buckets = new Array<number>(10).fill(0);
    for (const t of params) buckets[Math.min(9, Math.floor(t * 10))]++;
    expect(buckets.every((n) => n > 5)).toBe(true);
    // Écart maximal à l'axe : celui du renflement (plus large que le fût).
    let widest = 0;
    for (let i = 0; i < params.length; i++) {
      const c = axisPoint(spec, params[i]);
      widest = Math.max(widest, Math.hypot(points[i * 3] - c.x, points[i * 3 + 1] - c.y, points[i * 3 + 2] - c.z));
    }
    expect(widest).toBeGreaterThan(spec.shaftRadius * 1.05);
  });

  it("l'étendue du nuage respecte le rapport longueur / diamètre (axe droit)", () => {
    const spec = silhouetteSpec();
    const { points } = generateSilhouettePoints(spec, 3000, 9);
    let minY = Infinity;
    let maxY = -Infinity;
    let maxR = 0;
    for (let i = 0; i < points.length; i += 3) {
      minY = Math.min(minY, points[i + 1]);
      maxY = Math.max(maxY, points[i + 1]);
      maxR = Math.max(maxR, Math.hypot(points[i], points[i + 2]));
    }
    const ratio = (maxY - minY) / (2 * spec.shaftRadius);
    expect(ratio).toBeGreaterThan(LENGTH_TO_DIAMETER * 0.97);
    expect(ratio).toBeLessThanOrEqual(LENGTH_TO_DIAMETER * 1.0001);
    expect(maxR).toBeLessThanOrEqual(spec.shaftRadius * (1 + PROFILE.swell) + 1e-6);
  });

  it("surfacePoint est cohérent avec l'axe et le rayon (facteur 0 = l'axe, 1 = la surface)", () => {
    const spec = specs[2];
    const t = 0.6;
    const c = axisPoint(spec, t);
    const onAxis = surfacePoint(spec, t, 1.3, 0);
    expect(onAxis.x).toBeCloseTo(c.x, 12);
    expect(onAxis.y).toBeCloseTo(c.y, 12);
    expect(onAxis.z).toBeCloseTo(c.z, 12);
    const s = surfacePoint(spec, t, 1.3, 1);
    expect(Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z)).toBeCloseTo(radiusAt(t, spec.shaftRadius), 9);
  });
});

describe("anneaux de mesure, disque de balayage, axe", () => {
  const spec = silhouetteSpec(exampleReport().curvature);

  it("un anneau est un cercle fermé perpendiculaire à l'axe, à rayon relatif constant, au-dessus de la surface", () => {
    for (let k = 0; k < RING_PARAMS.length; k++) {
      const t = RING_PARAMS[k];
      const f = ringFactor(k, RING_PARAMS.length);
      expect(f).toBeGreaterThanOrEqual(1);
      const ring = silhouetteRing(spec, t, f, 36);
      expect(ring.length).toBe(37 * 3);
      expect(Array.from(ring).every(Number.isFinite)).toBe(true);
      const c = axisPoint(spec, t);
      const { T } = axisFrame(spec, t);
      for (let i = 0; i <= 36; i++) {
        const d = { x: ring[i * 3] - c.x, y: ring[i * 3 + 1] - c.y, z: ring[i * 3 + 2] - c.z };
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(radiusAt(t, spec.shaftRadius) * f, 6);
        expect(Math.abs(dot(d, T))).toBeLessThan(1e-6);
      }
      expect(ring[0]).toBeCloseTo(ring[36 * 3], 5);
      expect(ring[1]).toBeCloseTo(ring[36 * 3 + 1], 5);
      expect(ring[2]).toBeCloseTo(ring[36 * 3 + 2], 5);
    }
  });

  it("les anneaux sont croissants le long de l'axe, dans [0, 1], et marquent la collerette et le renflement", () => {
    expect([...RING_PARAMS].sort((a, b) => a - b)).toEqual([...RING_PARAMS]);
    expect(RING_PARAMS.every((t) => t >= 0 && t <= 1)).toBe(true);
    expect(RING_PARAMS).toContain(PROFILE.collarAt);
    expect(RING_PARAMS).toContain(PROFILE.swellEnd);
  });

  it("le disque de balayage est plus large que l'objet entier, centré sur l'axe, perpendiculaire à lui", () => {
    expect(SCAN_DISC_RADIUS).toBeGreaterThan(SILHOUETTE_SHAFT_RADIUS * (1 + PROFILE.swell));
    for (const t of [0, 0.38, 1]) {
      const disc = scanDisc(spec, t, SCAN_DISC_RADIUS, 32);
      const c = axisPoint(spec, t);
      const { T } = axisFrame(spec, t);
      expect(disc.length).toBe(33 * 3);
      expect(Array.from(disc).every(Number.isFinite)).toBe(true);
      for (let i = 0; i <= 32; i++) {
        const d = { x: disc[i * 3] - c.x, y: disc[i * 3 + 1] - c.y, z: disc[i * 3 + 2] - c.z };
        expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(SCAN_DISC_RADIUS, 6);
        expect(Math.abs(dot(d, T))).toBeLessThan(1e-6);
      }
    }
  });

  it("la fraction de balayage reste dans [0, 1], périodique, avec va-et-vient", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t <= 6400; t += 40) {
      const f = scanFraction(t);
      min = Math.min(min, f);
      max = Math.max(max, f);
      expect(f).toBeGreaterThanOrEqual(-1e-9);
      expect(f).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(min).toBeCloseTo(0, 3);
    expect(max).toBeCloseTo(1, 3);
    expect(scanFraction(1234)).toBeCloseTo(scanFraction(1234 + 6400), 9);
    expect(scanFraction(3200)).toBeCloseTo(1, 9);
  });

  it("l'axe a le bon nombre de points, tous finis, du bas vers le haut", () => {
    const axis = silhouetteAxis(spec, 24);
    expect(axis.length).toBe(25 * 3);
    expect(Array.from(axis).every(Number.isFinite)).toBe(true);
    for (let i = 1; i <= 24; i++) expect(axis[i * 3 + 1]).toBeGreaterThan(axis[(i - 1) * 3 + 1]);
  });
});
