import Link from "next/link";
import { INDICATOR_KEYS, INDICATOR_LABELS, indicatorValue, frNum } from "@/lib/morpho";
import { SECTION_KEYS, SECTION_TITLES } from "@/lib/morphoText";
import { PARTIAL_LABEL, RETAKE_ADVICE } from "@/lib/photoReport2";
import { profileFor } from "@/lib/profiles";
import type { ReportResults } from "@/lib/reportCore";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

// Rapport d'analyse morphométrique (formule photo, version photo-report/2), mis en forme comme un compte rendu : en-tête, synthèse,
// tableau des indicateurs, rubriques titrées, points remarquables, conclusion, note du laboratoire. La version PDF est l'impression
// de cette même page (bouton « Télécharger en PDF »). Aucune image, aucune silhouette ; aucun calcul ici (valeurs déjà calculées).

const STATE_LABEL = { rest: "Repos", erect: "Érection" } as const;
const METHOD_LABEL = { visuelle: "Estimation visuelle", calibree: "Mesure calibrée", reference: "Valeurs de référence" } as const;

export function MorphoReport({ results: r, date, beta }: { results: ReportResults; date: string; beta: boolean }) {
  const m = r.morpho!;
  const t = m.texte;
  const ind = m.indicateurs;
  const state = ind?.state ?? m.reference?.state ?? r.state;
  const profile = ind && ind.percentileLongueur !== null ? profileFor(ind.percentileLongueur, ind.percentileCirconference) : null;

  return (
    <article className="morpho-report space-y-8" data-morpho-report={m.schemaVersion} data-partial={m.partielle ? "oui" : "non"}>
      {/* 1. En-tête */}
      <header className="morpho-section space-y-3 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="t-eyebrow">Laboratoire Bitomètre · compte rendu</p>
          {beta && <Badge tone="warning">BÊTA GRATUITE</Badge>}
          {m.methode === "calibree" && <Badge tone="success">Taille calibrée</Badge>}
          {m.partielle && <Badge tone="warning">{PARTIAL_LABEL}</Badge>}
        </div>
        <h1 className="t-h1 !text-[28px] !leading-[34px] md:!text-[40px] md:!leading-[46px]">
          Rapport d&apos;analyse morphométrique n°&nbsp;<span className="num">{m.numero}</span>
        </h1>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1 t-small sm:grid-cols-3">
          <div className="flex gap-2"><dt className="text-muted">Date</dt><dd className="num">{date}</dd></div>
          <div className="flex gap-2"><dt className="text-muted">État {m.partielle ? "déclaré" : "observé"}</dt><dd>{STATE_LABEL[state]}</dd></div>
          <div className="flex gap-2"><dt className="text-muted">Méthode</dt><dd>{METHOD_LABEL[m.methode]}</dd></div>
        </dl>
        {ind && (
          <p className="t-small text-muted">
            Score global <span className="num font-semibold text-foreground">{ind.score} / 100</span> (note de présentation indulgente, pas un percentile)
            {profile ? (
              <>
                {" "}· profil morphologique <span className="font-semibold text-foreground" data-profile={profile.id}>{profile.name}</span>
              </>
            ) : null}
          </p>
        )}
      </header>

      {m.partielle && (
        <Card as="aside" soft className="morpho-section space-y-2">
          <p className="font-semibold">{PARTIAL_LABEL}</p>
          <p className="t-small text-muted">{RETAKE_ADVICE}</p>
          <p className="no-print">
            <Link href="/analyse/photo?f=B" className="text-accent underline">Reprendre la photo</Link>
          </p>
        </Card>
      )}

      {/* 2. Synthèse */}
      <section aria-labelledby="synthese" className="morpho-section space-y-2">
        <h2 id="synthese" className="t-h3">Synthèse</h2>
        <p className="leading-relaxed" data-synthese>{t.synthese}</p>
      </section>

      {/* 3. Tableau des indicateurs (valeurs calculées par le code, appréciations rédigées) */}
      <section aria-labelledby="indicateurs" className="morpho-section space-y-3">
        <h2 id="indicateurs" className="t-h3">Tableau des indicateurs</h2>
        <div className="card !p-0 overflow-hidden">
          <table className="data-table morpho-table">
            <thead>
              <tr>
                <th scope="col">Indicateur</th>
                <th scope="col">{ind ? "Valeur" : "Valeur de référence"}</th>
                <th scope="col" className="hidden sm:table-cell">Appréciation</th>
              </tr>
            </thead>
            <tbody>
              {INDICATOR_KEYS.map((k) => (
                <tr key={k} data-indicator={k}>
                  <th scope="row" className="font-normal align-top w-[38%] sm:w-[30%]">{INDICATOR_LABELS[k]}</th>
                  <td className="num align-top">
                    {ind ? indicatorValue(ind, k) : referenceValue(k, m.reference)}
                    <span className="block sm:hidden t-small text-muted font-sans mt-1">{t.appreciations[k]}</span>
                  </td>
                  <td className="hidden sm:table-cell text-muted align-top">{t.appreciations[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ind && ind.percentileLongueur === null && (
          <p className="t-small text-muted">État de repos : la longueur n&apos;est pas positionnée par un percentile ; seule la circonférence l&apos;est.</p>
        )}
      </section>

      {/* 4 à 9. Rubriques rédigées */}
      {SECTION_KEYS.map((k) => (
        <section key={k} aria-labelledby={`r-${k}`} className="morpho-section space-y-2">
          <h2 id={`r-${k}`} className="t-h3">{SECTION_TITLES[k]}</h2>
          <p className="leading-relaxed text-muted" data-section={k}>{t[k]}</p>
        </section>
      ))}

      {/* 10. Points remarquables (rapport complet seulement) */}
      {t.points_remarquables.length > 0 && (
        <section aria-labelledby="points" className="morpho-section space-y-2">
          <h2 id="points" className="t-h3">Points remarquables</h2>
          <ul className="list-disc pl-5 space-y-1 leading-relaxed">
            {t.points_remarquables.map((p) => (
              <li key={p.indicateur} data-highlight={p.indicateur}>{p.texte}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 11. Conclusion */}
      <section aria-labelledby="conclusion" className="morpho-section space-y-2">
        <h2 id="conclusion" className="t-h3">Conclusion</h2>
        <p className="leading-relaxed" data-conclusion>{t.conclusion}</p>
      </section>

      {/* 12. Note du laboratoire */}
      <footer className="morpho-section border-t border-[var(--border)] pt-4">
        <p className="t-small text-muted">
          <span className="font-semibold text-foreground">Note du laboratoire. </span>
          <span data-note>{t.note_laboratoire}</span>
        </p>
      </footer>
    </article>
  );
}

/** Rapport partiel : médianes de référence de l'état déclaré pour la longueur et la circonférence ; rien pour le reste. */
function referenceValue(k: (typeof INDICATOR_KEYS)[number], ref: { longueurMedianeCm: number; circonferenceMedianeCm: number } | undefined): string {
  if (!ref) return "—";
  if (k === "longueur") return `${frNum(ref.longueurMedianeCm)} cm (médiane)`;
  if (k === "circonference") return `${frNum(ref.circonferenceMedianeCm)} cm (médiane)`;
  return "—";
}
