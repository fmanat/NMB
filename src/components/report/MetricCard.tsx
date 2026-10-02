import type { ReactNode } from "react";

/** Carte d'indicateur : libellé, valeur et unité (jamais séparées), interprétation courte, puis visualisation. Valeur avant graphique. */
export function MetricCard({ label, value, unit, interpretation, badge, children }: { label: string; value: string; unit?: string; interpretation?: string; badge?: ReactNode; children?: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4" aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="t-caption uppercase tracking-[0.08em] text-muted">{label}</h3>
        {badge}
      </div>
      <p className="t-data-l num leading-none">
        {value}
        {unit && <span className="text-[18px] font-semibold text-muted ml-1.5">{unit}</span>}
      </p>
      {interpretation && <p className="t-small text-muted -mt-2">{interpretation}</p>}
      {children}
    </section>
  );
}
