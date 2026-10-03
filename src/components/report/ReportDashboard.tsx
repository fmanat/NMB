import Link from "next/link";
import type { ReportResults } from "@/lib/reportCore";
import { DIRECTION_FR } from "@/lib/reportCore";
import { f1, rankLabel } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CurvatureIndicator } from "./CurvatureIndicator";
import { MetricCard } from "./MetricCard";
import { PercentileBar } from "./PercentileBar";
import { ProfileCard } from "./ProfileCard";
import { DimensionMetrics, PercentilePositions, SizeReferences } from "./ReportParts";
import { ScoreRing } from "./ScoreRing";

const CURVE_LABEL = { none: "Aucune", light: "Légère", marked: "Marquée" } as const;

/**
 * Tableau de bord d'un rapport : score, position statistique, indicateurs, repères de taille.
 * Reçoit des résultats déjà calculés (aucun calcul statistique ici). Sert au rapport réel et à l'exemple fictif de l'accueil.
 */
export function ReportDashboard({ results: r, example = false, lead = "score" }: { results: ReportResults; example?: boolean; lead?: "score" | "percentile" }) {
  const declared = r.formula === "A";
  const curve = r.curvature;
  const medical = curve.angleDeg >= 30;
  const state = r.state === "rest" ? "au repos" : "en érection";

  return (
    <div className="space-y-6 md:space-y-8">
      {/* 1. Position statistique en tête (accueil : le percentile est l'information principale), score au second plan */}
      {lead === "percentile" && r.length.percentile !== undefined ? (
        <Card as="section" className="!p-6 md:!p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="t-eyebrow">Longueur {state}</p>
                {example && <Badge tone="warning">Exemple fictif</Badge>}
              </div>
              <p className="num font-bold text-accent mt-2 text-[40px] leading-[44px] md:text-[56px] md:leading-[60px]">{rankLabel(r.length.percentile)}</p>
              <p className="t-lead mt-2">{`Au-dessus d'environ ${Math.floor(r.length.percentile)} % de la population de référence`}</p>
              {r.girth.percentile !== undefined && (
                <p className="t-small text-muted mt-3">
                  Circonférence {state} : <span className="num font-semibold text-foreground">{rankLabel(r.girth.percentile)}</span>, au-dessus d&apos;environ {Math.floor(r.girth.percentile)} % de la population de référence.
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 rounded-[12px] border border-[var(--border)] p-4 md:w-[300px]">
              <ScoreRing score={r.score} size="sm" />
              <div>
                <p className="t-small font-semibold">Score global</p>
                <p className="t-caption text-muted mt-1">
                  Note de présentation, volontairement indulgente : ce n&apos;est pas un percentile.{" "}
                  <Link href="/methode" className="text-accent underline">Voir la méthode</Link>
                </p>
              </div>
            </div>
          </div>
        </Card>
      ) : (
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
            <PercentilePositions results={r} />
          </div>
        </div>
      </Card>
      )}

      {/* 2. Profil morphologique (case de la grille 3 × 3, d'après les deux percentiles) */}
      <ProfileCard results={r} example={example} />

      {/* 3. Indicateurs */}
      <div>
        <h2 className="t-h3 mb-4">Indicateurs</h2>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <DimensionMetrics results={r} />
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

      {/* 4. Repères de taille */}
      <SizeReferences results={r} />
    </div>
  );
}
