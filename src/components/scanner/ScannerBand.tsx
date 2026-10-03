import type { ReactNode } from "react";
import type { QuestionnaireResults } from "@/lib/report";
import { DIRECTION_FR } from "@/lib/report";
import { f1, rankLabel } from "@/lib/format";
import { CAMERA_DISTANCE, CYLINDER, STATIC_VIEW, generateCylinderPoints, project, ringHeights, ringPolyline, type View } from "@/lib/scanner3d";
import { ScannerShell } from "./ScannerShell";

// Bandeau « scanner » (dérogation de charte décidée par le propriétaire : 3D et fond sombre pour ce seul bandeau).
// Le REPLI statique ci-dessous reste le cylindre géométrique abstrait (jamais la silhouette du moteur animé : décision du propriétaire
// du 03/10/2026, docs/DECISIONS.md ; un test garantit que ce fichier n'importe pas la silhouette). Les valeurs affichées autour sont celles du rapport d'EXEMPLE (fictif), jamais des mesures réelles.

const W = 400;
const H = 240;

/** Repli statique : la même scène que le moteur, calculée sur le serveur (une seule image fixe, sans script ni canvas). */
function StaticScene() {
  const view: View = { yaw: STATIC_VIEW.yaw, pitch: STATIC_VIEW.pitch, cameraDistance: CAMERA_DISTANCE };
  const unit = Math.min(H / 3.5, W / 3.2);
  const X = (v: number) => (W / 2 + v * unit).toFixed(1);
  const Y = (v: number) => (H / 2 + v * unit).toFixed(1);

  const dots = generateCylinderPoints(320);
  let dotPath = "";
  for (let i = 0; i < dots.length; i += 3) {
    const p = project(dots[i], dots[i + 1], dots[i + 2], view);
    const near = p.depth < CAMERA_DISTANCE; // face tournée vers la caméra : plus marquée
    dotPath += near ? `M${X(p.x)} ${Y(p.y)}h1.8v1.8h-1.8z` : "";
  }
  let farPath = "";
  for (let i = 0; i < dots.length; i += 3) {
    const p = project(dots[i], dots[i + 1], dots[i + 2], view);
    if (p.depth >= CAMERA_DISTANCE) farPath += `M${X(p.x)} ${Y(p.y)}h1.2v1.2h-1.2z`;
  }

  const ringPath = (y: number, r: number) => {
    const poly = ringPolyline(y, r, 48);
    let d = "";
    for (let i = 0; i < poly.length; i += 3) {
      const p = project(poly[i], poly[i + 1], poly[i + 2], view);
      d += `${i === 0 ? "M" : "L"}${X(p.x)} ${Y(p.y)}`;
    }
    return d;
  };
  const hs = ringHeights(5);
  const planeY = -CYLINDER.halfHeight + STATIC_VIEW.scan * 2 * CYLINDER.halfHeight;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="size-full" focusable="false" aria-hidden="true">
      {hs.map((y, i) => (
        <path key={i} d={ringPath(y, i === 0 || i === hs.length - 1 ? 1.22 : 1.12)} fill="none" stroke="var(--bm-blue-400)" strokeOpacity={i === 0 || i === hs.length - 1 ? 0.5 : 0.28} strokeWidth="1" />
      ))}
      <path d={farPath} fill="var(--bm-blue-400)" fillOpacity="0.35" />
      <path d={dotPath} fill="var(--bm-blue-400)" fillOpacity="0.85" />
      <path d={ringPath(planeY, 1.38) + "Z"} fill="var(--bm-blue-400)" fillOpacity="0.1" stroke="var(--bm-dark-text)" strokeOpacity="0.85" strokeWidth="1.5" />
    </svg>
  );
}

function Stat({ pos, label, value, sub }: { pos: string; label: string; value: ReactNode; sub: string }) {
  return (
    <div className={`absolute ${pos} max-w-[46%]`}>
      <dt className="text-[10px] leading-[14px] font-semibold uppercase tracking-[0.05em] min-[390px]:text-[11px] lg:tracking-[0.08em] text-[var(--bm-dark-secondary)] lg:text-[12px] lg:leading-4">{label}</dt>
      <dd className="num text-[17px] leading-6 font-bold min-[390px]:text-[20px] lg:text-[28px] lg:leading-8">{value}</dd>
      <dd className="text-[11px] leading-[14px] text-[var(--bm-dark-secondary)] lg:text-[13px] lg:leading-[18px]">{sub}</dd>
    </div>
  );
}

export function ScannerBand({ ex }: { ex: QuestionnaireResults }) {
  const dir = ex.curvature.direction !== "none" ? DIRECTION_FR[ex.curvature.direction] : "sans direction";
  return (
    <ScannerShell
      curvature={{ angleDeg: ex.curvature.angleDeg, direction: ex.curvature.direction }}
      fallback={<StaticScene />}
      labels={
        <dl className="pointer-events-none absolute inset-0 m-0">
          <Stat pos="left-3 top-3 lg:left-5 lg:top-5" label="Longueur" value={<>{f1(ex.length.value)} cm</>} sub={rankLabel(ex.length.percentile)} />
          <Stat pos="right-3 top-3 text-right lg:right-5 lg:top-5" label="Circonférence" value={<>{f1(ex.girth.value)} cm</>} sub={rankLabel(ex.girth.percentile)} />
          <Stat pos="left-3 bottom-3 lg:left-5 lg:bottom-5" label="Courbure" value={<>{f1(ex.curvature.angleDeg)}°</>} sub={dir} />
          <Stat pos="right-3 bottom-3 text-right lg:right-5 lg:bottom-5" label="Score global" value={<>{Math.round(ex.score)} / 100</>} sub="Note de présentation" />
        </dl>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-[var(--bm-dark-border)] px-3 py-2 lg:px-5 lg:py-3">
          <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-[#ffb020] px-2 py-0.5 text-[12px] leading-4 font-semibold text-[#ffb020]">
            Exemple · valeurs fictives
          </span>
          <span className="hidden text-[12px] leading-4 text-[var(--bm-dark-secondary)] group-data-[scanner=live]:inline">Faites glisser pour tourner</span>
          <span className="sr-only">
            Visualisation schématique de mesure : nuage de points, anneaux de mesure et plan de balayage.
          </span>
        </div>
      }
    />
  );
}
