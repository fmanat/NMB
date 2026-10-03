import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REFERENCES } from "@/config/site";
import { exampleReport } from "@/lib/exampleReport";
import { CAMERA_DISTANCE, PITCH_MAX, PITCH_MIN, project } from "@/lib/scanner3d";
import {
  FRAME_MARGIN,
  LENGTH_TO_DIAMETER,
  NARROW_BAND,
  PLANE_STYLE,
  POINT_CLASSES,
  RING_STYLE,
  SIDE_VALUES_WIDTH,
  SILHOUETTE_VIEW,
  classAlpha,
  classRadius,
  depthClass,
  pointRadius,
  sceneExtent,
  sceneUnit,
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
      const f = ringFactor();
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

// ---------------------------------------------------------------------------------------------------------------------
// Retouches du 03/10/2026 : anneaux et plan perpendiculaires à l'axe, plan toujours dans le cadre, points ronds, style unique des anneaux

const DIRECTIONS: BendDirection[] = ["left", "right", "up", "down"];

/** Normale unitaire d'un polygone fermé (méthode de Newell), orientée comme le sens de parcours. */
function polygonNormal(poly: Float32Array): { x: number; y: number; z: number } {
  const n = poly.length / 3 - 1; // le premier point est répété à la fin
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < n; i++) {
    const [ax, ay, az] = [poly[i * 3], poly[i * 3 + 1], poly[i * 3 + 2]];
    const j = (i + 1) % n;
    const [bx, by, bz] = [poly[j * 3], poly[j * 3 + 1], poly[j * 3 + 2]];
    nx += (ay - by) * (az + bz);
    ny += (az - bz) * (ax + bx);
    nz += (ax - bx) * (ay + by);
  }
  const len = Math.hypot(nx, ny, nz);
  return { x: nx / len, y: ny / len, z: nz / len };
}

describe("anneaux et plan de balayage : perpendiculaires à la tangente de l'axe à leur hauteur", () => {
  for (const direction of DIRECTIONS) {
    for (const angleDeg of [15, 20]) {
      it(`${direction}, ${angleDeg}° : normale de l'anneau · tangente = ±1 à de nombreuses hauteurs (anneaux de mesure et plan de balayage)`, () => {
        const spec = silhouetteSpec({ angleDeg, direction });
        for (const t of [0, 0.04, 0.1, 0.2, 0.3, 0.45, 0.56, 0.7, PROFILE.collarAt, 0.85, PROFILE.swellEnd, 0.95, 1]) {
          const { T } = axisFrame(spec, t);
          if (t < 0.99) {
            // (à t = 1 le rayon local est nul : l'anneau est dégénéré)
            const ring = polygonNormal(silhouetteRing(spec, t, RING_STYLE.factor, 72));
            expect(Math.abs(dot(ring, T)), `anneau t=${t}`).toBeGreaterThan(1 - 1e-6);
          }
          const disc = polygonNormal(scanDisc(spec, t, SCAN_DISC_RADIUS, 64));
          expect(Math.abs(dot(disc, T)), `plan t=${t}`).toBeGreaterThan(1 - 1e-6);
        }
      });
    }
  }

  it("la tangente tourne bien le long de l'axe courbe : l'anneau du haut n'est pas parallèle à celui du bas", () => {
    for (const direction of DIRECTIONS) {
      const spec = silhouetteSpec({ angleDeg: 15, direction });
      const bottom = polygonNormal(silhouetteRing(spec, RING_PARAMS[0], RING_STYLE.factor));
      const top = polygonNormal(silhouetteRing(spec, RING_PARAMS[RING_PARAMS.length - 1], RING_STYLE.factor));
      const sign = Math.sign(dot(bottom, top));
      const angle = Math.acos(Math.min(1, Math.abs(dot(bottom, top))));
      expect(sign).not.toBe(0);
      expect(angle).toBeGreaterThan(0.18); // environ 15° au total, moins le bout de l'axe non couvert
      expect(angle).toBeLessThan((20 * Math.PI) / 180);
    }
  });

  it("axe droit (sans courbure) : tous les anneaux sont parallèles et horizontaux", () => {
    const spec = silhouetteSpec();
    for (const t of RING_PARAMS) {
      const nrm = polygonNormal(silhouetteRing(spec, t, RING_STYLE.factor));
      expect(Math.abs(nrm.y)).toBeGreaterThan(1 - 1e-9);
    }
  });
});

describe("aucun anneau « spécial » : un seul style pour tous", () => {
  it("le rayon relatif est identique pour tous les anneaux, base et bout compris", () => {
    const factors = RING_PARAMS.map(() => ringFactor());
    expect(new Set(factors).size).toBe(1);
    expect(factors[0]).toBe(RING_STYLE.factor);
    expect(RING_STYLE.factor).toBeLessThanOrEqual(1.3); // pas plus large que les autres
  });

  it("le moteur trace tous les anneaux avec les mêmes paramètres de style, sans condition sur l'indice, la proximité du plan ou la base", () => {
    const src = readFileSync("src/components/scanner/scannerEngine.ts", "utf8");
    const loop = src.slice(src.indexOf("// Anneaux de mesure"), src.indexOf("// Fil de fer"));
    expect(loop).toContain("RING_STYLE.alpha");
    expect(loop).toContain("RING_STYLE.width");
    // Le style est fixé une fois avant la boucle : rien dans la boucle ne le modifie.
    const body = loop.slice(loop.indexOf("for (let r"));
    expect(body).not.toMatch(/strokeStyle|lineWidth|edge|scanProximity|r === 0|r === rings\.length/);
  });

  it("le disque de balayage est plus large que tout anneau, mais sans excès ; trait fin et voile léger", () => {
    const maxRing = SILHOUETTE_SHAFT_RADIUS * (1 + PROFILE.swell) * RING_STYLE.factor;
    expect(SCAN_DISC_RADIUS).toBeGreaterThan(maxRing);
    expect(SCAN_DISC_RADIUS).toBeLessThan(SILHOUETTE_SHAFT_RADIUS * (1 + PROFILE.swell) * 1.6);
    expect(PLANE_STYLE.width).toBeLessThanOrEqual(1);
    expect(PLANE_STYLE.fillAlpha).toBeLessThanOrEqual(0.1);
  });
});

describe("cadrage : le plan de balayage et tout le dessin restent dans le cadre du bandeau", () => {
  const FRAMES: [number, number][] = [
    [320, 276], [360, 276], [375, 276], [390, 276], [430, 276], [640, 276], [525, 400], [730, 400], [1000, 400], [1440, 400],
  ];
  const yaws = Array.from({ length: 72 }, (_, i) => (i / 72) * Math.PI * 2);
  const pitches = [PITCH_MIN, 0.15, SILHOUETTE_VIEW.pitch, 0.5, 0.7, 0.85, PITCH_MAX];

  for (const direction of DIRECTIONS) {
    it(`courbure ${direction} : bornes projetées du plan (toutes positions), des anneaux et de la surface dans le cadre, pour toutes les rotations, inclinaisons et tailles`, () => {
      const spec = silhouetteSpec({ angleDeg: 20, direction });
      const extent = sceneExtent(spec);
      const cloud = generateSilhouettePoints(spec, 400);
      const discs = Array.from({ length: 41 }, (_, i) => scanDisc(spec, i / 40, SCAN_DISC_RADIUS, 48)); // du bas (0) au haut (1)
      const rings = RING_PARAMS.map((t) => silhouetteRing(spec, t, RING_STYLE.factor, 48));
      const sets = [...discs, ...rings, cloud.points];
      for (const [w, h] of FRAMES) {
        const unit = sceneUnit(extent, w, h);
        const halfW = w < NARROW_BAND ? (w - 2 * SIDE_VALUES_WIDTH) / 2 : w / 2 - FRAME_MARGIN;
        const halfH = h / 2 - FRAME_MARGIN;
        let worstX = 0;
        let worstY = 0;
        for (const pitch of pitches) {
          for (const yaw of yaws) {
            const view = { yaw, pitch, cameraDistance: CAMERA_DISTANCE };
            for (const poly of sets) {
              for (let i = 0; i < poly.length; i += 3) {
                const p = project(poly[i], poly[i + 1], poly[i + 2], view);
                worstX = Math.max(worstX, Math.abs(p.x) * unit);
                worstY = Math.max(worstY, Math.abs(p.y) * unit);
              }
            }
          }
        }
        // Largeur utile : colonne centrale sur mobile (au moins 40 px de demi-largeur) ; hauteur : cadre moins la marge.
        expect(worstX, `${w}×${h} largeur`).toBeLessThanOrEqual(Math.max(40, halfW) + 1e-6);
        expect(worstY, `${w}×${h} hauteur`).toBeLessThanOrEqual(halfH + 1e-6);
        expect(worstX, `${w}×${h} dans le cadre`).toBeLessThan(w / 2);
        expect(worstY).toBeLessThan(h / 2);
      }
    });
  }

  it("le plan balaye bien toute la forme : à t = 0 et t = 1 il est aux extrémités de l'axe, et sa boîte y reste dans le cadre (mobile 390×276)", () => {
    const spec = silhouetteSpec(exampleReport().curvature);
    const extent = sceneExtent(spec);
    const unit = sceneUnit(extent, 390, 276);
    const view = { yaw: SILHOUETTE_VIEW.yaw, pitch: SILHOUETTE_VIEW.pitch, cameraDistance: CAMERA_DISTANCE };
    const ys: number[] = [];
    for (const t of [0, 0.5, 1]) {
      const disc = scanDisc(spec, t, SCAN_DISC_RADIUS, 64);
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < disc.length; i += 3) {
        const p = project(disc[i], disc[i + 1], disc[i + 2], view);
        y0 = Math.min(y0, 138 + p.y * unit);
        y1 = Math.max(y1, 138 + p.y * unit);
      }
      expect(y0).toBeGreaterThan(0);
      expect(y1).toBeLessThan(276);
      ys.push((y0 + y1) / 2);
    }
    expect(ys[0]).toBeGreaterThan(ys[1]); // t = 0 : bas de l'écran (y croît vers le bas)
    expect(ys[1]).toBeGreaterThan(ys[2]);
  });

  it("l'unité est constante (indépendante de la vue) et la forme est plus grande de plus de 25 % qu'avant sur mobile (390 px)", () => {
    const spec = silhouetteSpec(exampleReport().curvature);
    const unit = sceneUnit(sceneExtent(spec), 390, 276);
    const before = Math.min(184 / 3.5, (390 - 190) / 2.8); // ancienne unité du moteur sur mobile
    expect(unit / before).toBeGreaterThan(1.25);
    expect(unit / before).toBeLessThan(1.4);
  });

  it("tient aussi dans les petites largeurs (320 px) sans dépasser la colonne centrale réservée aux valeurs", () => {
    const spec = silhouetteSpec(exampleReport().curvature);
    const extent = sceneExtent(spec);
    expect(extent.x * sceneUnit(extent, 320, 276)).toBeLessThanOrEqual((320 - 2 * SIDE_VALUES_WIDTH) / 2 + 1e-6);
  });
});

describe("vue de départ : de trois quarts, la même partout", () => {
  it("azimut et inclinaison de départ : ni de face, ni de profil, ni de dessus", () => {
    expect(SILHOUETTE_VIEW.yaw).toBeGreaterThan(0.45);
    expect(SILHOUETTE_VIEW.yaw).toBeLessThan(1.1);
    expect(SILHOUETTE_VIEW.pitch).toBeGreaterThan(0.25);
    expect(SILHOUETTE_VIEW.pitch).toBeLessThan(0.6);
  });

  it("le moteur part de cette vue quelle que soit la taille du bandeau (aucune vue propre au mobile)", () => {
    const src = readFileSync("src/components/scanner/scannerEngine.ts", "utf8");
    expect(src).toContain("yaw: SILHOUETTE_VIEW.yaw, pitch: SILHOUETTE_VIEW.pitch");
    expect(src.match(/SILHOUETTE_VIEW/g)?.length).toBeLessThanOrEqual(3);
    expect(src).not.toMatch(/view\.(yaw|pitch)\s*=\s*[^=]*cssW/);
  });
});

describe("points ronds dont la taille décroît avec la profondeur", () => {
  it("le rayon est strictement décroissant avec la profondeur, positif, sans NaN", () => {
    let prev = Infinity;
    for (let d = 2.8; d <= 6.6; d += 0.1) {
      const r = pointRadius(d);
      expect(Number.isFinite(r)).toBe(true);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(prev);
      prev = r;
    }
  });

  it("les classes de profondeur sont ordonnées de proche à loin : rayon et opacité décroissent, tous les niveaux sont atteints", () => {
    expect(POINT_CLASSES).toBeGreaterThanOrEqual(4);
    for (let c = 1; c < POINT_CLASSES; c++) {
      expect(classRadius(c)).toBeLessThan(classRadius(c - 1));
      expect(classAlpha(c)).toBeLessThan(classAlpha(c - 1));
    }
    expect(classAlpha(POINT_CLASSES - 1)).toBeGreaterThan(0.2);
    expect(classRadius(0)).toBeGreaterThan(classRadius(POINT_CLASSES - 1) * 1.8); // la perspective se voit
    let last = -1;
    const seen = new Set<number>();
    for (let d = 2.0; d <= 7.5; d += 0.05) {
      const c = depthClass(d);
      expect(c).toBeGreaterThanOrEqual(last);
      last = c;
      seen.add(c);
    }
    expect(seen.size).toBe(POINT_CLASSES);
  });

  it("une classe est cohérente avec la projection : un point plus loin tombe dans une classe de rayon plus petit", () => {
    const view = { yaw: 0, pitch: 0, cameraDistance: CAMERA_DISTANCE };
    const near = project(0, 0, 1.2, view); // du côté de la caméra
    const far = project(0, 0, -1.2, view);
    expect(near.depth).toBeLessThan(far.depth);
    expect(classRadius(depthClass(near.depth))).toBeGreaterThan(classRadius(depthClass(far.depth)));
  });

  it("le moteur dessine des disques (arcs) et non des carrés, par lots, avec le rayon de la classe, y compris pour les points éclairés par le plan", () => {
    const src = readFileSync("src/components/scanner/scannerEngine.ts", "utf8");
    expect(src).toContain("ctx.arc(");
    expect(src).not.toContain("ctx.rect(");
    expect(src).not.toContain("fillRect(sx"); // pas de carré par point
    const batch = src.slice(src.indexOf("for (let lv = 0"), src.indexOf("// Plan de balayage"));
    expect(batch).toContain("classRadius(cls)");
    expect(batch.match(/ctx\.fill\(\)/g)?.length).toBe(1); // un seul remplissage par lot (jamais un par point)
    expect(batch).not.toMatch(/ctx\.arc\([^)]*,\s*(2\.|3\.|[4-9])/); // aucun rayon spécial
  });
});
