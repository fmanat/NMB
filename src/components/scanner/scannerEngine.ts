// Moteur du bandeau « scanner » : dessin 2D (canvas) d'une silhouette stylisée en nuage de points (surface de révolution lisse, voir
// src/lib/scannerSilhouette.ts) avec projection 3D maison (voir src/lib/scanner3d.ts). Aucune dépendance. Ce module n'est chargé que
// par import dynamique, après l'affichage de la page. C'est le SEUL consommateur de la silhouette : le repli statique (SVG du serveur)
// et toutes les images de partage restent sur le cylindre abstrait (décision du propriétaire du 03/10/2026, docs/DECISIONS.md).
//
// Mouvement : rotation automatique lente, plan de balayage qui balaie la forme d'une extrémité à l'autre (aller-retour adouci), rotation au doigt/à la souris (événements pointeur).
// Avec « prefers-reduced-motion: reduce » : aucune boucle d'animation ; une image fixe, redessinée seulement quand le visiteur
// fait tourner l'objet (pas d'inertie, pas de balayage).

import { CAMERA_DISTANCE as CAMERA, STATIC_VIEW, clampPitch, project, scanProximity, type Projected, type View } from "@/lib/scanner3d";
import {
  PLANE_STYLE,
  POINT_CLASSES,
  RING_PARAMS,
  RING_STYLE,
  SCAN_DISC_RADIUS,
  SILHOUETTE_LENGTH,
  MERIDIAN_COUNT,
  SILHOUETTE_VIEW,
  classAlpha,
  classRadius,
  depthClass,
  generateSilhouettePoints,
  ringFactor,
  sceneExtent,
  sceneUnit,
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

/**
 * État lisible par les tests de bout en bout (propriété `__scannerState` du canevas) : vue, position du plan et boîte écran du plan
 * (pixels CSS, repère du canevas). Lecture seule ; aucune donnée personnelle.
 */
export type ScannerState = {
  yaw: number;
  pitch: number;
  planeT: number;
  unit: number;
  width: number;
  height: number;
  plane: { x0: number; y0: number; x1: number; y1: number };
};

type Options = {
  /** Courbure de l'axe : angle et direction du rapport d'exemple (valeurs fournies par le serveur). Absente : axe droit. */
  curvature?: { angleDeg: number; direction: BendDirection };
  /** Appelé après le premier dessin réussi (le repli statique peut alors s'effacer). */
  onFirstFrame?: () => void;
};

const POINTS_SMALL = 460;
const POINTS_NARROW = 560; // bandeau étroit (mobile) : l'objet est grand, donc un peu plus de points
const POINTS_LARGE = 800;
const TAU = Math.PI * 2;
const FRAME_MS = 33; // 30 images par seconde au plus : économise le processeur et la batterie
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
  const [sr, sg, sb] = hexToRgb(cssColor("--bm-dark-text", "#f5f8fc")); // trait du plan de balayage
  const [lr, lg, lb] = [Math.round((br + sr) / 2), Math.round((bg + sg) / 2), Math.round((bb + sb) / 2)]; // points sur le plan : bleu éclairci

  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let points: Float32Array = new Float32Array(0);
  let params: Float32Array = new Float32Array(0); // paramètre axial (0 à 1) de chaque point
  let pointCount = 0;
  const spec: SilhouetteSpec = silhouetteSpec(options.curvature);
  const L = SILHOUETTE_LENGTH;
  const rings = RING_PARAMS.map((t) => silhouetteRing(spec, t, ringFactor(), 72));
  const extent = sceneExtent(spec); // étendue maximale du dessin (toutes rotations, inclinaisons et positions du plan) : calculée une fois
  const planeBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  let planeNow = 0;
  const axisLine = silhouetteAxis(spec, 24);
  const meridians = Array.from({ length: MERIDIAN_COUNT }, (_, i) => silhouetteMeridian(spec, (i / MERIDIAN_COUNT) * Math.PI * 2));

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
    const want = cssW < 480 ? POINTS_NARROW : cssW * cssH < 70000 ? POINTS_SMALL : POINTS_LARGE;
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
    // Unité constante (ne dépend ni de la rotation, ni de l'inclinaison, ni du plan) : tout le dessin et le plan, à toute position, tient
    // dans le cadre. Sur les bandeaux étroits (mobile), les valeurs occupent les deux côtés : l'objet reste dans la colonne centrale.
    const unit = sceneUnit(extent, cssW, cssH);
    const cx = cssW / 2;
    const cy = cssH / 2;
    const planeT = reduced ? STATIC_VIEW.scan : scanFraction(now - t0); // position du plan de balayage le long de l'axe, de 0 à 1
    planeNow = planeT;

    // Anneaux de mesure (derrière les points) : tous du même style
    ctx.lineWidth = RING_STYLE.width;
    ctx.strokeStyle = `rgba(${br},${bg},${bb},${RING_STYLE.alpha})`;
    for (let r = 0; r < rings.length; r++) {
      const poly = rings[r];
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

    // Fil de fer : méridiens de la surface (fins, derrière les points) pour lire le profil ; dessus (angle 0) et dessous (π) compris
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

    // Nuage de points ronds, tracé par lots : un seul tracé et un seul remplissage par classe de profondeur (et par état « éclairé par le
    // plan »). Classe 0 = proche (gros, opaque) à classe 5 = loin (petit, plus transparent) : le rayon décroît avec la profondeur.
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
      const cls = depthClass(tmp.depth);
      levels[i] = scanProximity(params[i] * L, planeT * L, 0.2) > 0.15 ? cls + POINT_CLASSES : cls;
    }
    for (let lv = 0; lv < POINT_CLASSES * 2; lv++) {
      const cls = lv % POINT_CLASSES;
      const lit = lv >= POINT_CLASSES;
      const rad = classRadius(cls); // les points éclairés gardent la taille de leur profondeur : seule leur teinte change
      ctx.fillStyle = lit ? `rgba(${lr},${lg},${lb},${Math.min(1, classAlpha(cls) + 0.1)})` : `rgba(${br},${bg},${bb},${classAlpha(cls)})`;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (levels[i] !== lv) continue;
        ctx.moveTo(sx[i] + rad, sy[i]);
        ctx.arc(sx[i], sy[i], rad, 0, TAU);
      }
      ctx.fill();
    }

    // Plan de balayage : coupe perpendiculaire à l'axe en sa position (disque vu en perspective), trait fin, voile léger. Il balaie de
    // l'extrémité basse à l'extrémité haute de la forme ; son rayon est fixe et sa boîte reste dans le cadre (voir `sceneExtent`).
    {
      const disc = scanDisc(spec, planeT, SCAN_DISC_RADIUS, 64);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      ctx.beginPath();
      for (let i = 0; i < disc.length; i += 3) {
        project(disc[i], disc[i + 1], disc[i + 2], view, tmp);
        const px = cx + tmp.x * unit;
        const py = cy + tmp.y * unit;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (py < y0) y0 = py;
        if (py > y1) y1 = py;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${br},${bg},${bb},${PLANE_STYLE.fillAlpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${sr},${sg},${sb},${PLANE_STYLE.strokeAlpha})`;
      ctx.lineWidth = PLANE_STYLE.width;
      ctx.stroke();
      planeBox.x0 = x0;
      planeBox.y0 = y0;
      planeBox.x1 = x1;
      planeBox.y1 = y1;
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

  // État de test (lecture seule) : voir `ScannerState`.
  Object.defineProperty(canvas, "__scannerState", {
    configurable: true,
    value: (): ScannerState => ({
      yaw: view.yaw,
      pitch: view.pitch,
      planeT: planeNow,
      unit: sceneUnit(extent, cssW, cssH),
      width: cssW,
      height: cssH,
      plane: { ...planeBox },
    }),
  });

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
