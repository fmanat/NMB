import type { ReportResults } from "@/lib/reportCore";
import { referenceFor } from "@/lib/stats";
import { aboveText, f1 } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { DistributionChart } from "./DistributionChart";
import { MetricCard } from "./MetricCard";
import { PercentileBar } from "./PercentileBar";

// Morceaux du rapport partagés entre le tableau de bord du rapport (serveur) et la simulation « Essayez » de l'accueil (navigateur).
// Ils reçoivent des résultats déjà calculés par `buildQuestionnaireReport` : aucun calcul statistique ici, aucun libellé propre à la simulation.

/** Les deux encadrés « Au-dessus de X % de la population de référence » (longueur, circonférence). */
export function PercentilePositions({ results: r, className = "mt-5" }: { results: ReportResults; className?: string }) {
  return (
    <div className={`${className} grid gap-3 text-left sm:grid-cols-2`}>
      <div className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
        <p className="t-caption text-muted uppercase tracking-[0.08em]">Longueur</p>
        <p className="num font-semibold mt-1">{r.length.percentile !== undefined ? aboveText(r.length.percentile) : "Non positionnée au repos"}</p>
      </div>
      <div className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
        <p className="t-caption text-muted uppercase tracking-[0.08em]">Circonférence</p>
        <p className="num font-semibold mt-1">{r.girth.percentile !== undefined ? aboveText(r.girth.percentile) : "—"}</p>
      </div>
    </div>
  );
}

/** Cartes d'indicateur de longueur et de circonférence : valeur, médiane de référence, barre de percentile et courbe de distribution. */
export function DimensionMetrics({ results: r, landmark = true }: { results: ReportResults; landmark?: boolean }) {
  const lenRef = referenceFor(r.state, "length");
  const girthRef = referenceFor(r.state, "girth");
  const state = r.state === "rest" ? "au repos" : "en érection";
  const declared = r.formula === "A";
  return (
    <>
      <MetricCard
        label={`Longueur ${state}`}
        landmark={landmark}
        value={f1(r.length.value)}
        unit="cm"
        interpretation={`${declared ? "Valeur déclarée" : `Estimation, marge ± ${r.length.marginPct} %`} · médiane de référence ${f1(r.length.referenceMedian)} cm`}
      >
        {r.length.percentile !== undefined && <PercentileBar percentile={r.length.percentile} label="Percentile de longueur" />}
        <DistributionChart label="Longueur" value={r.length.value} mean={lenRef.mean} sd={lenRef.sd} />
      </MetricCard>
      <MetricCard
        label={`Circonférence ${state}`}
        landmark={landmark}
        value={f1(r.girth.value)}
        unit="cm"
        interpretation={`${declared ? "Valeur déclarée" : `Estimation, marge ± ${r.girth.marginPct} %`} · médiane de référence ${f1(r.girth.referenceMedian)} cm`}
      >
        {r.girth.percentile !== undefined && <PercentileBar percentile={r.girth.percentile} label="Percentile de circonférence" />}
        <DistributionChart label="Circonférence" value={r.girth.value} mean={girthRef.mean} sd={girthRef.sd} />
      </MetricCard>
    </>
  );
}

/** « Repères de taille » : la longueur exprimée en multiples d'objets du quotidien et de monuments connus. */
export function SizeReferences({ results: r, headingLevel = 2 }: { results: ReportResults; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div>
      <Heading className="t-h3 mb-1">Repères de taille</Heading>
      <p className="t-small text-muted mb-4">Votre longueur exprimée en multiples d&apos;objets et de monuments connus (hauteurs publiques).</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...r.everyday, ...r.landmarks].map((o) => (
          <Card key={o.label} as="li" className="!p-4 list-none">
            <p className="t-small text-muted">{o.label}</p>
            <p className="num t-data-l mt-1">
              {o.times.toLocaleString("fr-FR")}
              <span className="text-[16px] font-semibold text-muted ml-1.5">× vous</span>
            </p>
          </Card>
        ))}
      </ul>
    </div>
  );
}
