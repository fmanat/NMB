import Link from "next/link";
import { notFound } from "next/navigation";
import { REPORT_ACCESS, SITE, formatEur } from "@/config/site";
import { BETA, isFreeBeta } from "@/lib/mode";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { f1 } from "@/lib/format";
import { DIRECTION_FR } from "@/lib/report";
import { getReportView } from "@/lib/view";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ReportDashboard } from "@/components/report/ReportDashboard";
import { TrackView } from "@/components/TrackView";
import { AwaitPayment } from "./AwaitPayment";
import { ReportActions } from "./ReportActions";

export const metadata = {
  title: "Rapport",
  robots: { index: false, follow: false, nocache: true },
  ...PRIVATE_SOCIAL,
};

const CURVE = { none: "Aucune", light: "Légère", marked: "Marquée" } as const;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retour?: string }> }) {
  const { id } = await params;
  const { retour } = await searchParams;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();
  // Bêta gratuite : il n'y a plus de paiement, donc plus de rapport verrouillé (un rapport antérieur non payé n'est pas proposé).
  if (view.status === "locked" && isFreeBeta()) notFound();

  const banner = (
    <p className="flex items-start gap-2 rounded-[10px] border border-[var(--bm-blue-100)] bg-[var(--bm-blue-050)] px-4 py-3 t-small text-muted no-print">
      <Icon name="info" size={18} className="mt-0.5 flex-none text-accent" />
      <span>Pas de compte : enregistrez ce lien dans vos favoris. Il est le seul moyen de retrouver ce rapport.</span>
    </p>
  );

  if (view.status === "locked") {
    return (
      <div className="container-bm container-narrow py-8 md:py-14 space-y-6">
        <TrackView event="locked_preview" once={id} />
        {banner}
        <Card className="text-center space-y-5 md:!p-8">
          <Badge tone="success">Analyse terminée</Badge>
          <h1 className="t-h1 !text-[30px] !leading-[34px] md:!text-[40px] md:!leading-[44px]">Votre rapport est prêt</h1>
          {view.preview && (
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
                <p className="t-small text-muted">Indice de confiance</p>
                <p className="num t-data-l text-accent">{view.preview.confidence}<span className="text-[16px] text-muted"> / 100</span></p>
              </div>
              <div className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
                <p className="t-small text-muted">Symétrie</p>
                <p className="num t-data-l text-accent">{Math.round(view.preview.symmetry)}<span className="text-[16px] text-muted"> / 100</span></p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 select-none" aria-hidden="true">
            {["Score", "Longueur", "Percentiles"].map((l) => (
              <div key={l} className="rounded-[10px] border border-[var(--border)] p-3">
                <p className="t-small text-muted">{l}</p>
                <p className="num t-data-l blur-sm">00</p>
              </div>
            ))}
          </div>
          {retour && <AwaitPayment />}
          {view.relocked ? (
            <p className="t-small font-medium" style={{ color: "var(--bm-warning-text)" }}>
              Le paiement de ce rapport a été remboursé ou contesté : il est de nouveau verrouillé. Pour toute question, voir la page{" "}
              <Link href="/contact" className="underline">Contact et signalement</Link>.
            </p>
          ) : (
            <>
              <p className="t-small text-muted">Les résultats sont verrouillés jusqu&apos;au paiement.</p>
              <Button href={`/paiement/${id}`} fullOnMobile arrow>Débloquer pour {formatEur(view.priceEur)}</Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  const r = view.results;
  const dateFr = view.createdAt.toLocaleDateString("fr-FR", { timeZone: "UTC" });
  const state = r.state === "rest" ? "Au repos" : "En érection";
  const declared = r.formula === "A";

  return (
    <div className="container-bm py-8 md:py-14 space-y-8">
      <TrackView event="report_view" once={id} />
      <div className="container-narrow !max-w-none">{banner}</div>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="t-eyebrow">Rapport · {SITE.name}</p>
          {view.freeBeta && <Badge tone="warning">BÊTA GRATUITE</Badge>}
        </div>
        <h1 className="t-h1 !text-[32px] !leading-[36px] md:!text-[44px] md:!leading-[48px]">Rapport morphologique</h1>
        <p className="mono t-small text-muted">
          Référence #{id.slice(0, 8).toUpperCase()} · {dateFr} · {state}
        </p>
      </header>

      <ReportDashboard results={r} />

      {r.declared && (
        <Card as="section" soft className="space-y-1 t-small">
          <h2 className="t-h4 !text-[16px]">Comparaison déclaré / estimé</h2>
          <p className="num">
            Longueur : déclarée {f1(r.declared.declaredLength)} cm · estimée {f1(r.length.value)} cm · écart {r.declared.lengthGapPct > 0 ? "+" : ""}
            {f1(r.declared.lengthGapPct)} %
          </p>
          <p className="num">
            Circonférence : déclarée {f1(r.declared.declaredGirth)} cm · estimée {f1(r.girth.value)} cm · écart {r.declared.girthGapPct > 0 ? "+" : ""}
            {f1(r.declared.girthGapPct)} %
          </p>
          {r.declared.flagged && <p className="font-semibold" style={{ color: "var(--bm-warning-text)" }}>Écart important : vérifiez votre méthode de mesure.</p>}
        </Card>
      )}

      {/* Détail des valeurs (tableau de données) */}
      <section aria-labelledby="detail" className="space-y-3">
        <h2 id="detail" className="t-h3">Détail des valeurs</h2>
        {/* Mobile : le tableau devient une liste de cartes (charte, section 34) */}
        <ul className="md:hidden space-y-3">
          {[
            { l: "Longueur", v: `${f1(r.length.value)} cm`, m: r.length.marginPct ? `± ${r.length.marginPct} %` : "déclarée", p: f1(r.length.percentile), med: `${f1(r.length.referenceMedian)} cm` },
            { l: "Circonférence", v: `${f1(r.girth.value)} cm`, m: r.girth.marginPct ? `± ${r.girth.marginPct} %` : "déclarée", p: f1(r.girth.percentile), med: `${f1(r.girth.referenceMedian)} cm` },
          ].map((x) => (
            <li key={x.l} className="card !p-4">
              <p className="font-semibold">{x.l}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 t-small">
                <dt className="text-muted">Valeur</dt><dd className="num text-right font-semibold">{x.v}</dd>
                <dt className="text-muted">Marge</dt><dd className="num text-right">{x.m}</dd>
                <dt className="text-muted">Percentile</dt><dd className="num text-right font-semibold text-accent">{x.p}</dd>
                <dt className="text-muted">Médiane de référence</dt><dd className="num text-right">{x.med}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <div className="card !p-0 overflow-x-auto hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Mesure</th>
                <th scope="col" className="right">Valeur</th>
                <th scope="col" className="right">Marge</th>
                <th scope="col" className="right">Percentile</th>
                <th scope="col" className="right">Médiane de référence</th>
              </tr>
            </thead>
            <tbody className="num">
              <tr>
                <th scope="row" className="font-normal">Longueur</th>
                <td className="right">{f1(r.length.value)} cm</td>
                <td className="right text-muted">{r.length.marginPct ? `± ${r.length.marginPct} %` : "déclarée"}</td>
                <td className="right font-semibold text-accent">{f1(r.length.percentile)}</td>
                <td className="right">{f1(r.length.referenceMedian)} cm</td>
              </tr>
              <tr>
                <th scope="row" className="font-normal">Circonférence</th>
                <td className="right">{f1(r.girth.value)} cm</td>
                <td className="right text-muted">{r.girth.marginPct ? `± ${r.girth.marginPct} %` : "déclarée"}</td>
                <td className="right font-semibold text-accent">{f1(r.girth.percentile)}</td>
                <td className="right">{f1(r.girth.referenceMedian)} cm</td>
              </tr>
              <tr>
                <th scope="row" className="font-normal">Courbure</th>
                <td className="right" colSpan={4}>
                  {CURVE[r.curvature.category]}
                  {r.curvature.direction !== "none" && ` ${DIRECTION_FR[r.curvature.direction]}`}
                  {declared ? ` (valeur déclarée, angle retenu ${r.curvature.angleDeg}°)` : ` (estimée, angle ${r.curvature.angleDeg}°)`}
                </td>
              </tr>
              {r.symmetry !== undefined && (
                <>
                  <tr>
                    <th scope="row" className="font-normal">Symétrie</th>
                    <td className="right">{Math.round(r.symmetry)} / 100</td>
                    <td className="right text-muted" colSpan={3}>écart entre demi-largeurs gauche et droite</td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-normal">Conicité</th>
                    <td className="right">{r.taper !== undefined ? String(r.taper).replace(".", ",") : "—"}</td>
                    <td className="right text-muted" colSpan={3}>largeur sous le gland / largeur à la base</td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-normal">Indice de confiance</th>
                    <td className="right">{r.confidence} / 100</td>
                    <td className="right text-muted" colSpan={3}>qualité du repérage des points</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Synthèse : texte du rapport, après les données */}
      <Card as="section" soft className="space-y-2">
        <p className="t-eyebrow">Synthèse</p>
        <p className="text-muted leading-relaxed">{r.comment}</p>
      </Card>

      {/* Méthodologie */}
      <section aria-labelledby="methodo" className="space-y-3">
        <h2 id="methodo" className="t-h3">Méthodologie et limites</h2>
        <Accordion question="Précision et limites">
          {declared
            ? "Résultats calculés à partir de valeurs déclarées, non vérifiées."
            : "Mesures estimées à partir d'une photographie : elles dépendent de la qualité de l'image, de la perspective et de l'hypothèse d'une section circulaire. La marge d'erreur indiquée n'est jamais inférieure à ± 10 %."}{" "}
          Les percentiles reposent sur une loi normale et les références de Veale et al. (BJU International, 2015). Le score sur 100 est une note de présentation
          indulgente, pas un percentile. Ceci n&apos;est pas un avis médical.{" "}
          <Link href="/methode" className="text-accent underline">Voir la méthode</Link>.
        </Accordion>
      </section>

      {/* Actions */}
      <section aria-label="Actions" className="space-y-4 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button href={`/r/${id}/partager`} fullOnMobile>Partager ma carte</Button>
          <Button href={`/r/${id}/defi`} variant="secondary" fullOnMobile>Défier un ami</Button>
        </div>
        <ReportActions id={id} />
        {view.freeBeta ? (
          <p className="t-small text-muted">
            Bêta gratuite : ce rapport est conservé {BETA.reportTtlDays} jours au plus, sans garantie. Téléchargez-le en PDF pour le garder.
          </p>
        ) : (
          <p className="t-small text-muted">
            Ce rapport reste accessible par son lien pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.
          </p>
        )}
      </section>
    </div>
  );
}
