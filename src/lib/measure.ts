// Calculs géométriques à partir des points repérés par le modèle (section 5.3 du cahier des charges).
// Le modèle ne mesure rien : tout est calculé ici. Fichier sans dépendance, utilisable aussi par les scripts.

export const CARD_LONG_MM = 85.6;
export const CARD_SHORT_MM = 53.98;

export type Pt = { x: number; y: number };

/** Trie 4 points en ordre circulaire autour de leur centre (ordre stable quel que soit l'ordre d'entrée). */
export function sortCorners(pts: Pt[]): Pt[] {
  if (pts.length !== 4) throw new Error("La carte doit avoir exactement 4 coins");
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  return [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Résout A·x = b par élimination de Gauss avec pivot partiel. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error("Homographie impossible (coins dégénérés)");
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

export type Homography = number[]; // h11..h32, avec h33 = 1

/** Homographie qui envoie 4 points source vers 4 points destination. */
export function homography(src: Pt[], dst: Pt[]): Homography {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solve(A, b);
}

export function project(h: Homography, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + 1;
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** Homographie pixels -> millimètres dans le plan de la carte de référence (85,60 × 53,98 mm). */
export function cardHomography(cornersPx: Pt[]): { h: Homography; cardSkew: number } {
  const c = sortCorners(cornersPx);
  const e01 = (dist(c[0], c[1]) + dist(c[2], c[3])) / 2;
  const e12 = (dist(c[1], c[2]) + dist(c[3], c[0])) / 2;
  const [a, b] = e01 >= e12 ? [CARD_LONG_MM, CARD_SHORT_MM] : [CARD_SHORT_MM, CARD_LONG_MM];
  const dst: Pt[] = [
    { x: 0, y: 0 },
    { x: a, y: 0 },
    { x: a, y: b },
    { x: 0, y: b },
  ];
  // Indice de déformation : rapport des côtés opposés (1 = vue de face).
  const skew = Math.max(dist(c[0], c[1]) / dist(c[2], c[3]), dist(c[2], c[3]) / dist(c[0], c[1]));
  return { h: homography(c, dst), cardSkew: skew };
}

export type ReperageNorm = {
  coins_carte: { x: number; y: number }[];
  base: { x: number; y: number };
  extremite: { x: number; y: number };
  ligne_mediane: { x: number; y: number }[];
  bords: { hauteur: string; gauche: { x: number; y: number }; droite: { x: number; y: number } }[];
};

export type Estimates = {
  lengthCm: number;
  maxWidthCm: number;
  meanWidthCm: number;
  girthFromMaxCm: number;
  girthFromMeanCm: number;
  curvatureDeg: number;
  cardSkew: number;
  cardPxPerMm: number;
};

/** Angle (degrés) entre les segments proximal et distal de la ligne médiane. */
export function curvatureDegrees(line: Pt[]): number {
  if (line.length < 3) return 0;
  const mid = Math.floor(line.length / 2);
  const prox = { x: line[mid].x - line[0].x, y: line[mid].y - line[0].y };
  const dis = { x: line[line.length - 1].x - line[mid].x, y: line[line.length - 1].y - line[mid].y };
  const dot = prox.x * dis.x + prox.y * dis.y;
  const n = Math.hypot(prox.x, prox.y) * Math.hypot(dis.x, dis.y);
  if (n === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / n))) * 180) / Math.PI;
}

/**
 * Estime longueur, largeurs, circonférence et courbure à partir du repérage normalisé (0 à 1).
 * imgW et imgH sont les dimensions en pixels de l'image envoyée au modèle.
 * Hypothèses : sujet à peu près dans le plan de la carte ; section circulaire pour la circonférence.
 */
type Subject = Pick<ReperageNorm, "base" | "extremite" | "ligne_mediane" | "bords">;
type Common = Omit<Estimates, "cardSkew" | "cardPxPerMm">;

/** Mesures du sujet à partir d'une fonction qui convertit un point normalisé en millimètres. */
function measureSubject(r: Subject, mm: (p: Pt) => Pt): Common {
  const base = mm(r.base);
  const tip = mm(r.extremite);
  // Ligne médiane ordonnée de la base vers l'extrémité.
  const mid = r.ligne_mediane.map(mm).sort((a, b) => dist(a, base) - dist(b, base));
  const path = [base, ...mid, tip];
  let lengthMm = 0;
  for (let i = 1; i < path.length; i++) lengthMm += dist(path[i - 1], path[i]);

  const widths = r.bords.map((b) => dist(mm(b.gauche), mm(b.droite)));
  const maxW = Math.max(...widths);
  const meanW = widths.reduce((s, w) => s + w, 0) / widths.length;

  return {
    lengthCm: lengthMm / 10,
    maxWidthCm: maxW / 10,
    meanWidthCm: meanW / 10,
    girthFromMaxCm: (Math.PI * maxW) / 10,
    girthFromMeanCm: (Math.PI * meanW) / 10,
    curvatureDeg: curvatureDegrees(path),
  };
}

export function estimateMeasures(r: ReperageNorm, imgW: number, imgH: number): Estimates {
  const px = (p: Pt): Pt => ({ x: p.x * imgW, y: p.y * imgH });
  const { h, cardSkew } = cardHomography(r.coins_carte.map(px));
  const common = measureSubject(r, (p) => project(h, px(p)));

  const cardPx = sortCorners(r.coins_carte.map(px));
  const longEdgePx = Math.max(dist(cardPx[0], cardPx[1]), dist(cardPx[1], cardPx[2]));

  return { ...common, cardSkew, cardPxPerMm: longEdgePx / CARD_LONG_MM };
}

export const RULER_UNIT_MM = { mm: 1, cm: 10, inch: 25.4 } as const;

export type ReperageRegle = Subject & {
  regle: {
    unite: keyof typeof RULER_UNIT_MM;
    graduation_a: { x: number; y: number; valeur: number };
    graduation_b: { x: number; y: number; valeur: number };
  };
};

/**
 * Variante avec une règle graduée comme référence : deux graduations lues par le modèle donnent l'échelle.
 * Pas de correction de perspective (une seule droite de référence) : moins fiable que la carte.
 */
export function estimateMeasuresRuler(r: ReperageRegle, imgW: number, imgH: number): Estimates {
  const px = (p: Pt): Pt => ({ x: p.x * imgW, y: p.y * imgH });
  const { graduation_a: a, graduation_b: b, unite } = r.regle;
  const realMm = Math.abs(a.valeur - b.valeur) * RULER_UNIT_MM[unite];
  const pxDist = dist(px(a), px(b));
  if (!(realMm > 0) || !(pxDist > 0)) throw new Error("Graduations de règle inutilisables");
  const mmPerPx = realMm / pxDist;
  const common = measureSubject(r, (p) => ({ x: px(p).x * mmPerPx, y: px(p).y * mmPerPx }));
  return { ...common, cardSkew: NaN, cardPxPerMm: 1 / mmPerPx };
}
