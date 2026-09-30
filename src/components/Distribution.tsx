import { clampPercentile } from "@/lib/report";
import { percentile } from "@/lib/stats";

// Courbe de distribution normale avec le repère de l'utilisateur.
export function Distribution({ label, value, mean, sd, unit = "cm" }: { label: string; value: number; mean: number; sd: number; unit?: string }) {
  const W = 300;
  const H = 90;
  const lo = mean - 4 * sd;
  const hi = mean + 4 * sd;
  const x = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * W;
  const pdf = (v: number) => Math.exp(-0.5 * ((v - mean) / sd) ** 2);
  const pts = Array.from({ length: 81 }, (_, i) => {
    const v = lo + ((hi - lo) * i) / 80;
    return `${x(v).toFixed(1)},${(H - 8 - pdf(v) * (H - 24)).toFixed(1)}`;
  });
  const ux = x(value);
  const pct = Math.round(clampPercentile(percentile(value, mean, sd)));
  return (
    <figure className="panel p-4">
      <figcaption className="text-sm mb-2 flex justify-between">
        <span>{label}</span>
        <span className="num text-accent-2">P{pct}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label} : percentile ${pct}`}>
        <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <line x1={x(mean)} x2={x(mean)} y1="8" y2={H - 8} stroke="var(--border)" strokeDasharray="3 3" />
        <line x1={ux} x2={ux} y1="4" y2={H - 8} stroke="var(--accent-2)" strokeWidth="2" />
        <text x={Math.min(W - 40, Math.max(2, ux + 4))} y="14" fontSize="10" fill="var(--accent-2)" className="num">
          {String(value).replace(".", ",")} {unit}
        </text>
      </svg>
      <p className="text-xs text-muted mt-1">Trait pointillé : médiane de référence ({String(mean).replace(".", ",")} {unit}).</p>
    </figure>
  );
}
