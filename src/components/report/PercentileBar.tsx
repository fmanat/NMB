import { f1 } from "@/lib/format";

/** Barre de percentile : même composant partout. Le repère est positionné exactement à la valeur (0 à 100). */
export function PercentileBar({ percentile, label, compact = false }: { percentile: number; label?: string; compact?: boolean }) {
  const p = Math.min(100, Math.max(0, percentile));
  const name = label ?? "Percentile";
  return (
    <div data-reveal-on-view>
      <div className={`flex items-baseline justify-between gap-3 ${compact ? "mb-1" : "mb-2"}`}>
        <span className={compact ? "sr-only" : "t-small font-semibold"}>{name}</span>
        <span className={`num font-semibold text-accent whitespace-nowrap ${compact ? "t-caption ml-auto" : "t-small"}`}>
          {f1(percentile)}
          <span className="text-muted font-medium"> sur 100</span>
        </span>
      </div>
      <div className="relative h-[6px] rounded-full bg-[#e5ebf2]" role="img" aria-label={`${name} : ${f1(percentile)} sur 100`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent anim-bar" style={{ width: `${p}%` }} />
        <div className="anim-marker absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-accent shadow-[0_0_0_1px_var(--accent)]" style={{ left: `${p}%` }} />
      </div>
      {!compact && (
      <div className="flex justify-between t-caption text-muted mt-1.5" aria-hidden="true">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      )}
    </div>
  );
}
