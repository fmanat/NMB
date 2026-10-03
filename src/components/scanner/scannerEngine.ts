// Moteur du bandeau « scanner » : dessin 2D (canvas) d'une silhouette stylisée en nuage de points (surface de révolution lisse, voir
// src/lib/scannerSilhouette.ts) avec projection 3D maison (voir src/lib/scanner3d.ts). Aucune dépendance. Ce module n'est chargé que
// par import dynamique, après l'affichage de la page. C'est le SEUL consommateur de la silhouette : le repli statique (SVG du serveur)
// et toutes les images de partage restent sur le cylindre abstrait (décision du propriétaire du 03/10/2026, docs/DECISIONS.md).
//
// Mouvement : rotation automatique lente, plan de balayage qui monte et descend, rotation au doigt/à la souris (événements pointeur).
// Avec « prefers-reduced-motion: reduce » : aucune boucle d'animation ; une image fixe, redessinée seulement quand le visiteur
// fait tourner l'objet (pas d'inertie, pas de balayage).

import { CAMERA_DISTANCE as CAMERA, STATIC_VIEW, clampPitch, project, scanProximity, type Projected, type View } from "@/lib/scanner3d";
import {
  RING_PARAMS,
  SCAN_DISC_RADIUS,
  SILHOUETTE_LENGTH,
  MERIDIAN_COUNT,
  SILHOUETTE_VIEW,
  generateSilhouettePoints,
  ringFactor,
  scanDisc,
  scanFraction,
  silhouetteAxis,
  silhouetteMeridian,
  silhouetteRing,
  silhouetteSpec,
  type BendDirection,
  type SilhouetteSpec,
} from "@/lib/scannerSilhouette";

export type ScannerHandle = { destroy(): void };

type Options = {
  /** Courbure de l'axe : angle et direction du rapport d'exemple (valeurs fournies par le serveur). Absente : axe droit. */
  curvature?: { angleDeg: number; direction: BendDirection };
  /** Appelé après le premier dessin réussi (le repli statique peut alors s'effacer). */
  onFirstFrame?: () => void;
};

const POINTS_SMALL = 460;
const POINTS_LARGE = 800;
const FRAME_MS = 33; // 30 images par seconde au plus : économise le processeur et la batterie
const SIZES = [2.2, 1.9, 1.5, 1.2, 2.8] as const;
const ALPHAS = [0.85, 0.7, 0.5, 0.32] as const;
const AUTO_SPEED = 0.00022; // rad/ms : un tour en environ 28 s
const DRAG_GAIN = 0.0095; // rad par pixel

function cssColor(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
}

export function startScanner(canvas: HTMLCanvasElement, options: Options = {}): ScannerHandle | null {
  const ctx = canvas.getContext("2d", { alpha: false }); // fond opaque (la couleur du bandeau) : composition plus rapide
  if (!ctx) return null;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionQuery.matches;

  const [br, bg, bb] = hexToRgb(cssColor("--bm-blue-400", "#4d8dff")); // points et anneaux
  const bgColor = cssColor("--bm-dark-bg", "#08111f");
  const [sr, sg, sb] = hexToRgb(cssColor("--bm-dark-text", "#f5f8fc")); // éclat du plan de balayage

  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let points: Float32Array = new Float32Array(0);
  let params: Float32Array = new Float32Array(0); // paramètre axial (0 à 1) de chaque point
  let pointCount = 0;
  const spec: SilhouetteSpec = silhouetteSpec(options.curvature);
  const L = SILHOUETTE_LENGTH;
  const rings = RING_PARAMS.map((t, i) => silhouetteRing(spec, t, ringFactor(i, RING_PARAMS.length), 72));
  const axisLine = silhouetteAxis(spec, 24);
  const meridians = Array.from({ length: MERIDIAN_COUNT }, (_, i) => silhouetteMeridian(spec, ((i + 0.5) / MERIDIAN_COUNT) * Math.PI * 2, 48));

  const view: View = { yaw: SILHOUETTE_VIEW.yaw, pitch: SILHOUETTE_VIEW.pitch, cameraDistance: CAMERA };
  let yawVel = AUTO_SPEED;
  const t0 = performance.now();
  let raf = 0;
  let running = false;
  let visible = true;
  let destroyed = false;
  let firstFrameDone = false;
  let lastTs = 0;
  const tmp: Projected = { x: 0, y: 0, scale: 1, depth: 0 };
  let levels = new Uint8Array(0);
  let sx = new Float32Array(0);
  let sy = new Float32Array(0);
  let lastDraw = 0;
  const tmp2: Projected = { x: 0, y: 0, scale: 1, depth: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === cssW && h === cssH && canvas.width === Math.round(w * dpr)) return;
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const want = cssW * cssH < 70000 ? POINTS_SMALL : POINTS_LARGE;
    if (want !== pointCount) {
      const cloud = generateSilhouettePoints(spec, want);
      points = cloud.points;
      params = cloud.params;
      pointCount = want;
    }
  }

  function draw(now: number) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cssW, cssH);
    // Unité : la silhouette (longueur 3 + anneaux) tient dans le bandeau avec une marge.
    // Sur les bandeaux étroits (mobile), les valeurs occupent les deux côtés : l'objet doit tenir dans la zone libre du centre.
    const unit = cssW < 480 ? Math.min(cssH / 3.5, (cssW - 190) / 2.8) : Math.min(cssH / 3.5, cssW / 3.2);
    const cx = cssW / 2;
    const cy = cssH / 2;
    const planeT = reduced ? STATIC_VIEW.scan : scanFraction(now - t0); // position du plan de balayage le long de l'axe, de 0 à 1

    // Anneaux de mesure (derrière les points : lignes fines)
    ctx.lineWidth = 1;
    for (let r = 0; r < rings.length; r++) {
      const poly = rings[r];
      const edge = r === 0 || r === rings.length - 1;
      const near = scanProximity(RING_PARAMS[r] * L, planeT * L, 0.12);
      ctx.strokeStyle = `rgba(${br},${bg},${bb},${(edge ? 0.5 : 0.28) + near * 0.4})`;
      ctx.beginPath();
      for (let i = 0; i < poly.length; i += 3) {
        project(poly[i], poly[i + 1], poly[i + 2], view, tmp);
        const px = cx + tmp.x * unit;
        const py = cy + tmp.y * unit;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Fil de fer : méridiens de la surface (fins, derrière les points) pour lire le profil
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${br},${bg},${bb},0.2)`;
    ctx.beginPath();
    for (const line of meridians) {
      for (let i = 0; i < line.length; i += 3) {
        project(line[i], line[i + 1], line[i + 2], view, tmp2);
        if (i === 0) ctx.moveTo(cx + tmp2.x * unit, cy + tmp2.y * unit);
        else ctx.lineTo(cx + tmp2.x * unit, cy + tmp2.y * unit);
      }
    }
    ctx.stroke();

    // Axe central (suit la courbure de l'axe)
    {
      ctx.strokeStyle = `rgba(${br},${bg},${bb},0.22)`;
      ctx.beginPath();
      for (let i = 0; i < axisLine.length; i += 3) {
        project(axisLine[i], axisLine[i + 1], axisLine[i + 2], view, tmp2);
        if (i === 0) ctx.moveTo(cx + tmp2.x * unit, cy + tmp2.y * unit);
        else ctx.lineTo(cx + tmp2.x * unit, cy + tmp2.y * unit);
      }
      ctx.stroke();
    }

    // Nuage de points, dessiné par lots (un seul tracé et un seul remplissage par niveau de profondeur) : beaucoup moins coûteux
    // que de changer de couleur à chaque point. Niveaux 0 à 3 : de proche à loin ; niveau 4 : points éclairés par le plan de balayage.
    const n = points.length / 3;
    if (levels.length < n) levels = new Uint8Array(n);
    if (sx.length < n) {
      sx = new Float32Array(n);
      sy = new Float32Array(n);
    }
    for (let i = 0; i < n; i++) {
      project(points[i * 3], points[i * 3 + 1], points[i * 3 + 2], view, tmp);
      sx[i] = cx + tmp.x * unit;
      sy[i] = cy + tmp.y * unit;
      if (scanProximity(params[i] * L, planeT * L, 0.2) > 0.15) levels[i] = 4;
      else levels[i] = Math.min(3, Math.max(0, Math.floor(((tmp.depth - (CAMERA - 1.2)) / 2.4) * 4)));
    }
    for (let lv = 0; lv < 5; lv++) {
      const size = SIZES[lv];
      ctx.fillStyle = lv === 4 ? `rgba(${sr},${sg},${sb},0.95)` : `rgba(${br},${bg},${bb},${ALPHAS[lv]})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) if (levels[i] === lv) ctx.rect(sx[i] - size / 2, sy[i] - size / 2, size, size);
      ctx.fill();
    }

    // Plan de balayage : disque perpendiculaire à l'axe, plus large que l'objet, bord net, voile translucide
    {
      const disc = scanDisc(spec, planeT, SCAN_DISC_RADIUS, 64);
      ctx.beginPath();
      for (let i = 0; i < disc.length; i += 3) {
        project(disc[i], disc[i + 1], disc[i + 2], view, tmp);
        const px = cx + tmp.x * unit;
        const py = cy + tmp.y * unit;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${br},${bg},${bb},0.10)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.85)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (!firstFrameDone) {
      firstFrameDone = true;
      options.onFirstFrame?.();
    }
  }

  function frame(now: number) {
    raf = 0;
    if (destroyed || !running) return;
    if (now - lastDraw < FRAME_MS - 2) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastDraw = now;
    const dt = Math.min(64, now - lastTs);
    lastTs = now;
    if (!dragging) {
      view.yaw += yawVel * dt;
      // retour progressif à la vitesse de rotation automatique
      yawVel += (AUTO_SPEED - yawVel) * Math.min(1, dt / 900);
    }
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    const shouldRun = !reduced && visible && !document.hidden && !destroyed;
    if (shouldRun && !running) {
      running = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!running && !destroyed) draw(performance.now()); // image fixe (mouvement réduit, hors écran, onglet masqué)
  }

  // --- Rotation au doigt / à la souris (événements pointeur) ---
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastMoveTs = 0;
  function onDown(e: PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveTs = e.timeStamp;
    yawVel = 0;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // capture indisponible : le glissement reste suivi tant que le pointeur est sur le canevas
    }
    canvas.style.cursor = "grabbing";
  }
  function onMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    view.yaw += dx * DRAG_GAIN;
    // Inclinaison : souris seulement (au doigt, le glissement vertical fait défiler la page : touch-action: pan-y).
    if (e.pointerType === "mouse") view.pitch = clampPitch(view.pitch + dy * DRAG_GAIN);
    const dtMove = Math.max(8, e.timeStamp - lastMoveTs);
    lastMoveTs = e.timeStamp;
    // Inertie : seulement si l'animation est permise.
    yawVel = reduced ? 0 : Math.max(-0.006, Math.min(0.006, (dx * DRAG_GAIN) / dtMove));
    if (!running) draw(performance.now());
  }
  function onUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // déjà relâché
    }
    canvas.style.cursor = "grab";
    if (reduced) yawVel = 0;
  }
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // --- Environnement : taille, visibilité, préférence de mouvement ---
  const ro = new ResizeObserver(() => {
    resize();
    if (!running) draw(performance.now());
  });
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    sync();
  });
  io.observe(canvas);
  const onVisibility = () => sync();
  document.addEventListener("visibilitychange", onVisibility);
  const onMotionChange = () => {
    reduced = motionQuery.matches;
    if (reduced) yawVel = 0;
    sync();
  };
  motionQuery.addEventListener("change", onMotionChange);

  resize();
  sync();

  return {
    destroy() {
      destroyed = true;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    },
  };
}
