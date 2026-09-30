// Estimation des dimensions avec pose de l'appareil (carte de référence + focale typique supposée).
//
// Pourquoi : projeter tous les points dans le plan de la carte suppose le sujet plat. Un sujet posé sur la table est au-dessus
// de ce plan (plus près de l'appareil) : la longueur est surestimée d'environ r/d, et la largeur est fortement faussée dès que
// la photo est inclinée. Ici on retrouve la pose de la caméra à partir des 4 coins de la carte, puis on travaille dans l'espace :
//  - les points de la ligne médiane sont l'intersection de leur rayon de vue avec le plan horizontal situé à une hauteur égale au
//    rayon du sujet (sujet posé à côté de la carte, sur la même surface) ;
//  - le rayon du sujet se déduit de l'angle entre les deux rayons tangents à ses bords : r = distance × sin(angle / 2).
//
// Hypothèses (à rappeler dans la marge d'erreur) : focale de type smartphone (CAMERA.focalFactor × grand côté de l'image),
// point principal au centre, sujet de section circulaire posé sur la surface de la carte.

import { CAMERA } from "@/config/site";
import {
  CARD_LONG_MM,
  CARD_SHORT_MM,
  curvatureDegrees,
  curvatureSigned,
  homography,
  sortCorners,
  symmetryScore,
  type Estimates,
  type Pt,
  type ReperageNorm,
} from "./measure";

type V3 = [number, number, number];
type M3 = [V3, V3, V3];

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit = (a: V3): V3 => scale(a, 1 / norm(a));

export class PoseError extends Error {}

export type Pose = {
  /** Rotation monde → caméra (lignes). Monde : plan de la carte, Z vers le haut. */
  R: M3;
  t: V3;
  /** Position de la caméra dans le monde (mm). */
  C: V3;
  focalPx: number;
  cx: number;
  cy: number;
  /** Inclinaison de l'axe optique par rapport à la verticale (0° = vue de dessus). */
  tiltDeg: number;
  /** Distance caméra – centre de la carte, en mm. */
  distanceMm: number;
  /** Plus long côté de la carte dans l'image, en pixels. */
  cardLongEdgePx: number;
};

const H_COLS = (h: number[]): [V3, V3, V3] => [
  [h[0], h[3], h[6]],
  [h[1], h[4], h[7]],
  [h[2], h[5], 1],
];

/** Pose de la caméra à partir des 4 coins de la carte (en pixels) et d'une focale supposée. */
export function poseFromCard(cornersPx: Pt[], imgW: number, imgH: number, focalFactor: number = CAMERA.focalFactor): Pose {
  const c = sortCorners(cornersPx);
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const e01 = (d(c[0], c[1]) + d(c[2], c[3])) / 2;
  const e12 = (d(c[1], c[2]) + d(c[3], c[0])) / 2;
  const [a, b] = e01 >= e12 ? [CARD_LONG_MM, CARD_SHORT_MM] : [CARD_SHORT_MM, CARD_LONG_MM];
  // Rectangle de la carte centré à l'origine, dans le plan Z = 0. Les coins triés tournent dans le sens horaire dans l'image
  // (axe y vers le bas) ; pour un repère direct avec Z vers le haut (vers l'appareil), l'axe Y du monde est vers le haut :
  // haut-gauche, haut-droite, bas-droite, bas-gauche.
  const rect: Pt[] = [
    { x: -a / 2, y: b / 2 },
    { x: a / 2, y: b / 2 },
    { x: a / 2, y: -b / 2 },
    { x: -a / 2, y: -b / 2 },
  ];
  const Hp = homography(rect, c); // plan (mm) → image (pixels)
  const f = focalFactor * Math.max(imgW, imgH);
  const cx = imgW / 2;
  const cy = imgH / 2;
  // K⁻¹ · colonnes de H
  const Kinv = (v: V3): V3 => [(v[0] - cx * v[2]) / f, (v[1] - cy * v[2]) / f, v[2]];
  const [h1, h2, h3] = H_COLS(Hp);
  const m1 = Kinv(h1);
  const m2 = Kinv(h2);
  const m3 = Kinv(h3);
  let lambda = 2 / (norm(m1) + norm(m2));
  if (!Number.isFinite(lambda)) throw new PoseError("pose impossible");
  let r1 = scale(m1, lambda);
  let r2 = scale(m2, lambda);
  let t = scale(m3, lambda);
  if (t[2] < 0) {
    // la carte doit être devant la caméra
    lambda = -lambda;
    r1 = scale(m1, lambda);
    r2 = scale(m2, lambda);
    t = scale(m3, lambda);
  }
  // Orthonormalisation de R = [r1 r2 r1×r2]
  const e1 = unit(r1);
  const r2o = sub(r2, scale(e1, dot(r2, e1)));
  const e2 = unit(r2o);
  const e3 = cross(e1, e2);
  // R (monde → caméra) a pour colonnes e1, e2, e3 : ses lignes sont donc :
  const R: M3 = [
    [e1[0], e2[0], e3[0]],
    [e1[1], e2[1], e3[1]],
    [e1[2], e2[2], e3[2]],
  ];
  // Centre de la caméra dans le monde : C = −Rᵀ t
  const C: V3 = scale([dot(e1, t), dot(e2, t), dot(e3, t)], -1);
  if (!(C[2] > 0)) throw new PoseError("caméra sous le plan de la carte");
  const tiltDeg = (Math.acos(Math.min(1, Math.abs(e3[2]))) * 180) / Math.PI;
  return { R, t, C, focalPx: f, cx, cy, tiltDeg, distanceMm: norm(C), cardLongEdgePx: Math.max(e01, e12) };
}

/** Direction (monde) du rayon de vue passant par un pixel. */
export function rayDirection(p: Pose, px: Pt): V3 {
  const dc: V3 = [(px.x - p.cx) / p.focalPx, (px.y - p.cy) / p.focalPx, 1];
  // monde = Rᵀ · caméra
  return unit([p.R[0][0] * dc[0] + p.R[1][0] * dc[1] + p.R[2][0] * dc[2], p.R[0][1] * dc[0] + p.R[1][1] * dc[1] + p.R[2][1] * dc[2], p.R[0][2] * dc[0] + p.R[1][2] * dc[1] + p.R[2][2] * dc[2]]);
}

/** Intersection du rayon d'un pixel avec le plan horizontal Z = h (mm). */
export function intersectPlane(p: Pose, px: Pt, h: number): V3 {
  const d = rayDirection(p, px);
  if (d[2] >= -1e-9) throw new PoseError("rayon parallèle au plan");
  const s = (h - p.C[2]) / d[2];
  if (!(s > 0)) throw new PoseError("point derrière la caméra");
  return add(p.C, scale(d, s));
}

/** Rayon du sujet (mm) à partir des deux rayons tangents à ses bords, en supposant l'axe à la hauteur r. */
export function radiusFromTangents(p: Pose, left: Pt, right: Pt): number {
  const d1 = rayDirection(p, left);
  const d2 = rayDirection(p, right);
  const halfAngle = Math.acos(Math.min(1, Math.max(-1, dot(d1, d2)))) / 2;
  const mid: Pt = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  let r = 15;
  for (let i = 0; i < 40; i++) {
    const A = intersectPlane(p, mid, r);
    const next = norm(sub(A, p.C)) * Math.sin(halfAngle);
    r = 0.5 * r + 0.5 * next;
  }
  return r;
}

export type PoseEstimates = Estimates & {
  tiltDeg: number;
  distanceMm: number;
  cardLongEdgePx: number;
  /** Hauteur supposée de l'axe du sujet au-dessus du plan de la carte (mm) = rayon médian. */
  axisHeightMm: number;
  focalPx: number;
};

/** Estime longueur, largeurs, circonférence, courbure, symétrie et conicité avec la pose de l'appareil. */
export function estimateMeasuresPose(r: ReperageNorm, imgW: number, imgH: number, focalFactor: number = CAMERA.focalFactor): PoseEstimates {
  const px = (q: { x: number; y: number }): Pt => ({ x: q.x * imgW, y: q.y * imgH });
  const pose = poseFromCard(r.coins_carte.map(px), imgW, imgH, focalFactor);

  // Rayons (donc largeurs) à chaque hauteur de bord.
  const rows = r.bords.map((b) => ({ name: b.hauteur, radius: radiusFromTangents(pose, px(b.gauche), px(b.droite)), left: px(b.gauche), right: px(b.droite) }));
  const radii = rows.map((w) => w.radius);
  const sortedR = [...radii].sort((a, b) => a - b);
  const axisHeight = sortedR[Math.floor(sortedR.length / 2)];
  const widths = radii.map((x) => 2 * x);
  const maxW = Math.max(...widths);
  const meanW = widths.reduce((s, w) => s + w, 0) / widths.length;

  // Ligne médiane dans l'espace, à la hauteur de l'axe.
  const basePx = px(r.base);
  const tipPx = px(r.extremite);
  const midPx = r.ligne_mediane.map(px);
  const dist2 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  midPx.sort((a, b) => dist2(a, basePx) - dist2(b, basePx));
  const pathPx = [basePx, ...midPx, tipPx];
  const path3 = pathPx.map((q) => intersectPlane(pose, q, axisHeight));
  let lengthMm = 0;
  for (let i = 1; i < path3.length; i++) lengthMm += norm(sub(path3[i], path3[i - 1]));

  // Courbure : angle dans l'espace (plan horizontal), signe lu dans l'image (base → extrémité, vue de la photo).
  const path2: Pt[] = path3.map((q) => ({ x: q[0], y: q[1] }));
  const angle = curvatureDegrees(path2);
  const signed = curvatureSigned(pathPx) >= 0 ? angle : -angle;

  // Symétrie (rapport de demi-largeurs, mesuré dans l'image) et conicité (rayons déduits des tangentes).
  const symmetry = symmetryScore(pathPx, rows.map((w) => ({ gauche: w.left, droite: w.right })));
  const rb = rows.find((w) => w.name === "base")?.radius ?? rows[0].radius;
  const rg = rows.find((w) => w.name === "sous_gland")?.radius ?? rows[rows.length - 1].radius;

  const cardLong = pose.cardLongEdgePx;
  return {
    lengthCm: lengthMm / 10,
    maxWidthCm: maxW / 10,
    meanWidthCm: meanW / 10,
    girthFromMaxCm: (Math.PI * maxW) / 10,
    girthFromMeanCm: (Math.PI * meanW) / 10,
    curvatureDeg: angle,
    curvatureSignedDeg: signed,
    symmetry,
    taper: rb > 0 ? rg / rb : 0,
    cardSkew: 1,
    cardPxPerMm: cardLong / CARD_LONG_MM,
    tiltDeg: pose.tiltDeg,
    distanceMm: pose.distanceMm,
    cardLongEdgePx: cardLong,
    axisHeightMm: axisHeight,
    focalPx: pose.focalPx,
  };
}
