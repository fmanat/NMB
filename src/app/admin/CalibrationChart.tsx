import type { DimSummary } from "@/lib/admin/calibration";

// Nuage de points de calibration (administration) : en abscisse la mesure par la carte de référence, en ordonnée l'estimation du
// modèle sans la carte, avec la diagonale « estimation = mesure ». Un modèle qui ramène vers la moyenne donne un nuage plus plat que
// la diagonale (points au-dessus à gauche, en dessous à droite). SVG rendu par le serveur ; info-bulle native sur chaque point.

const W = 320;
const H = 240;
const PAD = { l: 40, r: 12, t: 12, b: 32 };
const f1 = (n: number) => n.toFixed(1).replace(".", ",");

export function CalibrationChart({ title, s, range }: { title: string; s: DimSummary; range: [number, number] }) {
  const [lo, hi] = range;
  const x = (v: number) => PAD.l + ((v - lo) / (hi - lo)) * (W - PAD.l - PAD.r);
  const y = (v: number) => H - PAD.b - ((v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  const step = hi - lo > 12 ? 4 : 2;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px] h-auto" role="img" aria-label={`${title} : ${s.n} paire(s), estimation du modèle en fonction de la mesure par la carte`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border)" strokeWidth="1" />
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={x(t)} y={H - PAD.b + 14} textAnchor="middle" fontSize="10" fill="var(--muted)">{t}</text>
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        ))}
        <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x={x(hi) - 4} y={y(hi) + 14} textAnchor="end" fontSize="10" fill="var(--muted)">estimation = mesure</text>
        {s.points.map((p, i) => (
          <circle key={i} cx={x(clamp(p.card))} cy={y(clamp(p.model))} r="4" fill="var(--accent)" stroke="var(--surface, #fff)" strokeWidth="2">
            <title>{`mesure par la carte ${f1(p.card)} cm · estimation sans la carte ${f1(p.model)} cm`}</title>
          </circle>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">mesure par la carte (cm)</text>
        <text x={10} y={(PAD.t + H - PAD.b) / 2} textAnchor="middle" fontSize="10" fill="var(--muted)" transform={`rotate(-90 10 ${(PAD.t + H - PAD.b) / 2})`}>estimation sans la carte (cm)</text>
      </svg>
    </figure>
  );
}
