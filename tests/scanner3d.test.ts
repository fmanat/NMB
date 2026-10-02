import { describe, expect, it } from "vitest";
import {
  CYLINDER,
  PITCH_MAX,
  PITCH_MIN,
  clampPitch,
  generateCylinderPoints,
  mulberry32,
  project,
  ringHeights,
  ringPolyline,
  scanHeight,
  scanProximity,
  type View,
} from "@/lib/scanner3d";

const view: View = { yaw: 0, pitch: 0, cameraDistance: 4.2 };

describe("générateur pseudo-aléatoire", () => {
  it("est déterministe pour une même graine et reste dans [0, 1[", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("nuage de points du cylindre", () => {
  const pts = generateCylinderPoints(900, 7);
  const n = pts.length / 3;

  it("donne un nombre de points proche de la demande, en triplets", () => {
    expect(pts.length % 3).toBe(0);
    expect(n).toBeGreaterThan(900 * 0.9);
    expect(n).toBeLessThan(900 * 1.15);
  });

  it("place chaque point sur la surface du cylindre (face latérale ou base), jamais à l'intérieur ni dehors", () => {
    const { radius: R, halfHeight: H } = CYLINDER;
    let lateral = 0;
    let caps = 0;
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3];
      const y = pts[i * 3 + 1];
      const z = pts[i * 3 + 2];
      const rr = Math.hypot(x, z);
      expect(Math.abs(y)).toBeLessThanOrEqual(H + 1e-6);
      if (Math.abs(Math.abs(y) - H) < 1e-6) {
        caps++;
        expect(rr).toBeLessThanOrEqual(R + 1e-6);
      } else {
        lateral++;
        expect(rr).toBeCloseTo(R, 5);
      }
    }
    // Les deux faces sont représentées, la face latérale domine (aires 63 % / 37 %).
    expect(caps).toBeGreaterThan(n * 0.2);
    expect(lateral).toBeGreaterThan(n * 0.45);
  });

  it("est reproductible pour une même graine et différent pour une autre", () => {
    expect(Array.from(generateCylinderPoints(300, 7))).toEqual(Array.from(generateCylinderPoints(300, 7)));
    expect(Array.from(generateCylinderPoints(300, 8))).not.toEqual(Array.from(generateCylinderPoints(300, 7)));
  });

  it("reste raisonnable pour de très petits et de gros nombres (aucun NaN, aucun plantage)", () => {
    for (const c of [1, 10, 50, 3000]) {
      const p = generateCylinderPoints(c, 3);
      expect(p.length).toBeGreaterThan(0);
      expect(Array.from(p).every(Number.isFinite)).toBe(true);
    }
  });
});

describe("anneaux de mesure", () => {
  it("un anneau est un cercle fermé à hauteur constante", () => {
    const ring = ringPolyline(0.3, 1.2, 36);
    expect(ring.length).toBe(37 * 3);
    for (let i = 0; i < 37; i++) {
      expect(ring[i * 3 + 1]).toBeCloseTo(0.3, 6);
      expect(Math.hypot(ring[i * 3], ring[i * 3 + 2])).toBeCloseTo(1.2, 5);
    }
    expect(ring[0]).toBeCloseTo(ring[36 * 3], 5);
    expect(ring[2]).toBeCloseTo(ring[36 * 3 + 2], 4);
  });

  it("les hauteurs sont régulières, de la base au sommet", () => {
    const hs = ringHeights(5);
    expect(hs).toHaveLength(5);
    expect(hs[0]).toBeCloseTo(-CYLINDER.halfHeight, 9);
    expect(hs[4]).toBeCloseTo(CYLINDER.halfHeight, 9);
    expect(hs[2]).toBeCloseTo(0, 9);
    expect(ringHeights(1)).toEqual([0]);
  });
});

describe("projection en perspective", () => {
  it("l'origine se projette au centre", () => {
    const p = project(0, 0, 0, { yaw: 0.7, pitch: 0.4, cameraDistance: 4.2 });
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
    expect(p.scale).toBeCloseTo(1, 9);
  });

  it("sans rotation : x vers la droite, y vers le haut (écran : y négatif), pas de pitch = pas de décalage vertical lié à la profondeur", () => {
    const right = project(1, 0, 0, view);
    expect(right.x).toBeGreaterThan(0);
    expect(right.y).toBeCloseTo(0, 9);
    const up = project(0, 1, 0, view);
    expect(up.y).toBeLessThan(0);
    expect(up.x).toBeCloseTo(0, 9);
  });

  it("un point plus proche de la caméra est plus grand et a une profondeur plus faible", () => {
    const near = project(0.5, 0, 1, view);
    const far = project(0.5, 0, -1, view);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.depth).toBeLessThan(far.depth);
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
  });

  it("un tour complet de rotation ramène au même point ; un demi-tour inverse x", () => {
    const a = project(0.6, 0.3, 0.8, { yaw: 0.9, pitch: 0.3, cameraDistance: 4.2 });
    const b = project(0.6, 0.3, 0.8, { yaw: 0.9 + 2 * Math.PI, pitch: 0.3, cameraDistance: 4.2 });
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
    const half = project(1, 0, 0, { yaw: Math.PI, pitch: 0, cameraDistance: 4.2 });
    expect(half.x).toBeCloseTo(-1, 9);
  });

  it("avec une inclinaison, la base haute vue de dessus : le bord proche est plus bas à l'écran que le bord lointain", () => {
    const v: View = { yaw: 0, pitch: 0.5, cameraDistance: 4.2 };
    const front = project(0, CYLINDER.halfHeight, 1, v);
    const back = project(0, CYLINDER.halfHeight, -1, v);
    expect(front.y).toBeGreaterThan(back.y);
  });

  it("réutilise l'objet de sortie fourni (aucune allocation)", () => {
    const out = { x: 0, y: 0, scale: 1, depth: 0 };
    const r = project(1, 0, 0, view, out);
    expect(r).toBe(out);
    expect(out.x).toBeGreaterThan(0);
  });

  it("borne l'inclinaison", () => {
    expect(clampPitch(-3)).toBe(PITCH_MIN);
    expect(clampPitch(3)).toBe(PITCH_MAX);
    expect(clampPitch(0.4)).toBe(0.4);
  });
});

describe("plan de balayage", () => {
  it("reste entre la base et le sommet, périodique, avec va-et-vient", () => {
    const { halfHeight: H } = CYLINDER;
    let min = Infinity;
    let max = -Infinity;
    for (let t = 0; t <= 6400; t += 40) {
      const y = scanHeight(t);
      min = Math.min(min, y);
      max = Math.max(max, y);
      expect(y).toBeGreaterThanOrEqual(-H - 1e-9);
      expect(y).toBeLessThanOrEqual(H + 1e-9);
    }
    expect(min).toBeCloseTo(-H, 3);
    expect(max).toBeCloseTo(H, 3);
    expect(scanHeight(1234)).toBeCloseTo(scanHeight(1234 + 6400), 9);
    expect(scanHeight(3200)).toBeCloseTo(H, 9); // demi-période : sommet
    expect(scanHeight(-100)).toBeGreaterThanOrEqual(-H); // temps négatif toléré
  });

  it("la proximité vaut 1 sur le plan, 0 hors de la bande, et décroît avec la distance", () => {
    expect(scanProximity(0.2, 0.2)).toBe(1);
    expect(scanProximity(0.9, 0.2)).toBe(0);
    expect(scanProximity(0.3, 0.2)).toBeGreaterThan(scanProximity(0.35, 0.2));
    expect(scanProximity(0.3, 0.2)).toBeCloseTo(scanProximity(0.1, 0.2), 9);
  });
});
