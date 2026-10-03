import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import { f1 } from "./format";
import { PRESS_CREDIT } from "./pressData";
import { percentileRows, seriesRef, type Series } from "./seoFigures";
import { valueAtPercentile } from "./stats";
import { frInt, frNumber } from "./ticker";

// Graphiques de la page presse, en PNG (1600 × 900), réutilisables avec la mention de source. Aucun chiffre qui ne vienne de
// Veale et al. (2015) ou des calculs du site ; texte et courbes uniquement, aucune silhouette.

const C = { bg: "#ffffff", fg: "#10213f", muted: "#425778", accent: "#1769ff", fill: "#dce8ff", band: "#a9c6ff", grid: "#dce4ed" };
const W = 1600;
const H = 900;

export const PRESS_CHARTS = {
  "distribution-longueur.png": { kind: "curve", series: "erect-length", title: "Longueur du pénis en érection : répartition dans la population de référence" },
  "distribution-circonference.png": { kind: "curve", series: "erect-girth", title: "Circonférence du pénis en érection : répartition dans la population de référence" },
  "tableau-percentiles.png": { kind: "table", title: "Percentiles de la longueur en érection, de 10 à 20 cm" },
} as const satisfies Record<string, { kind: "curve"; series: Series; title: string } | { kind: "table"; title: string }>;

export type PressChartName = keyof typeof PRESS_CHARTS;

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.fg, padding: "48px 64px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 24, color: C.accent, letterSpacing: 3 }}>{SITE.name.toUpperCase()}</div>
      <div style={{ display: "flex", fontSize: 40, fontWeight: 700, marginTop: 10, lineHeight: 1.2 }}>{title}</div>
      <div style={{ display: "flex", flex: 1, position: "relative", marginTop: 24 }}>{children}</div>
      <div style={{ display: "flex", fontSize: 22, color: C.muted, marginTop: 16 }}>{PRESS_CREDIT}</div>
    </div>
  );
}

function Curve({ series }: { series: Series }) {
  const r = seriesRef(series);
  const pw = W - 128; // largeur utile
  const ph = 560; // hauteur du tracé
  const top = 80;
  const base = top + ph - 70;
  const lo = r.mean - 3.5 * r.sd;
  const hi = r.mean + 3.5 * r.sd;
  const x = (v: number) => ((v - lo) / (hi - lo)) * pw;
  const y = (v: number) => base - Math.exp(-0.5 * ((v - r.mean) / r.sd) ** 2) * (base - top);
  const pts = Array.from({ length: 141 }, (_, i) => lo + ((hi - lo) * i) / 140);
  const marks = [10, 50, 90].map((p) => ({ p, v: valueAtPercentile(p, r.mean, r.sd) }));
  const bandPts = Array.from({ length: 81 }, (_, i) => marks[0].v + ((marks[2].v - marks[0].v) * i) / 80);
  const area = `M0,${base} ${pts.map((v) => `L${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} L${pw},${base} Z`;
  const band = `M${x(marks[0].v).toFixed(1)},${base} ${bandPts.map((v) => `L${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} L${x(marks[2].v).toFixed(1)},${base} Z`;
  const line = pts.map((v) => `${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i);
  return (
    <div style={{ display: "flex", position: "relative", width: pw, height: ph }}>
      <svg width={pw} height={ph} viewBox={`0 0 ${pw} ${ph}`}>
        <path d={area} fill={C.fill} />
        <path d={band} fill={C.band} />
        <polyline points={line} fill="none" stroke={C.accent} strokeWidth={4} />
        <line x1={0} x2={pw} y1={base} y2={base} stroke={C.grid} strokeWidth={2} />
        {ticks.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={base} y2={base + 10} stroke={C.muted} strokeWidth={2} />)}
        {marks.map((m) => <line key={m.p} x1={x(m.v)} x2={x(m.v)} y1={top} y2={base} stroke={m.p === 50 ? C.fg : C.muted} strokeWidth={m.p === 50 ? 3 : 2} strokeDasharray={m.p === 50 ? undefined : "8 8"} />)}
      </svg>
      {ticks.map((t) => (
        <div key={t} style={{ position: "absolute", left: x(t) - 30, top: base + 14, width: 60, display: "flex", justifyContent: "center", fontSize: 22, color: C.muted }}>{`${t}`}</div>
      ))}
      <div style={{ position: "absolute", right: 0, top: base + 44, display: "flex", fontSize: 22, color: C.muted }}>cm</div>
      {marks.map((m) => (
        <div key={m.p} style={{ position: "absolute", left: x(m.v) - 120, top: 0, width: 240, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: m.p === 50 ? C.fg : C.muted }}>{`${f1(m.v)} cm`}</div>
          <div style={{ display: "flex", fontSize: 20, color: C.muted }}>{m.p === 50 ? "médiane" : `${m.p}e percentile`}</div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, top: base + 80, display: "flex", fontSize: 22, color: C.muted }}>
        {`Zone foncée : 80 % des hommes, entre le 10e et le 90e percentile. Moyenne ${frNumber(r.mean)} cm, écart-type ${frNumber(r.sd)} cm (${frInt(r.n)} hommes mesurés).`}
      </div>
    </div>
  );
}

function Table() {
  const rows = percentileRows("erect-length", 10, 20);
  const cell = { display: "flex", flex: 1, fontSize: 26, padding: "8px 16px" } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ display: "flex", background: "#eef2f7", color: C.muted }}>
        <div style={cell}>Longueur en érection</div>
        <div style={cell}>Percentile</div>
        <div style={cell}>Sur 1 000 hommes, mesurent moins</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.cm} style={{ display: "flex", borderTop: `2px solid ${C.grid}`, background: i % 2 ? "#fafbfd" : C.bg }}>
          <div style={{ ...cell, fontWeight: 700 }}>{`${r.cm} cm`}</div>
          <div style={{ ...cell, color: C.accent, fontWeight: 700 }}>{f1(r.shown)}</div>
          <div style={cell}>{frInt(r.perThousand)}</div>
        </div>
      ))}
    </div>
  );
}

export function pressChart(name: PressChartName): ImageResponse {
  const c = PRESS_CHARTS[name];
  return new ImageResponse(<Frame title={c.title}>{c.kind === "curve" ? <Curve series={c.series} /> : <Table />}</Frame>, {
    width: W,
    height: H,
    headers: { "cache-control": "public, max-age=86400" },
  });
}

