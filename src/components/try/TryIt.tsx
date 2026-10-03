"use client";

import { useEffect, useMemo, useState } from "react";
import { f1, aboveText } from "@/lib/format";
import { OUT_OF_RANGE_MESSAGE } from "@/lib/reportCore";
import { TRY_BOUNDS, TRY_DEFAULTS, simulate, type TryItProps, type TryValues } from "@/lib/tryIt";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { choiceClass } from "@/components/ui/choiceStyles";
import { Icon } from "@/components/ui/Icon";
import { DimensionMetrics, PercentilePositions, SizeReferences } from "@/components/report/ReportParts";

// Simulation « Essayez » : tout se calcule ici, dans le navigateur. Aucune requête, aucun envoi, aucun stockage (ni cookie, ni localStorage).
// Les résultats viennent de `simulate` (lib/tryIt), qui appelle les mêmes fonctions que le rapport réel ; l'affichage réutilise les composants du rapport.

function Slider({ id, label, dim, value, onChange }: { id: string; label: string; dim: "length" | "girth"; value: number; onChange: (v: number) => void }) {
  const { min, max } = TRY_BOUNDS[dim];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <span className="num font-semibold text-accent whitespace-nowrap" aria-hidden="true">{f1(value)} cm</span>
      </div>
      <input
        id={id}
        type="range"
        className="bm-range mt-1"
        min={min}
        max={max}
        step={TRY_BOUNDS.step}
        value={value}
        aria-valuetext={`${f1(value)} cm`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between t-caption text-muted" aria-hidden="true">
        <span>{min} cm</span>
        <span>{max} cm</span>
      </div>
    </div>
  );
}

export default function TryIt({ initial, compact = false, idPrefix = "try" }: TryItProps = {}) {
  const start = initial ?? TRY_DEFAULTS;
  const prefilled = !!initial;
  const [v, setV] = useState<TryValues>(start);
  const outcome = useMemo(() => simulate(v), [v]);
  const atDefaults = v.state === start.state && v.length === start.length && v.girth === start.girth;

  // Annonce vocale : résumé des percentiles, légèrement différé pour ne pas parler à chaque cran du curseur.
  const summary = outcome.kind === "ok" ? `Longueur : ${aboveText(outcome.results.length.percentile)}. Circonférence : ${aboveText(outcome.results.girth.percentile)}.` : OUT_OF_RANGE_MESSAGE;
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(summary), 600);
    return () => clearTimeout(t);
  }, [summary]);

  return (
    <div className="space-y-6">
      <Card as="section" className="!p-5 md:!p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="t-h4">Vos valeurs</h3>
          {atDefaults ? (
            prefilled ? <Badge tone="blue">Valeurs préremplies</Badge> : <Badge tone="warning">Exemple · valeurs fictives</Badge>
          ) : (
            <Badge tone="blue">Valeurs de votre simulation</Badge>
          )}
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold mb-2">État</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={choiceClass}>
              <input type="radio" name={`${idPrefix}-state`} value="rest" checked={v.state === "rest"} onChange={() => setV((p) => ({ ...p, state: "rest" }))} className="accent-[var(--accent)]" /> Au repos
            </label>
            <label className={choiceClass}>
              <input type="radio" name={`${idPrefix}-state`} value="erect" checked={v.state === "erect"} onChange={() => setV((p) => ({ ...p, state: "erect" }))} className="accent-[var(--accent)]" /> En érection
            </label>
          </div>
        </fieldset>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 sm:gap-8">
          <Slider id={`${idPrefix}-length`} label="Longueur (cm)" dim="length" value={v.length} onChange={(length) => setV((p) => ({ ...p, length }))} />
          <Slider id={`${idPrefix}-girth`} label="Circonférence (cm)" dim="girth" value={v.girth} onChange={(girth) => setV((p) => ({ ...p, girth }))} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="t-small text-muted">Les curseurs vont des bornes du questionnaire ; au pas de 0,1 cm.</p>
          <button type="button" className="btn btn-tertiary btn-sm" disabled={atDefaults} onClick={() => setV(start)}>
            {prefilled ? "Revenir aux valeurs de départ" : "Revenir à l'exemple"}
          </button>
        </div>
      </Card>

      <div role="status" aria-live="polite" className="sr-only">{announced}</div>

      {outcome.kind === "ok" ? (
        <div className="space-y-6" data-testid="try-results">
          <Card as="section" className="!p-5 md:!p-6">
            <p className="t-eyebrow">Votre position</p>
            <PercentilePositions results={outcome.results} className="mt-3" />
          </Card>
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <DimensionMetrics results={outcome.results} landmark={false} />
          </div>
          {!compact && <SizeReferences results={outcome.results} headingLevel={3} />}
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-[10px] bg-[var(--bm-error-soft)] px-4 py-3 text-sm font-medium" style={{ color: "var(--bm-error-text)" }} data-testid="try-out-of-range">
          <Icon name="info" size={18} className="mt-0.5 flex-none" />
          <span>{OUT_OF_RANGE_MESSAGE}</span>
        </p>
      )}
    </div>
  );
}
