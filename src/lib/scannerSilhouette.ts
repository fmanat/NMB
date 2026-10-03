/**
 * Silhouette stylisée du bandeau « scanner » ANIMÉ de l'accueil (moteur canvas) : logique pure (aucun accès au navigateur), donc testable.
 *
 * PORTÉE (décision du propriétaire du 03/10/2026, voir docs/DECISIONS.md) : ce module n'est utilisé QUE par le moteur animé
 * `src/components/scanner/scannerEngine.ts`. L'image de repli (SVG calculé côté serveur) et toutes les images de partage / Open Graph
 * restent sur le cylindre abstrait de `scanner3d.ts` ; un test (`tests/scanner-separation.test.ts`) le garantit. Ne l'importer
 * nulle part ailleurs.
 *
 * Forme : une surface lisse rendue UNIQUEMENT en nuage de points, méridiens et anneaux de mesure. Rayon variable le long d'un axe
 * légèrement courbe ; le bout a un rebord, une rainure, un effilement aplati et incliné (voir `TIP_SHAPE`) ; aucun détail au-delà de la
 * silhouette (aucune texture, aucun relief fin, aucun ombrage).
 *   - le rapport longueur / diamètre vient des constantes de référence du site (moyennes en érection de Veale et al., 2015) ;
 *   - la courbure (angle et direction) vient du rapport d'exemple, bornée à un rendu « légèrement incurvé ».
 * Les constantes de style ci-dessous (proportions du bout, rebord, rainure, taille dans la scène) ne sont pas des données
 * affichées : ce sont des choix de dessin.
 */

import { referenceFor } from "./stats";
import { CAMERA_DISTANCE, PITCH_MAX, PITCH_MIN, mulberry32, project, scanHeight, CYLINDER } from "./scanner3d";

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

/**
 * Forme du bout (choix de dessin, relatifs à la longueur et au rayon du fût ; aucune texture ni aucun détail de surface) :
 *   - rebord : arête nette à la base du bout, plus large que le fût, un peu plus marqué sur le dessus que sur le dessous ;
 *   - rainure : léger rétrécissement du fût juste sous le rebord ;
 *   - bout : s'affine progressivement vers une pointe arrondie (pas un dôme symétrique), légèrement aplati de haut en bas et un peu
 *     incliné vers le bas par rapport à l'axe du fût.
 * Convention de scène (celle de la courbure) : « dessus » = +z (vers la caméra en vue de face), « dessous » = −z.
 */
export const TIP_SHAPE = {
  /** Position du rebord (début du bout), en fraction de la longueur : le bout occupe les 20 % terminaux. */
  rimAt: 0.8,
  /** Excédent de rayon moyen du rebord par rapport au fût (relatif) : 12,5 % plus large. */
  rimExcess: 0.125,
  /** Dissymétrie dessus / dessous de cet excédent : × (1 + 0,3) sur le dessus, × (1 − 0,3) sur le dessous. */
  rimTopBias: 0.3,
  /** Longueur (fraction de la longueur) de la face amont du rebord : courte, donc arête nette. */
  rimFace: 0.012,
  /** Profondeur de la rainure (rayon relatif minimal ≈ 1 − grooveDepth) et sa demi-largeur, centrée juste sous le rebord. */
  grooveDepth: 0.05,
  grooveWidth: 0.025,
  /** Galbe de l'effilement du bout (0 : racine pure ; plus grand : bout plus plein avant la pointe). */
  taper: 0.15,
  /** Aplatissement haut / bas du bout (relatif) : l'épaisseur dessus–dessous vaut 1 − flatten fois la largeur. */
  flatten: 0.12,
  /** Inclinaison du bout vers le bas par rapport à l'axe du fût (degrés). */
  tiltDeg: 9,
  /** Fraction du bout (depuis le rebord) sur laquelle la dissymétrie du rebord se résorbe. */
  rimFade: 0.3,
} as const;

const smoothstep = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

const clampT = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

/** Avancement dans le bout : 0 au rebord, 1 à l'extrémité (négatif sur le fût). */
const tipU = (x: number) => (x - TIP_SHAPE.rimAt) / (1 - TIP_SHAPE.rimAt);

/** Montée de la face amont du rebord : 0 sur le fût, 1 au rebord et au-delà. */
const rimRise = (x: number) => smoothstep((x - (TIP_SHAPE.rimAt - TIP_SHAPE.rimFace)) / TIP_SHAPE.rimFace);

/**
 * Rayon relatif MOYEN ρ(t) autour de l'axe (1 = rayon du fût), jamais négatif, 1 à la base, 0 à l'extrémité (t = 1) ;
 * t hors [0, 1] est ramené dans l'intervalle. Fût constant, rainure, arête nette du rebord, puis effilement vers une pointe arrondie
 * (rayon ∝ √(1 − u) près de l'extrémité : arrondi, sans pointe vive).
 */
export function radiusProfile(t: number): number {
  const x = clampT(t);
  const { rimAt, rimExcess, grooveDepth, grooveWidth, taper } = TIP_SHAPE;
  const top = 1 + rimExcess;
  if (x >= rimAt) {
    const u = tipU(x);
    if (u >= 1) return 0;
    return Math.max(0, top * Math.sqrt(1 - u) * (1 + taper * u));
  }
  // Rainure : fenêtre en cos² centrée juste sous le rebord, nulle au rebord et à une largeur en amont.
  const w = (x - (rimAt - grooveWidth)) / grooveWidth;
  const groove = Math.abs(w) >= 1 ? 0 : grooveDepth * Math.cos((Math.PI / 2) * w) ** 2;
  return Math.max(0, 1 - groove + rimExcess * rimRise(x));
}

/** Rayon absolu MOYEN (unités de scène) à la position t. */
export function radiusAt(t: number, shaftRadius = SILHOUETTE_SHAFT_RADIUS): number {
  return shaftRadius * radiusProfile(t);
}

/** Plus grand rayon relatif de la surface, tous angles confondus : le dessus du rebord. */
export const MAX_RELATIVE_RADIUS = 1 + TIP_SHAPE.rimExcess * (1 + TIP_SHAPE.rimTopBias);

/**
 * Coupe de la surface à la position t, dans le plan perpendiculaire à l'axe : décalage (relatif au rayon du fût) d'un point d'angle
 * `angle` par rapport à l'axe, en composantes « dessus » (d) et « côté » (l). angle = 0 : dessus ; angle = π : dessous.
 * Sur le fût et la rainure, c'est un cercle ; au rebord, la coupe est plus marquée dessus ; sur le bout, la coupe est une ellipse
 * aplatie de haut en bas, dont le centre descend progressivement (inclinaison vers le bas).
 */
export function crossSection(t: number, angle: number, lengthOverRadius = SILHOUETTE_LENGTH / SILHOUETTE_SHAFT_RADIUS): { d: number; l: number } {
  const x = clampT(t);
  const rho = radiusProfile(x);
  const u = Math.max(0, tipU(x));
  const { rimExcess, rimTopBias, flatten, tiltDeg, rimFade } = TIP_SHAPE;
  // Dissymétrie du rebord : nulle sur le fût, maximale au rebord, résorbée sur le premier tiers du bout.
  const asym = ((rimExcess * rimTopBias) / (1 + rimExcess)) * rimRise(x) * (1 - smoothstep(u / rimFade));
  const r = rho * (1 + asym * Math.cos(angle));
  const flat = 1 - flatten * smoothstep(u / 0.35);
  // Inclinaison : le centre de la coupe descend (vers −z) proportionnellement à l'avancement dans le bout.
  const drop = Math.tan((tiltDeg * Math.PI) / 180) * u * (1 - TIP_SHAPE.rimAt) * lengthOverRadius;
  return { d: r * Math.cos(angle) * flat - drop, l: r * Math.sin(angle) };
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

/**
 * Repère de coupe à la position t : « dessus » D (direction +z de la scène ramenée dans le plan perpendiculaire à l'axe) et « côté »
 * S = T × D. La courbure rendue étant bornée (≤ 20°), la tangente n'est jamais parallèle à z : D est toujours défini.
 */
export function sectionFrame(spec: SilhouetteSpec, t: number): { D: Vec3; S: Vec3 } {
  const { T } = axisFrame(spec, t);
  const dz = T.z; // Z · T
  const dx = -dz * T.x;
  const dy = -dz * T.y;
  const dzz = 1 - dz * T.z;
  const n = Math.hypot(dx, dy, dzz) || 1;
  const D = { x: dx / n, y: dy / n, z: dzz / n };
  return { D, S: { x: T.y * D.z - T.z * D.y, y: T.z * D.x - T.x * D.z, z: T.x * D.y - T.y * D.x } };
}

/**
 * Position d'un point de la surface : axe en t, angle a autour de l'axe (0 = dessus), coupe de `crossSection` (rebord, rainure, bout
 * aplati et incliné). `radiusFactor` agrandit la coupe autour de son centre (1 = surface, 0 = centre de la coupe, qui est l'axe sauf sur
 * le bout incliné).
 */
export function surfacePoint(spec: SilhouetteSpec, t: number, angle: number, radiusFactor = 1, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const p = axisPoint(spec, t);
  const { D, S } = sectionFrame(spec, t);
  const R = spec.shaftRadius;
  const ratio = spec.length / R;
  const c = crossSection(t, angle, ratio);
  // Centre de la coupe (décalage d'inclinaison) : la partie de d qui ne dépend pas de l'angle.
  const center = crossSection(t, Math.PI / 2, ratio).d;
  const d = (center + (c.d - center) * radiusFactor) * R;
  const l = c.l * radiusFactor * R;
  out.x = p.x + D.x * d + S.x * l;
  out.y = p.y + D.y * d + S.y * l;
  out.z = p.z + D.z * d + S.z * l;
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
 * Sur le rebord, `RIM_ROWS` rangées supplémentaires (prises sur le même budget de points) soulignent légèrement le contour du rebord.
 */
/** Rangées de points supplémentaires sur le rebord (densité légèrement plus forte au rebord). */
export const RIM_ROWS = 2;
/** Espacement des points le long de ces rangées, relatif à la maille du réseau (1 : même espacement que le reste du nuage). */
const RIM_ROW_SPACING = 1;

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
  // Budget des rangées du rebord (périmètre au rebord), retiré du réseau régulier pour garder le total proche de `count`.
  const rimCirc = 2 * Math.PI * radiusAt(TIP_SHAPE.rimAt, spec.shaftRadius);
  const rimN = (mesh0: number) => Math.max(1, Math.round(rimCirc / (mesh0 * RIM_ROW_SPACING)));
  const extra = RIM_ROWS * rimN(Math.sqrt(area / target));
  const mesh = Math.sqrt(area / Math.max(16, target - extra)); // côté d'une maille
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
  // Rangées du rebord : réparties sur la face du rebord et juste au-delà, angles décalés au hasard.
  const nRim = rimN(Math.sqrt(area / target));
  for (let k = 0; k < RIM_ROWS; k++) {
    const t = TIP_SHAPE.rimAt - TIP_SHAPE.rimFace * 0.5 + ((k + 0.5 + (rnd() - 0.5) * 0.4) / RIM_ROWS) * TIP_SHAPE.rimFace * 1.2;
    const phase = rnd() * Math.PI * 2;
    for (let i = 0; i < nRim; i++) {
      const a = phase + ((i + (rnd() - 0.5) * 0.6) / nRim) * Math.PI * 2;
      surfacePoint(spec, t, a, 1, tmp);
      pts.push(tmp.x, tmp.y, tmp.z);
      ts.push(t);
    }
  }
  return { points: Float32Array.from(pts), params: Float32Array.from(ts) };
}

/**
 * Polyligne d'un anneau de mesure : cercle fermé perpendiculaire à l'axe, centré sur l'axe, de rayon `radiusFactor` × rayon moyen local
 * (`radiusAt`). Avec le facteur des anneaux (1,25), il entoure la surface même là où elle est dissymétrique (dessus du rebord).
 */
export function silhouetteRing(spec: SilhouetteSpec, t: number, radiusFactor: number, segments = 72): Float32Array {
  return scanDisc(spec, t, radiusAt(t, spec.shaftRadius) * radiusFactor, segments);
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
/** Échantillons par méridien : assez serrés pour que l'arête nette du rebord et la rainure se lisent sur le fil de fer. */
export const MERIDIAN_SAMPLES = 160;

/** Polyligne d'un méridien (ligne de la surface à angle constant autour de l'axe), `n` + 1 points de t = 0 à t = 1. */
export function silhouetteMeridian(spec: SilhouetteSpec, angle: number, n = MERIDIAN_SAMPLES): Float32Array {
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

/**
 * Vue de départ du moteur animé (et image fixe en mouvement réduit), identique sur mobile et sur ordinateur : proche du profil (65° par
 * rapport à la vue de face) et légèrement de dessus, pour que le rebord, la courbure du bout et l'ouverture des anneaux se lisent.
 */
export const SILHOUETTE_VIEW = { yaw: (65 * Math.PI) / 180, pitch: 0.34 } as const;

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

/** Positions (t) des anneaux de mesure : réparties régulièrement le long du fût, la dernière sur le rebord. */
export const RING_PARAMS: readonly number[] = [0.04, 0.29, 0.545, TIP_SHAPE.rimAt];

/**
 * Style UNIQUE des anneaux de mesure : tous les anneaux (y compris le premier, en bas, et le dernier) ont exactement le même rayon
 * relatif, le même trait et la même transparence. Aucun anneau n'a de style particulier.
 */
export const RING_STYLE = { factor: 1.25, alpha: 0.3, width: 1 } as const;
/** Rayon d'anneau relatif (× rayon local) : le même pour tous les anneaux (aucun paramètre : il ne dépend ni de l'indice, ni de la position). */
export const ringFactor = (): number => RING_STYLE.factor;

/** Rayon fixe du disque de balayage : plus large que tout anneau et que l'objet, mais volontairement serré (pas un trait qui dépasse). */
export const SCAN_DISC_RADIUS = SILHOUETTE_SHAFT_RADIUS * MAX_RELATIVE_RADIUS * 1.4;
/** Style du plan de balayage : trait fin, voile très léger. */
export const PLANE_STYLE = { strokeAlpha: 0.7, fillAlpha: 0.07, width: 1 } as const;

/** Fraction du balayage (0 à 1) à l'instant t (ms) : même va-et-vient adouci que le cylindre (`scanHeight`) ; de l'extrémité basse à l'extrémité haute puis retour. */
export function scanFraction(timeMs: number, periodMs = 6400): number {
  const H = CYLINDER.halfHeight;
  return (scanHeight(timeMs, periodMs) + H) / (2 * H);
}

// ---------------------------------------------------------------------------------------------------------------------
// Cadrage : tout ce qui est dessiné reste dans le cadre du bandeau, quelle que soit la rotation, l'inclinaison ou la position du plan

/** Marge (pixels CSS) entre le dessin et le bord du cadre. */
export const FRAME_MARGIN = 6;
/** Largeur (pixels CSS) réservée aux valeurs affichées de part et d'autre de l'objet sur les bandeaux étroits (mobile). */
export const SIDE_VALUES_WIDTH = 100;
/** En dessous de cette largeur de bandeau (pixels CSS), les valeurs occupent les deux côtés et l'objet tient dans la colonne centrale. */
export const NARROW_BAND = 480;
/** Coefficient de sécurité sur l'étendue (l'étendue est échantillonnée) : le dessin occupe au plus 1/1,04 de la place disponible. */
const EXTENT_SAFETY = 1.04;

/**
 * Tout ce qui est dessiné (surface, anneaux, axe, méridiens) est contenu dans le « tube » balayé par le disque de balayage (rayon fixe
 * `SCAN_DISC_RADIUS`) : l'étendue projetée de ce tube, au pire sur toutes les rotations (azimut) et toutes les inclinaisons permises,
 * borne donc tout le dessin ET le plan de balayage à toute position. Résultat en unités normalisées de `project` (valeurs absolues maximales).
 */
export function sceneExtent(spec: SilhouetteSpec, discRadius = SCAN_DISC_RADIUS): { x: number; y: number } {
  const YAWS = 24;
  const PITCHES = 5;
  const TS = 16;
  const ANGLES = 16;
  let mx = 0;
  let my = 0;
  const tmp = { x: 0, y: 0, scale: 1, depth: 0 };
  for (let ti = 0; ti <= TS; ti++) {
    const t = ti / TS;
    const c = axisPoint(spec, t);
    const { N, B } = axisFrame(spec, t);
    for (let a = 0; a < ANGLES; a++) {
      const ang = (a / ANGLES) * Math.PI * 2;
      const ca = Math.cos(ang) * discRadius;
      const sa = Math.sin(ang) * discRadius;
      const x = c.x + N.x * ca + B.x * sa;
      const y = c.y + N.y * ca + B.y * sa;
      const z = c.z + N.z * ca + B.z * sa;
      for (let yi = 0; yi < YAWS; yi++) {
        for (let pi = 0; pi < PITCHES; pi++) {
          const view = { yaw: (yi / YAWS) * Math.PI * 2, pitch: PITCH_MIN + (pi / (PITCHES - 1)) * (PITCH_MAX - PITCH_MIN), cameraDistance: CAMERA_DISTANCE };
          project(x, y, z, view, tmp);
          mx = Math.max(mx, Math.abs(tmp.x));
          my = Math.max(my, Math.abs(tmp.y));
        }
      }
    }
  }
  return { x: mx * EXTENT_SAFETY, y: my * EXTENT_SAFETY };
}

/**
 * Unité d'échelle (pixels par unité normalisée) pour un bandeau de `cssW` × `cssH` pixels : le plus grand dessin dont l'étendue
 * (`sceneExtent`) tient dans le cadre, marge comprise. Sur un bandeau étroit, la largeur utile est la colonne centrale entre les valeurs.
 * Constante : ne dépend ni de l'azimut, ni de l'inclinaison, ni de la position du plan.
 */
export function sceneUnit(extent: { x: number; y: number }, cssW: number, cssH: number): number {
  const halfW = cssW < NARROW_BAND ? Math.max(40, (cssW - 2 * SIDE_VALUES_WIDTH) / 2) : cssW / 2 - FRAME_MARGIN;
  const halfH = cssH / 2 - FRAME_MARGIN;
  return Math.max(1, Math.min(halfW / extent.x, halfH / extent.y));
}

// ---------------------------------------------------------------------------------------------------------------------
// Points : ronds, plus petits quand ils sont loin (perspective), tracés par lots de profondeur

/** Nombre de classes de profondeur (un tracé et un remplissage par classe). Classe 0 = la plus proche de la caméra. */
export const POINT_CLASSES = 6;
/** Demi-étendue de profondeur (autour de la distance de la caméra) couverte par les classes. */
export const POINT_DEPTH_SPAN = 1.8;
/** Rayon (pixels CSS) d'un point à la distance de la caméra. */
export const POINT_RADIUS_AT_CAMERA = 0.85;

/** Rayon d'un point rond (pixels CSS) à la profondeur donnée : strictement décroissant avec la profondeur (perspective). */
export function pointRadius(depth: number): number {
  const d = Math.max(0.5, depth);
  return POINT_RADIUS_AT_CAMERA * Math.pow(CAMERA_DISTANCE / d, 1.2);
}

/** Classe de profondeur (0 = proche, POINT_CLASSES − 1 = loin) d'un point à la profondeur donnée. */
export function depthClass(depth: number): number {
  const u = (depth - (CAMERA_DISTANCE - POINT_DEPTH_SPAN)) / (2 * POINT_DEPTH_SPAN);
  return Math.min(POINT_CLASSES - 1, Math.max(0, Math.floor(u * POINT_CLASSES)));
}

/** Rayon commun des points d'une classe (rayon à la profondeur médiane de la classe). */
export function classRadius(c: number): number {
  return pointRadius(CAMERA_DISTANCE - POINT_DEPTH_SPAN + ((c + 0.5) / POINT_CLASSES) * 2 * POINT_DEPTH_SPAN);
}

/** Opacité des points d'une classe : plus loin = plus transparent. */
export function classAlpha(c: number): number {
  return 0.9 - c * 0.09;
}
