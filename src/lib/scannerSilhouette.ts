/**
 * Silhouette stylisée du bandeau « scanner » ANIMÉ de l'accueil (moteur canvas) : logique pure (aucun accès au navigateur), donc testable.
 *
 * PORTÉE (décision du propriétaire du 03/10/2026, voir docs/DECISIONS.md) : ce module n'est utilisé QUE par le moteur animé
 * `src/components/scanner/scannerEngine.ts`. L'image de repli (SVG calculé côté serveur) et toutes les images de partage / Open Graph
 * restent sur le cylindre abstrait de `scanner3d.ts` ; un test (`tests/scanner-separation.test.ts`) le garantit. Ne l'importer
 * nulle part ailleurs.
 *
 * Forme : une surface de révolution lisse, rendue UNIQUEMENT en nuage de points et en anneaux de mesure. Rayon variable le long d'un
 * axe légèrement courbe ; aucun détail au-delà de la silhouette (aucune texture, aucun relief fin, aucun ombrage).
 *   - le rapport longueur / diamètre vient des constantes de référence du site (moyennes en érection de Veale et al., 2015) ;
 *   - la courbure (angle et direction) vient du rapport d'exemple, bornée à un rendu « légèrement incurvé ».
 * Les constantes de style ci-dessous (proportions du renflement terminal, collerette, taille dans la scène) ne sont pas des données
 * affichées : ce sont des choix de dessin.
 */

import { referenceFor } from "./stats";
import { mulberry32, scanHeight, CYLINDER } from "./scanner3d";

// ---------------------------------------------------------------------------------------------------------------------
// Proportions (lues dans les constantes du site, jamais écrites ici)

/** Moyennes de référence en érection (cm) lues dans `REFERENCES` via `referenceFor`. */
export const SILHOUETTE_REFERENCE = {
  length: referenceFor("erect", "length").mean,
  girth: referenceFor("erect", "girth").mean,
} as const;

/** Diamètre (cm) déduit de la circonférence : d = c / π. */
export const SILHOUETTE_DIAMETER = SILHOUETTE_REFERENCE.girth / Math.PI;

/** Rapport longueur / diamètre (sans unité) déduit des deux constantes de référence. */
export const LENGTH_TO_DIAMETER = SILHOUETTE_REFERENCE.length / SILHOUETTE_DIAMETER;

/** Longueur de l'objet dans la scène (unités de scène ; le cylindre abstrait mesurait 1,7 de haut). Choix de mise en page. */
export const SILHOUETTE_LENGTH = 3.0;

/** Rayon du fût dans la scène : (longueur / rapport) / 2. */
export const SILHOUETTE_SHAFT_RADIUS = SILHOUETTE_LENGTH / LENGTH_TO_DIAMETER / 2;

// ---------------------------------------------------------------------------------------------------------------------
// Profil de rayon r(t), t de 0 (base, fût) à 1 (extrémité arrondie)

/** Forme du bout (choix de dessin, relatifs à la longueur et au rayon du fût). */
export const PROFILE = {
  /** Début du rétrécissement de jonction (collerette), en fraction de la longueur. */
  collarAt: 0.78,
  /** Profondeur du rétrécissement : rayon relatif minimal = 1 − collarDepth. */
  collarDepth: 0.09,
  /** Largeur (en fraction de la longueur) sur laquelle le rétrécissement se résorbe. */
  collarWidth: 0.06,
  /** Position où le renflement terminal atteint son rayon maximal. */
  swellEnd: 0.87,
  /** Excédent de rayon du renflement terminal par rapport au fût (relatif). */
  swell: 0.16,
} as const;

const smoothstep = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

/** Rayon relatif ρ(t) (1 = rayon du fût). Lisse (C1), jamais négatif, 0 à l'extrémité (t = 1) ; t hors [0, 1] est ramené dans l'intervalle. */
export function radiusProfile(t: number): number {
  const x = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const { collarAt, collarDepth, collarWidth, swellEnd, swell } = PROFILE;
  // Corps : fût de rayon 1, légère encoche à la jonction, puis renflement progressif.
  const w = Math.min(1, Math.max(0, (x - collarAt) / collarWidth));
  const dip = x < collarAt ? 0 : collarDepth * Math.cos((Math.PI / 2) * w) ** 2; // fenêtre en cos², nulle après collarWidth
  // Avant la jonction, le fût se resserre doucement vers la collerette (même fenêtre, côté amont).
  const wPre = Math.min(1, Math.max(0, (collarAt - x) / collarWidth));
  const dipPre = x >= collarAt ? 0 : collarDepth * Math.cos((Math.PI / 2) * wPre) ** 2;
  const body = 1 - dip - dipPre + swell * smoothstep((x - collarAt) / (swellEnd - collarAt));
  // Extrémité : calotte elliptique (rayon ∝ √(1 − u²)), tangente nulle au raccord : arrondi sans arête.
  if (x <= swellEnd) return Math.max(0, body);
  const u = (x - swellEnd) / (1 - swellEnd);
  return Math.max(0, (1 + swell) * Math.sqrt(Math.max(0, 1 - u * u)));
}

/** Rayon absolu (unités de scène) à la position t. */
export function radiusAt(t: number, shaftRadius = SILHOUETTE_SHAFT_RADIUS): number {
  return shaftRadius * radiusProfile(t);
}

// ---------------------------------------------------------------------------------------------------------------------
// Axe courbe

/** Direction de la courbure telle que fournie par le rapport (`ReportResults.curvature.direction`). */
export type BendDirection = "none" | "left" | "right" | "up" | "down";

/**
 * Plus grand angle total rendu (degrés) : « légèrement incurvé ». L'exemple du site (15°) passe tel quel ; une courbure plus marquée
 * serait ramenée à cette borne (c'est un plafond de rendu, pas une valeur affichée).
 */
export const MAX_RENDER_BEND_DEG = 20;

export type SilhouetteSpec = {
  /** Longueur de l'axe (unités de scène). */
  length: number;
  /** Rayon du fût (unités de scène). */
  shaftRadius: number;
  /** Angle total de courbure rendu, en radians, entre la tangente à la base et la tangente à l'extrémité (0 à la borne). */
  bendRad: number;
  /** Direction du plan de courbure dans la scène (vecteur unitaire x, z ; (1, 0) quand il n'y a pas de courbure). */
  bendDir: { x: number; z: number };
};

/** Convention de scène (vue de face, caméra sur +z) : gauche = −x, droite = +x ; « haut » = vers la caméra (+z), « bas » = à l'opposé. */
function bendVector(direction: BendDirection): { x: number; z: number } {
  switch (direction) {
    case "left":
      return { x: -1, z: 0 };
    case "right":
      return { x: 1, z: 0 };
    case "up":
      return { x: 0, z: 1 };
    case "down":
      return { x: 0, z: -1 };
    default:
      return { x: 1, z: 0 };
  }
}

/** Angle de courbure rendu (radians) pour un angle déclaré (degrés) : valeur absolue bornée à [0, MAX_RENDER_BEND_DEG]. Non fini → 0. */
export function renderedBendRad(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) return 0;
  return (Math.min(MAX_RENDER_BEND_DEG, Math.abs(angleDeg)) * Math.PI) / 180;
}

/**
 * Spécification de la silhouette. `curvature` vient du rapport d'exemple (`exampleReport().curvature` : angleDeg et direction).
 * Sans direction (« none ») ou sans angle : axe droit.
 */
export function silhouetteSpec(curvature?: { angleDeg: number; direction: BendDirection }): SilhouetteSpec {
  const direction = curvature?.direction ?? "none";
  const bendRad = direction === "none" ? 0 : renderedBendRad(curvature?.angleDeg ?? 0);
  return { length: SILHOUETTE_LENGTH, shaftRadius: SILHOUETTE_SHAFT_RADIUS, bendRad, bendDir: bendVector(direction) };
}

export type Vec3 = { x: number; y: number; z: number };

/** Courbure constante : la tangente tourne régulièrement de 0 (base) à bendRad (extrémité). */
function rawAxis(spec: SilhouetteSpec, t: number): { px: number; py: number; phi: number } {
  const L = spec.length;
  const k = spec.bendRad / L;
  const s = Math.min(1, Math.max(0, t)) * L;
  const phi = k * s;
  if (k < 1e-9) return { px: 0, py: s, phi: 0 };
  return { px: (1 - Math.cos(phi)) / k, py: Math.sin(phi) / k, phi };
}

/** Point de l'axe à la position t, l'objet étant centré sur l'origine (milieu de la corde base–extrémité). */
export function axisPoint(spec: SilhouetteSpec, t: number): Vec3 {
  const a0 = rawAxis(spec, 0);
  const a1 = rawAxis(spec, 1);
  const a = rawAxis(spec, t);
  const cx = (a0.px + a1.px) / 2;
  const cy = (a0.py + a1.py) / 2;
  const lat = a.px - cx;
  return { x: spec.bendDir.x * lat, y: a.py - cy, z: spec.bendDir.z * lat };
}

/** Repère local à la position t : tangente T, normale N (dans le plan de courbure) et binormale B (perpendiculaire au plan). */
export function axisFrame(spec: SilhouetteSpec, t: number): { T: Vec3; N: Vec3; B: Vec3 } {
  const { phi } = rawAxis(spec, t);
  const { x: bx, z: bz } = spec.bendDir;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return {
    T: { x: bx * s, y: c, z: bz * s },
    N: { x: bx * c, y: -s, z: bz * c },
    B: { x: -bz, y: 0, z: bx },
  };
}

/** Position d'un point de la surface : axe en t, angle a autour de l'axe, rayon `radiusFactor` fois le rayon local (1 = surface). */
export function surfacePoint(spec: SilhouetteSpec, t: number, angle: number, radiusFactor = 1, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const p = axisPoint(spec, t);
  const { N, B } = axisFrame(spec, t);
  const r = radiusAt(t, spec.shaftRadius) * radiusFactor;
  const ca = Math.cos(angle) * r;
  const sa = Math.sin(angle) * r;
  out.x = p.x + N.x * ca + B.x * sa;
  out.y = p.y + N.y * ca + B.y * sa;
  out.z = p.z + N.z * ca + B.z * sa;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Nuage de points, anneaux de mesure, axe

export type SilhouetteCloud = {
  /** Triplets x, y, z à plat. */
  points: Float32Array;
  /** Paramètre axial t (0 à 1) de chaque point : sert au plan de balayage. */
  params: Float32Array;
};

/**
 * Nuage de points posés sur la surface : réseau décalé au hasard (rangées le long de l'axe, espacées régulièrement en abscisse
 * curviligne de la surface, nombre de points par rangée proportionnel à son périmètre). Reproductible pour une même graine.
 * Le nombre de points obtenu peut différer de `count` de quelques pourcents (arrondis du réseau). Le bout reste ouvert (pas de disque à la base).
 */
export function generateSilhouettePoints(spec: SilhouetteSpec, count: number, seed = 20261003): SilhouetteCloud {
  const rnd = mulberry32(seed);
  const target = Math.max(24, Math.round(count));
  // Abscisse curviligne de la surface (méridien) : table de m(t) et aire totale.
  const STEPS = 512;
  const m = new Float64Array(STEPS + 1);
  let area = 0;
  let prevR = radiusAt(0, spec.shaftRadius);
  for (let i = 1; i <= STEPS; i++) {
    const r = radiusAt(i / STEPS, spec.shaftRadius);
    const dm = Math.hypot(spec.length / STEPS, r - prevR);
    m[i] = m[i - 1] + dm;
    area += 2 * Math.PI * ((r + prevR) / 2) * dm;
    prevR = r;
  }
  const total = m[STEPS];
  const mesh = Math.sqrt(area / target); // côté d'une maille
  const rows = Math.max(4, Math.round(total / mesh));
  const tAtM = (mm: number): number => {
    // recherche dichotomique de t tel que m(t) = mm
    let lo = 0;
    let hi = STEPS;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (m[mid] <= mm) lo = mid;
      else hi = mid;
    }
    const span = m[hi] - m[lo] || 1;
    return (lo + (mm - m[lo]) / span) / STEPS;
  };

  const pts: number[] = [];
  const ts: number[] = [];
  const tmp: Vec3 = { x: 0, y: 0, z: 0 };
  for (let row = 0; row < rows; row++) {
    const mm = ((row + 0.5 + (rnd() - 0.5) * 0.8) / rows) * total;
    const t = Math.min(0.9999, Math.max(0.0001, tAtM(Math.min(total, Math.max(0, mm)))));
    const circumference = 2 * Math.PI * radiusAt(t, spec.shaftRadius);
    const n = Math.max(1, Math.round(circumference / mesh));
    const phase = rnd() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = phase + ((i + (rnd() - 0.5) * 0.8) / n) * Math.PI * 2;
      surfacePoint(spec, t, a, 1, tmp);
      pts.push(tmp.x, tmp.y, tmp.z);
      ts.push(t);
    }
  }
  return { points: Float32Array.from(pts), params: Float32Array.from(ts) };
}

/** Polyligne d'un anneau (cercle fermé perpendiculaire à l'axe) en t, de rayon `radiusFactor` × rayon local (≥ 1 : autour de la surface). */
export function silhouetteRing(spec: SilhouetteSpec, t: number, radiusFactor: number, segments = 72): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  const tmp: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i <= segments; i++) {
    surfacePoint(spec, t, (i / segments) * Math.PI * 2, radiusFactor, tmp);
    out[i * 3] = tmp.x;
    out[i * 3 + 1] = tmp.y;
    out[i * 3 + 2] = tmp.z;
  }
  return out;
}

/** Disque de balayage en t : cercle perpendiculaire à l'axe, de rayon FIXE `radius` (plus large que l'objet), centré sur l'axe. */
export function scanDisc(spec: SilhouetteSpec, t: number, radius: number, segments = 64): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  const p = axisPoint(spec, t);
  const { N, B } = axisFrame(spec, t);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ca = Math.cos(a) * radius;
    const sa = Math.sin(a) * radius;
    out[i * 3] = p.x + N.x * ca + B.x * sa;
    out[i * 3 + 1] = p.y + N.y * ca + B.y * sa;
    out[i * 3 + 2] = p.z + N.z * ca + B.z * sa;
  }
  return out;
}

/** Nombre de lignes de fil de fer (méridiens) tracées le long de la surface, pour lire la forme même quand le nuage est clairsemé. */
export const MERIDIAN_COUNT = 8;

/** Polyligne d'un méridien (ligne de la surface à angle constant autour de l'axe), `n` + 1 points de t = 0 à t = 1. */
export function silhouetteMeridian(spec: SilhouetteSpec, angle: number, n = 48): Float32Array {
  const out = new Float32Array((n + 1) * 3);
  const tmp: Vec3 = { x: 0, y: 0, z: 0 };
  for (let i = 0; i <= n; i++) {
    surfacePoint(spec, i / n, angle, 1, tmp);
    out[i * 3] = tmp.x;
    out[i * 3 + 1] = tmp.y;
    out[i * 3 + 2] = tmp.z;
  }
  return out;
}

/** Vue de départ du moteur animé (et image fixe en mouvement réduit) : presque de profil, légèrement de dessus, pour que le profil et la courbure se lisent. */
export const SILHOUETTE_VIEW = { yaw: 0.25, pitch: 0.2 } as const;

/** Polyligne de l'axe (graduation centrale), `n` + 1 points de t = 0 à t = 1. */
export function silhouetteAxis(spec: SilhouetteSpec, n = 24): Float32Array {
  const out = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const p = axisPoint(spec, i / n);
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}

/** Positions (t) des anneaux de mesure : réparties le long de l'axe, dont la jonction de la collerette et le rayon maximal du bout. */
export const RING_PARAMS: readonly number[] = [0.04, 0.3, 0.56, PROFILE.collarAt, PROFILE.swellEnd];
/** Rayon d'anneau relatif (× rayon local) : un peu plus large aux deux extrémités. */
export const ringFactor = (index: number, n: number): number => (index === 0 || index === n - 1 ? 1.45 : 1.25);
/** Rayon fixe du disque de balayage : nettement plus large que le plus grand rayon de l'objet. */
export const SCAN_DISC_RADIUS = SILHOUETTE_SHAFT_RADIUS * (1 + PROFILE.swell) * 1.6;

/** Fraction du balayage (0 à 1) à l'instant t (ms) : même va-et-vient adouci que le cylindre (`scanHeight`). */
export function scanFraction(timeMs: number, periodMs = 6400): number {
  const H = CYLINDER.halfHeight;
  return (scanHeight(timeMs, periodMs) + H) / (2 * H);
}
