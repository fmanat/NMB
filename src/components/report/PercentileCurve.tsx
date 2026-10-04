import { f1 } from "@/lib/format";

/**
 * Courbe « percentile » : la population de référence (loi normale) dont la partie située SOUS la valeur est remplie.
 * La surface remplie représente exactement le percentile (part de la population en dessous) : c'est l'image du chiffre, pas un décor.
 * Reçoit une valeur et une référence déjà connues ; aucun calcul de percentile ici (le libellé vient de l'appelant).
 * `tone` : « light » sur fond clair, « dark » sur fond sombre (hero du résultat).
 */
export function PercentileCurve({
  value,
  mean,
  sd,
  unit = "cm",
  label,
  tone = "light",
  className = "",
}: {
  value: number;
  mean: number;
  sd: number;
  unit?: string;
  /** Texte accessible complet (ex. « Longueur 13,8 cm : au-dessus d'environ 65 % de la population de référence »). */
  label: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const W = 320;
  const H = 112;
  const top = 10;
  const base = H - 22;
  const lo = mean - 3.2 * sd;
  const hi = mean + 3.2 * sd;
  const x = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * W;
  const y = (v: number) => base - Math.exp(-0.5 * ((v - mean) / sd) ** 2) * (base - top);
  const N = 80;
  const pts = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N);
  const path = (to: number) => {
    const xs = pts.filter((v) => v <= to);
    const seg = xs.map((v) => `L${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return `M0,${base} ${seg} L${x(to).toFixed(1)},${y(to).toFixed(1)} L${x(to).toFixed(1)},${base} Z`;
  };
  const outline = pts.map((v) => `${x(v).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ux = x(value);
  const dark = tone === "dark";
  const c = dark
    ? { rest: "rgba(255,255,255,0.08)", line: "rgba(255,255,255,0.35)", fill: "url(#pc-grad-dark)", marker: "#ffffff", axis: "rgba(255,255,255,0.55)" }
    : { rest: "var(--bm-blue-050)", line: "var(--bm-blue-400)", fill: "url(#pc-grad-light)", marker: "var(--bm-navy-900)", axis: "var(--bm-navy-700)" };
  const anchor = ux > W - 64 ? "end" : ux < 64 ? "start" : "middle";

  return (
    <figure className={className} data-reveal-on-view>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label}>
        <defs>
          <linearGradient id="pc-grad-light" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#9cc0ff" />
            <stop offset="1" stopColor="#1769ff" />
          </linearGradient>
          <linearGradient id="pc-grad-dark" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#2a5fd6" />
            <stop offset="1" stopColor="#5b9bff" />
          </linearGradient>
        </defs>
        <path d={path(hi)} fill={c.rest} />
        <path d={path(value)} fill={c.fill} className="anim-fade" />
        <polyline points={outline} fill="none" stroke={c.line} strokeWidth="1.5" />
        <line x1="0" x2={W} y1={base} y2={base} stroke={c.line} />
        <line className="anim-marker" x1={ux} x2={ux} y1={top - 4} y2={base} stroke={c.marker} strokeWidth="2" />
        <circle className="anim-marker" cx={ux} cy={top - 4} r="3.5" fill={c.marker} />
        <text x={ux} y={H - 6} fontSize="12" fontWeight="700" fill={c.marker} textAnchor={anchor} className="num">{`${f1(value)} ${unit}`}</text>
        <text x="0" y={H - 6} fontSize="10.5" fill={c.axis} textAnchor="start" className="num" aria-hidden="true">{ux < 70 ? "" : `${f1(lo)}`}</text>
        <text x={W} y={H - 6} fontSize="10.5" fill={c.axis} textAnchor="end" className="num" aria-hidden="true">{ux > W - 70 ? "" : `${f1(hi)}`}</text>
      </svg>
    </figure>
  );
}
