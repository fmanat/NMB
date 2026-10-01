// Jauge circulaire décorative (aucune donnée réelle : valeur "--" tant que rien n'est calculé).
export function Gauge({ label, value }: { label: string; value?: number }) {
  // Sans valeur, la jauge est un simple décor : masquée aux lecteurs d'écran (le libellé reste lu dans le texte qui la suit).
  const decorative = value === undefined;
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = value === undefined ? 0 : Math.min(1, Math.max(0, value / 100));
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" className="size-20 sm:size-28" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${label} : ${Math.round(value)} sur 100` })}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="68" textAnchor="middle" className="num" fill="var(--foreground)" fontSize="24">
          {value === undefined ? "--" : Math.round(value)}
        </text>
      </svg>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
