/**
 * Géométrie du bandeau « scanner » de l'accueil : logique pure (aucun accès au navigateur), donc testable.
 * L'objet est un CYLINDRE GÉOMÉTRIQUE ABSTRAIT (court, à bases plates, sans forme évoquant quoi que ce soit) : un nuage de points,
 * des anneaux de mesure et un plan de balayage. Aucune donnée réelle n'entre ici.
 */

export const CYLINDER = { radius: 1, halfHeight: 0.85 } as const;
/** Distance de la caméra, et vue de l'image fixe (repli sans JavaScript, mouvement réduit). `scan` : position du plan de 0 (base) à 1 (sommet). */
export const CAMERA_DISTANCE = 4.6;
export const STATIC_VIEW = { yaw: 0.55, pitch: 0.42, scan: 0.38 } as const;

/** Générateur pseudo-aléatoire déterministe (mulberry32) : un même graine donne toujours le même nuage. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Nuage de points posés sur la surface du cylindre : réseau décalé au hasard sur la face latérale (environ 63 % des points,
 * proportion des aires), anneaux concentriques sur les deux bases. Retourne des triplets x, y, z à plat.
 * Le nombre de points obtenu peut différer de `count` de quelques unités (arrondis du réseau).
 */
export function generateCylinderPoints(count: number, seed = 20261002): Float32Array {
  const rnd = mulberry32(seed);
  const { radius: R, halfHeight: H } = CYLINDER;
  const lateralArea = 2 * Math.PI * R * 2 * H;
  const capArea = Math.PI * R * R;
  const total = lateralArea + 2 * capArea;
  const nLat = Math.max(8, Math.round((count * lateralArea) / total));
  const nCap = Math.max(4, Math.round((count * capArea) / total));
  const pts: number[] = [];

  // Face latérale : réseau cols × rows, chaque point décalé d'au plus 40 % d'une maille.
  const cols = Math.max(4, Math.round(Math.sqrt((nLat * 2 * Math.PI * R) / (2 * H))));
  const rows = Math.max(2, Math.ceil(nLat / cols));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = ((c + 0.5 + (rnd() - 0.5) * 0.8) / cols) * Math.PI * 2;
      const y = -H + ((r + 0.5 + (rnd() - 0.5) * 0.8) / rows) * 2 * H;
      pts.push(Math.cos(a) * R, y, Math.sin(a) * R);
    }
  }

  // Bases : anneaux concentriques, nombre de points proportionnel au rayon.
  const rings = Math.max(2, Math.round(Math.sqrt(nCap / Math.PI)));
  for (const sign of [-1, 1]) {
    for (let k = 0; k < rings; k++) {
      const rr = ((k + 0.5) / rings) * R;
      const n = Math.max(3, Math.round((2 * rr * nCap) / (R * rings)));
      const phase = rnd() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = phase + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.15;
        pts.push(Math.cos(a) * rr, sign * H, Math.sin(a) * rr);
      }
    }
  }
  return Float32Array.from(pts);
}

/** Polyligne d'un anneau horizontal (cercle fermé) à la hauteur y : triplets x, y, z, premier point répété à la fin. */
export function ringPolyline(y: number, radius: number, segments = 72): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    out[i * 3] = Math.cos(a) * radius;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(a) * radius;
  }
  return out;
}

/** Hauteurs des anneaux de mesure : réparties régulièrement de la base au sommet (extrémités comprises). */
export function ringHeights(n = 5): number[] {
  const { halfHeight: H } = CYLINDER;
  if (n < 2) return [0];
  return Array.from({ length: n }, (_, i) => -H + (i / (n - 1)) * 2 * H);
}

export type View = {
  /** Rotation autour de l'axe vertical, en radians. */
  yaw: number;
  /** Inclinaison vers la caméra, en radians (bornée par `clampPitch`). */
  pitch: number;
  /** Distance de la caméra au centre de l'objet (> rayon de l'objet). */
  cameraDistance: number;
};

export type Projected = {
  /** Coordonnées écran normalisées (unité = rayon du cylindre à distance de référence), x vers la droite, y vers le bas. */
  x: number;
  y: number;
  /** Facteur de perspective autour de 1 : > 1 près de la caméra, < 1 loin. */
  scale: number;
  /** Profondeur dans le repère caméra : plus petite = plus proche. */
  depth: number;
};

export const PITCH_MIN = 0.08;
export const PITCH_MAX = 0.95;
export const clampPitch = (p: number): number => Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));

/**
 * Projection en perspective d'un point 3D : rotation autour de Y (yaw) puis autour de X (pitch), caméra sur l'axe Z.
 * Le résultat est écrit dans `out` (réutilisable pour éviter des allocations à chaque image).
 */
export function project(x: number, y: number, z: number, view: View, out: Projected = { x: 0, y: 0, scale: 1, depth: 0 }): Projected {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  // z2 > 0 : le point est du côté de la caméra (qui se trouve à +cameraDistance sur l'axe Z).
  const depth = view.cameraDistance - z2;
  const scale = view.cameraDistance / depth;
  out.x = x1 * scale;
  out.y = -y2 * scale; // l'écran a son y vers le bas
  out.scale = scale;
  out.depth = depth;
  return out;
}

/** Hauteur du plan de balayage à l'instant t (ms) : va-et-vient régulier de la base au sommet, adouci aux extrémités. */
export function scanHeight(timeMs: number, periodMs = 6400): number {
  const { halfHeight: H } = CYLINDER;
  const phase = ((timeMs % periodMs) + periodMs) % periodMs / periodMs; // 0..1
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2; // 0 → 1 → 0
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * tri); // adoucit les extrémités
  return -H + eased * 2 * H;
}

/** Proximité d'un point au plan de balayage : 1 sur le plan, 0 au-delà de `bandwidth`, décroissance douce entre les deux. */
export function scanProximity(pointY: number, planeY: number, bandwidth = 0.22): number {
  const d = Math.abs(pointY - planeY) / bandwidth;
  return d >= 1 ? 0 : (1 - d) * (1 - d);
}
