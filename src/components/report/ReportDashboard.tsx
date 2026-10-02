import Link from "next/link";
import type { ReportResults } from "@/lib/report";
import { DIRECTION_FR } from "@/lib/report";
import { referenceFor } from "@/lib/stats";
import { aboveText, f1 } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CurvatureIndicator } from "./CurvatureIndicator";
import { DistributionChart } from "./DistributionChart";
import { MetricCard } from "./MetricCard";
import { PercentileBar } from "./PercentileBar";
import { ScoreRing } from "./ScoreRing";

const CURVE_LABEL = { none: "Aucune", light: "Légère", marked: "Marquée" } as const;

/**
 * Tableau de bord d'un rapport : score, position statistique, indicateurs, repères de taille.
 * Reçoit des résultats déjà calculés (aucun calcul statistique ici). Sert au rapport réel et à l'exemple fictif de l'accueil.
 */
export function ReportDashboard({ results: r, example = false }: { results: ReportResults; example?: boolean }) {
  const lenRef = referenceFor(r.state, "length");
  const girthRef = referenceFor(r.state, "girth");
  const state = r.state === "rest" ? "au repos" : "en érection";
  const declared = r.formula === "A";
  const curve = r.curvature;
  const medical = curve.angleDeg >= 30;

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 1. Score global et position statistique */}
      <Card as="section" className="!p-6 md:!p-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
          <ScoreRing score={r.score} />
          <div className="flex-1 w-full text-center md:text-left">
            <div className="flex items-center justify-center gap-2 md:justify-start">
              <p className="t-eyebrow">Score global</p>
              {example && <Badge tone="warning">Exemple fictif</Badge>}
            </div>
            <p className="t-small text-muted mt-2 max-w-[46ch] md:max-w-none">
              Note de présentation, volontairement indulgente : ce n&apos;est pas un percentile.{" "}
              <Link href="/methode" className="text-accent underline">Voir la méthode</Link>
            </p>
            <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
                <p className="t-caption text-muted uppercase tracking-[0.08em]">Longueur</p>
                <p className="num font-semibold mt-1">{aboveText(r.length.percentile)}</p>
              </div>
              <div className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
                <p className="t-caption text-muted uppercase tracking-[0.08em]">Circonférence</p>
                <p className="num font-semibold mt-1">{aboveText(r.girth.percentile)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Indicateurs */}
      <div>
        <h2 className="t-h3 mb-4">Indicateurs</h2>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <MetricCard
            label={`Longueur ${state}`}
            value={f1(r.length.value)}
            unit="cm"
            interpretation={`${declared ? "Valeur déclarée" : `Estimation, marge ± ${r.length.marginPct} %`} · médiane de référence ${f1(r.length.referenceMedian)} cm`}
          >
            <PercentileBar percentile={r.length.percentile} label="Percentile de longueur" />
            <DistributionChart label="Longueur" value={r.length.value} mean={lenRef.mean} sd={lenRef.sd} />
          </MetricCard>
          <MetricCard
            label={`Circonférence ${state}`}
            value={f1(r.girth.value)}
            unit="cm"
            interpretation={`${declared ? "Valeur déclarée" : `Estimation, marge ± ${r.girth.marginPct} %`} · médiane de référence ${f1(r.girth.referenceMedian)} cm`}
          >
            <PercentileBar percentile={r.girth.percentile} label="Percentile de circonférence" />
            <DistributionChart label="Circonférence" value={r.girth.value} mean={girthRef.mean} sd={girthRef.sd} />
          </MetricCard>
          <MetricCard
            label="Courbure"
            value={f1(curve.angleDeg)}
            unit="°"
            interpretation={`${CURVE_LABEL[curve.category]}${curve.direction !== "none" ? ` ${DIRECTION_FR[curve.direction]}` : ""} · ${declared ? `valeur déclarée, angle retenu ${f1(curve.angleDeg)}°` : "estimée"}`}
          >
            <CurvatureIndicator angleDeg={curve.angleDeg} />
            {medical && <p className="t-small text-muted">Une courbure de 30° ou plus justifie l&apos;avis d&apos;un professionnel de santé.</p>}
          </MetricCard>
          {r.symmetry !== undefined && (
            <MetricCard label="Symétrie" value={String(Math.round(r.symmetry))} unit="/ 100" interpretation="Écart entre les demi-largeurs gauche et droite (100 = identiques)">
              <PercentileBar percentile={r.symmetry} label="Symétrie" />
            </MetricCard>
          )}
        </div>
      </div>

      {/* 3. Repères de taille */}
      <div>
        <h2 className="t-h3 mb-1">Repères de taille</h2>
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
    </div>
  );
}
