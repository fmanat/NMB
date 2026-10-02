import { clampPercentile } from "@/lib/reportCore";
import { f1 } from "@/lib/format";
import { percentile } from "@/lib/stats";

/**
 * Courbe de distribution de la population de référence (loi normale) avec la position de l'utilisateur (ligne bleue verticale).
 * Utile et non décorative : elle explique le percentile. L'unité figure toujours sur l'axe.
 */
export function DistributionChart({ label, value, mean, sd, unit = "cm" }: { label: string; value: number; mean: number; sd: number; unit?: string }) {
  const W = 320;
  const H = 120;
  const top = 22;
  const base = H - 26;
  const lo = mean - 3.5 * sd;
  const hi = mean + 3.5 * sd;
  const x = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * W;
  const pdf = (v: number) => Math.exp(-0.5 * ((v - mean) / sd) ** 2);
  const pts = Array.from({ length: 71 }, (_, i) => {
    const v = lo + ((hi - lo) * i) / 70;
    return [x(v), base - pdf(v) * (base - top)] as const;
  });
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `M0,${base} L${pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" L")} L${W},${base} Z`;
  const ux = x(value);
  const pct = clampPercentile(percentile(value, mean, sd));
  const anchor = ux > W - 70 ? "end" : ux < 70 ? "start" : "middle";
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`${label} : ${f1(value)} ${unit}, percentile ${f1(pct)}. Courbe de la population de référence, médiane ${f1(mean)} ${unit}.`}
      >
        <path d={area} fill="var(--bm-blue-100)" />
        <polyline points={line} fill="none" stroke="var(--bm-blue-400)" strokeWidth="2" />
        <line x1={x(mean)} x2={x(mean)} y1={top} y2={base} stroke="var(--bm-gray-500)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--border)" />
        <line x1={ux} x2={ux} y1={top - 6} y2={base} stroke="var(--accent)" strokeWidth="2.5" />
        <circle cx={ux} cy={top - 6} r="4" fill="var(--accent)" />
        <text x={ux} y="10" fontSize="12" fontWeight="700" fill="var(--accent)" textAnchor={anchor} className="num">{`Vous : ${f1(value)} ${unit}`}</text>
        <text x="0" y={H - 8} fontSize="11" fill="var(--bm-navy-700)" textAnchor="start" className="num">{`${f1(lo)} ${unit}`}</text>
        <text x={Math.min(W - 60, Math.max(60, x(mean)))} y={H - 8} fontSize="11" fill="var(--bm-navy-700)" textAnchor="middle" className="num">{`médiane ${f1(mean)} ${unit}`}</text>
        <text x={W} y={H - 8} fontSize="11" fill="var(--bm-navy-700)" textAnchor="end" className="num">{`${f1(hi)} ${unit}`}</text>
      </svg>
    </figure>
  );
}
