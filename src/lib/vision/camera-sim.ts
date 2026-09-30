// Simulateur de prise de vue : valide le calcul géométrique et alimente le fournisseur de vision simulé, sans aucune photo.
//
// Scène : une table plane (z = 0, en millimètres), une carte bancaire posée à plat, et un cylindre couché sur la table
// (axe horizontal, à la hauteur de son rayon). Caméra sténopé : focale en pixels, inclinaison par rapport à la verticale,
// azimut, roulis dans l'image. On projette les points que le modèle doit repérer, on les normalise, puis on les donne au
// calcul de mesure exactement comme le ferait le pipeline réel.
//
// Fidélité : la carte est dans le plan de la table (elle sert de référence d'échelle) ; l'axe du cylindre est SURÉLEVÉ d'un
// rayon au-dessus de ce plan, et les bords repérés sont les vraies silhouettes (points de tangence), ce qui reproduit le
// principal biais d'une photo réelle.

import { CARD_LONG_MM, CARD_SHORT_MM, type ReperageNorm } from "../measure";

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => mul(a, 1 / norm(a));

export type Shot = {
  /** Dimensions de l'image en pixels. */
  width: number;
  height: number;
  /** Focale en pixels (un smartphone courant : environ 0,8 à 1,0 fois la largeur de l'image). */
  focalPx: number;
  /** Inclinaison de l'axe optique par rapport à la verticale, en degrés (0 = vue de dessus). */
  tiltDeg: number;
  /** Direction d'où l'on regarde, en degrés, dans le plan de la table. */
  azimuthDeg: number;
  /** Rotation de l'image autour de l'axe optique, en degrés. */
  rollDeg: number;
  /** Largeur de la carte dans l'image, en pixels : fixe la distance de prise de vue. */
  cardWidthPx: number;
  /** Rotation de la carte sur la table, en degrés. */
  cardRotationDeg: number;
  /** Direction de l'axe du cylindre sur la table, en degrés. */
  cylinderDirectionDeg: number;
  /** Cylindre : longueur et diamètre en millimètres. */
  lengthMm: number;
  diameterMm: number;
  /** Bruit de repérage en pixels (écart-type), ajouté à chaque point. 0 = repérage parfait. */
  noisePx?: number;
  seed?: number;
  /** Confiance attribuée à chaque point repéré (0 à 1). */
  confidence?: number;
};

export const DEFAULT_SHOT: Shot = {
  width: 1372,
  height: 1600,
  focalPx: 1250,
  tiltDeg: 0,
  azimuthDeg: 0,
  rollDeg: 0,
  cardWidthPx: 300,
  cardRotationDeg: 0,
  cylinderDirectionDeg: 0,
  lengthMm: 130,
  diameterMm: 38,
  noisePx: 0,
  seed: 1,
};

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform() || 1e-12)) * Math.cos(2 * Math.PI * uniform()); // loi normale
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Renvoie le repérage normalisé (0 à 1) qu'un repérage parfait produirait pour cette prise de vue, avec la vérité terrain. */
export function simulateShot(input: Partial<Shot> = {}): { reperage: ReperageNorm; shot: Shot; trueLengthCm: number; trueGirthCm: number; distanceMm: number; cardInImage: boolean } {
  const s: Shot = { ...DEFAULT_SHOT, ...input };
  const noise = rng(s.seed ?? 1);

  // --- Scène (mm). Carte centrée en (-70, 0), cylindre centré en (+40, 0).
  const cardCenter: V3 = [-70, 0, 0];
  const cr = rad(s.cardRotationDeg);
  const hw = CARD_LONG_MM / 2;
  const hh = CARD_SHORT_MM / 2;
  const cardCorners: V3[] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => add(cardCenter, [x * Math.cos(cr) - y * Math.sin(cr), x * Math.sin(cr) + y * Math.cos(cr), 0]));

  const r = s.diameterMm / 2;
  const cylCenter: V3 = [40, 0, r];
  const u: V3 = [Math.cos(rad(s.cylinderDirectionDeg)), Math.sin(rad(s.cylinderDirectionDeg)), 0];
  const axisAt = (t: number): V3 => add(cylCenter, mul(u, (t - 0.5) * s.lengthMm)); // t de 0 (base) à 1 (extrémité)

  // --- Caméra : distance choisie pour que la carte mesure cardWidthPx pixels de large (d ≈ f × largeur / pixels).
  const distance = (s.focalPx * CARD_LONG_MM) / s.cardWidthPx;
  const target: V3 = [-15, 0, 0];
  const tilt = rad(s.tiltDeg);
  const az = rad(s.azimuthDeg);
  const cam: V3 = add(target, mul([Math.sin(tilt) * Math.cos(az), Math.sin(tilt) * Math.sin(az), Math.cos(tilt)], distance));
  const fwd = unit(sub(target, cam));
  let right0: V3 = cross(fwd, [0, 0, 1]);
  right0 = norm(right0) < 1e-9 ? [Math.cos(az + Math.PI / 2), Math.sin(az + Math.PI / 2), 0] : unit(right0);
  const up0 = cross(right0, fwd);
  const roll = rad(s.rollDeg);
  const right = add(mul(right0, Math.cos(roll)), mul(up0, Math.sin(roll)));
  const up = add(mul(right0, -Math.sin(roll)), mul(up0, Math.cos(roll)));

  const project = (P: V3): { x: number; y: number; depth: number } => {
    const v = sub(P, cam);
    const depth = dot(v, fwd);
    return { x: s.width / 2 + (s.focalPx * dot(v, right)) / depth, y: s.height / 2 - (s.focalPx * dot(v, up)) / depth, depth };
  };
  const px = (P: V3) => {
    const p = project(P);
    return { x: p.x + (s.noisePx ? noise() * s.noisePx : 0), y: p.y + (s.noisePx ? noise() * s.noisePx : 0) };
  };
  const norm01 = (p: { x: number; y: number }) => ({ x: p.x / s.width, y: p.y / s.height, confiance: s.confidence ?? 0.9 });

  // --- Silhouette du cylindre à l'abscisse t : points de tangence dans la section perpendiculaire à l'axe.
  const silhouette = (t: number): { left: V3; right: V3 } => {
    const A = axisAt(t);
    const v = sub(cam, A);
    const vPerp = sub(v, mul(u, dot(v, u))); // composante de la vue dans la section
    const vHat = unit(vPerp);
    const nHat = unit(cross(u, vHat));
    const cosG = Math.min(1, r / norm(vPerp));
    const sinG = Math.sqrt(1 - cosG * cosG);
    const p1 = add(A, mul(add(mul(vHat, cosG), mul(nHat, sinG)), r));
    const p2 = add(A, mul(sub(mul(vHat, cosG), mul(nHat, sinG)), r));
    const a1 = project(p1);
    const a2 = project(p2);
    // « gauche » et « droite » : peu importe pour la mesure ; on trie selon l'abscisse de l'image pour la cohérence.
    return a1.x <= a2.x ? { left: p1, right: p2 } : { left: p2, right: p1 };
  };

  const heights = [
    ["base", 0.0],
    ["25", 0.25],
    ["50", 0.5],
    ["75", 0.75],
    ["sous_gland", 0.95],
  ] as const;

  const reperage: ReperageNorm = {
    coins_carte: cardCorners.map((c) => norm01(px(c))),
    base: norm01(px(axisAt(0))),
    extremite: norm01(px(axisAt(1))),
    ligne_mediane: Array.from({ length: 9 }, (_, i) => norm01(px(axisAt((i + 1) / 10)))),
    bords: heights.map(([hauteur, t]) => {
      const sil = silhouette(t);
      return { hauteur, gauche: norm01(px(sil.left)), droite: norm01(px(sil.right)) };
    }),
  };

  const inImage = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const all = [...reperage.coins_carte, reperage.base, reperage.extremite, ...reperage.ligne_mediane, ...reperage.bords.flatMap((b) => [b.gauche, b.droite])];
  return {
    reperage,
    shot: s,
    trueLengthCm: s.lengthMm / 10,
    trueGirthCm: (Math.PI * s.diameterMm) / 10,
    distanceMm: distance,
    cardInImage: all.every(inImage),
  };
}
