/** Anneau de score : reçoit un score (0 à 100) et l'affiche. Ne connaît pas la formule de calcul. */
export function ScoreRing({ score, size = "lg" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, score / 100));
  const dim = size === "lg" ? "w-[160px] h-[160px] md:w-[200px] md:h-[200px]" : size === "md" ? "w-[120px] h-[120px]" : "w-[96px] h-[96px]";
  return (
    <div data-reveal-on-view className={`relative ${dim} flex-none`} role="img" aria-label={`Score global : ${Math.round(score)} sur 100`}>
      <svg viewBox="0 0 180 180" className="absolute inset-0 size-full" aria-hidden="true">
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--bm-gray-200)" strokeWidth="12" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 90 90)"
          className="anim-ring"
          style={{ ["--len" as string]: c * pct }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" aria-hidden="true">
        <span className={`num font-bold leading-none ${size === "lg" ? "text-[56px] md:text-[64px]" : size === "md" ? "text-[44px]" : "text-[34px]"}`}>{Math.round(score)}</span>
        <span className={`num text-muted mt-1 ${size === "sm" ? "text-[12px]" : "text-[16px]"}`}>/ 100</span>
      </div>
    </div>
  );
}
