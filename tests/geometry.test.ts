import { describe, expect, it } from "vitest";
import { CAMERA, PHOTO_LIMITS } from "@/config/site";
import { estimateMeasures } from "@/lib/measure";
import { PoseError, estimateMeasuresPose, intersectPlane, poseFromCard, radiusFromTangents } from "@/lib/pose";
import { DEFAULT_SHOT, simulateShot } from "@/lib/vision/camera-sim";
import { LONG_SIDE, runSweep, type Row } from "@/lib/vision/geometry-sweep";

const abs = (xs: number[]) => xs.map(Math.abs);
const max = (xs: number[]) => Math.max(...xs);
const quantile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const ok = (rows: Row[]) => rows.filter((r) => r.pose);
const within = (rows: Row[]) => rows.filter((r) => Math.abs(r.pose!.len) <= r.pose!.margin && Math.abs(r.pose!.girth) <= r.pose!.margin).length / rows.length;

describe("prises de vue simulées : repérage parfait", () => {
  const rows = ok(runSweep({ tilts: [0, 15, 30, 45, 50] }));

  it("couvre un large éventail de cas (inclinaisons, rotations, échelles, focales, cylindres)", () => {
    expect(rows.length).toBeGreaterThan(3000);
  });

  it("longueur et circonférence : erreur maximale ≤ 8 % jusqu'à 50° d'inclinaison, focale réelle ±20 % de la focale supposée", () => {
    expect(max(abs(rows.map((r) => r.pose!.len)))).toBeLessThan(8);
    expect(max(abs(rows.map((r) => r.pose!.girth)))).toBeLessThan(8);
  });

  it("aucun biais systématique (moyenne des erreurs proche de zéro)", () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.abs(mean(rows.map((r) => r.pose!.len)))).toBeLessThan(1);
    expect(Math.abs(mean(rows.map((r) => r.pose!.girth)))).toBeLessThan(1);
  });

  it("l'erreur reste dans la marge affichée dans 100 % des cas", () => {
    expect(within(rows)).toBe(1);
  });

  it("à focale exacte, l'erreur est quasi nulle", () => {
    const exact = rows.filter((r) => Math.abs(r.shot.focalPx / (CAMERA.focalFactor * LONG_SIDE) - 1) < 1e-9);
    expect(max(abs(exact.map((r) => r.pose!.len)))).toBeLessThan(0.5);
    expect(max(abs(exact.map((r) => r.pose!.girth)))).toBeLessThan(1);
  });
});

describe("prises de vue simulées : repérage bruité (σ = 2 px par point)", () => {
  // Cartes au moins aussi grandes que le seuil de refus (15 % du grand côté de l'image).
  const big = PHOTO_LIMITS.minCardFraction * LONG_SIDE; // 240 px
  const rows = ok(runSweep({ noisePx: 2, tilts: [0, 15, 30, 45], cardWidths: [250, 400, 600] }));

  it(`avec une carte d'au moins ${Math.round(big)} px, au moins 90 % des mesures sont dans la marge affichée`, () => {
    expect(within(rows)).toBeGreaterThanOrEqual(0.9);
  });

  it("l'erreur au 90e percentile reste sous la marge plancher étendue (≤ 14 %)", () => {
    expect(quantile(abs(rows.map((r) => r.pose!.len)), 0.9)).toBeLessThan(14);
    expect(quantile(abs(rows.map((r) => r.pose!.girth)), 0.9)).toBeLessThan(14);
  });

  it("l'erreur diminue quand la carte est plus grande dans l'image", () => {
    const p90 = (w: number) => quantile(abs(rows.filter((r) => r.shot.cardWidthPx === w).map((r) => r.pose!.len)), 0.9);
    expect(p90(600)).toBeLessThan(p90(400));
    expect(p90(400)).toBeLessThan(p90(250));
  });

  it("la marge affichée augmente quand la carte diminue", () => {
    const m = (w: number) => Math.max(...rows.filter((r) => r.shot.cardWidthPx === w).map((r) => r.pose!.margin));
    expect(m(600)).toBeLessThanOrEqual(m(400));
    expect(m(400)).toBeLessThanOrEqual(m(250));
  });
});

describe("pourquoi ces cas sont refusés", () => {
  it("au-delà de 55° d'inclinaison, l'erreur peut dépasser la marge : seuil de refus à 50°", () => {
    const steep = ok(runSweep({ tilts: [60], cardWidths: [250, 400] }));
    expect(PHOTO_LIMITS.maxTiltDeg).toBeLessThanOrEqual(50);
    expect(max(abs(steep.map((r) => r.pose!.len)))).toBeGreaterThan(10);
    const fine = ok(runSweep({ tilts: [50], cardWidths: [250, 400] }));
    expect(max(abs(fine.map((r) => r.pose!.len)))).toBeLessThan(8);
  });

  it("une carte très petite dans l'image donne des erreurs bien plus fortes que le seuil accepté", () => {
    const tiny = ok(runSweep({ noisePx: 2, tilts: [0, 15], cardWidths: [100] }));
    const accepted = ok(runSweep({ noisePx: 2, tilts: [0, 15], cardWidths: [250] }));
    if (tiny.length > 0) expect(quantile(abs(tiny.map((r) => r.pose!.len)), 0.9)).toBeGreaterThan(2 * quantile(abs(accepted.map((r) => r.pose!.len)), 0.9));
    // et la marge affichée pour une si petite carte serait élevée
    expect(1350 * 2 / 100).toBeGreaterThan(25);
  });
});

describe("l'ancien calcul (tout projeté dans le plan de la carte) n'est plus utilisé : il se trompait trop", () => {
  it("à 30° d'inclinaison, l'ancien calcul surestime la circonférence de plus de 20 % ; le nouveau reste sous 6 %", () => {
    const rows = runSweep({ tilts: [30], cardWidths: [250, 400] });
    expect(quantile(abs(rows.map((r) => r.legacy.girth)), 0.5)).toBeGreaterThan(20);
    expect(max(abs(ok(rows).map((r) => r.pose!.girth)))).toBeLessThan(6);
  });

  it("même en vue de dessus, l'ancien calcul surestime la longueur (objet plus proche de l'appareil que la carte)", () => {
    const sim = simulateShot({ ...DEFAULT_SHOT, tiltDeg: 0, cardWidthPx: 400, focalPx: CAMERA.focalFactor * LONG_SIDE });
    const old = estimateMeasures(sim.reperage, sim.shot.width, sim.shot.height);
    const now = estimateMeasuresPose(sim.reperage, sim.shot.width, sim.shot.height);
    expect((old.lengthCm - sim.trueLengthCm) / sim.trueLengthCm).toBeGreaterThan(0.04);
    expect(Math.abs((now.lengthCm - sim.trueLengthCm) / sim.trueLengthCm)).toBeLessThan(0.005);
  });
});

describe("pose de l'appareil", () => {
  const shot = (over = {}) => simulateShot({ ...DEFAULT_SHOT, focalPx: CAMERA.focalFactor * LONG_SIDE, ...over });
  const corners = (s: ReturnType<typeof shot>) => s.reperage.coins_carte.map((c) => ({ x: c.x * s.shot.width, y: c.y * s.shot.height }));

  it("retrouve l'inclinaison et la distance (focale exacte)", () => {
    for (const tilt of [0, 20, 40]) {
      const s = shot({ tiltDeg: tilt, cardRotationDeg: 70, rollDeg: 15 });
      const p = poseFromCard(corners(s), s.shot.width, s.shot.height);
      expect(Math.abs(p.tiltDeg - tilt)).toBeLessThan(1.5);
      // La pose mesure la distance caméra – centre de la carte, (-70, 0, 0) ; la simulation règle la distance vers la cible
      // (-15, 0, 0). On calcule donc la distance attendue vers le centre de la carte.
      const t = (tilt * Math.PI) / 180;
      const az = 0;
      const cam = [-15 + s.distanceMm * Math.sin(t) * Math.cos(az), 0 + s.distanceMm * Math.sin(t) * Math.sin(az), s.distanceMm * Math.cos(t)];
      const expected = Math.hypot(cam[0] - -70, cam[1] - 0, cam[2] - 0);
      expect(Math.abs(p.distanceMm / expected - 1)).toBeLessThan(0.02);
    }
  });

  it("l'inclinaison estimée reste à moins de 7° de la vraie malgré une focale fausse de ±20 %", () => {
    for (const ratio of [0.8, 1.2])
      for (const tilt of [0, 25, 45]) {
        const s = shot({ tiltDeg: tilt, focalPx: CAMERA.focalFactor * LONG_SIDE * ratio });
        const p = poseFromCard(corners(s), s.shot.width, s.shot.height);
        expect(Math.abs(p.tiltDeg - tilt)).toBeLessThan(7);
      }
  });

  it("les coins de la carte sont retrouvés à leur place dans le plan (repère lié à la carte, centre à l'origine)", () => {
    const s = shot({ tiltDeg: 30, cardRotationDeg: 10 });
    const p = poseFromCard(corners(s), s.shot.width, s.shot.height);
    const halfDiagonal = Math.hypot(85.6 / 2, 53.98 / 2); // 50,6 mm
    for (const c of corners(s)) {
      const P = intersectPlane(p, c, 0);
      expect(Math.abs(Math.hypot(P[0], P[1]) - halfDiagonal)).toBeLessThan(0.1);
      expect(Math.abs(P[2])).toBeLessThan(1e-6);
    }
  });

  it("le rayon d'un cylindre se déduit de l'écart angulaire de ses bords", () => {
    const s = shot({ tiltDeg: 20, diameterMm: 44 });
    const p = poseFromCard(corners(s), s.shot.width, s.shot.height);
    const row = s.reperage.bords[2];
    const r = radiusFromTangents(p, { x: row.gauche.x * s.shot.width, y: row.gauche.y * s.shot.height }, { x: row.droite.x * s.shot.width, y: row.droite.y * s.shot.height });
    expect(Math.abs(r - 22)).toBeLessThan(1.5);
  });

  it("coins dégénérés : erreur explicite plutôt qu'un résultat absurde", () => {
    const same = Array.from({ length: 4 }, () => ({ x: 500, y: 500 }));
    expect(() => poseFromCard(same, 1372, 1600)).toThrow();
    const line = [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }, { x: 400, y: 100 }];
    expect(() => poseFromCard(line, 1372, 1600)).toThrow();
    expect(PoseError).toBeDefined();
  });

  it("les cas hors image sont signalés par la simulation, pas mesurés", () => {
    const s = simulateShot({ ...DEFAULT_SHOT, cardWidthPx: 900 });
    expect(s.cardInImage).toBe(false);
  });
});
