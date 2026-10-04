import { paymentAllowed, photoPaidByPlisio } from "@/lib/payments/policy";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FORMULAS, REPORT_ACCESS, SITE, formatEur } from "@/config/site";
import { BETA, isFreeBeta } from "@/lib/mode";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { f1 } from "@/lib/format";
import { DIRECTION_FR, type ReportResults } from "@/lib/report";
import { getReportView } from "@/lib/view";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { MorphoReport } from "@/components/report/MorphoReport";
import { ReportDashboard } from "@/components/report/ReportDashboard";
import { TrackView } from "@/components/TrackView";
import { TrackOnView, TrackedLink } from "@/components/Tracked";
import { PhotoOffer } from "@/components/PhotoOffer";
import { StickyCta } from "@/components/StickyCta";
import { ResultHero } from "@/components/report/ResultHero";
import { photoAccess } from "@/lib/photoAccess";
import { AwaitPayment } from "./AwaitPayment";
import { ReportActions } from "./ReportActions";

export const metadata = {
  title: "Rapport",
  robots: { index: false, follow: false, nocache: true },
  ...PRIVATE_SOCIAL,
};

/** Percentile affiché, ou « — » s'il n'est pas calculé. */
const pf = (p: number | undefined) => (p === undefined ? "—" : f1(p));

const CURVE = { none: "Aucune", light: "Légère", marked: "Marquée" } as const;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retour?: string }> }) {
  const { id } = await params;
  const { retour } = await searchParams;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();
  // Bêta gratuite : il n'y a plus de paiement, donc plus de rapport verrouillé (un rapport antérieur non payé n'est pas proposé).
  // Exception : un rapport photo payable par Plisio (src/lib/payments/policy.ts).
  if (view.status === "locked" && isFreeBeta() && !paymentAllowed(view.formula)) notFound();

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
        <TrackOnView event="analysis_view" once={id} />
        {banner}
        <Card className="space-y-6 md:!p-8">
          <div className="text-center space-y-3">
            <Badge tone="success">Analyse terminée</Badge>
            <h1 className="t-h1 !text-[30px] !leading-[34px] md:!text-[40px] md:!leading-[44px]">Votre rapport est prêt</h1>
            <p className="t-lead text-muted max-w-[34rem] mx-auto">
              {view.formula === "A"
                ? "Votre position exacte, calculée sur vos valeurs : il ne reste qu'à la débloquer."
                : "Votre analyse a abouti. Découvrez ce que la photo révèle et que le questionnaire ne peut pas calculer."}
            </p>
          </div>
          {view.preview && (
            <div>
              <p className="t-caption uppercase tracking-[0.08em] text-muted mb-2">Déjà visible</p>
              <div className="grid grid-cols-2 gap-3 text-left">
                {view.preview.map((p) => (
                  <div key={p.label} className="rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] p-4">
                    <p className="t-small text-muted">{p.label}</p>
                    <p className="num t-data-l text-accent">{Math.round(p.value)}<span className="text-[16px] text-muted"> / 100</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="t-caption uppercase tracking-[0.08em] text-muted mb-2">Débloqué avec votre rapport</p>
            <ul className="divide-y divide-[var(--border)] rounded-[12px] border border-[var(--border)]" data-locked-contents>
              {(view.formula === "A"
                ? ["Vos percentiles de longueur et de circonférence", "Votre profil morphologique", "Votre score global sur 100", "Les courbes de distribution et vos repères de taille", "Le PDF et la carte de partage"]
                : ["Longueur et circonférence estimées, avec leur marge", "Vos percentiles, et votre profil morphologique en érection", "La courbure en degrés, la conicité et l'indice de typicité", "Le compte rendu rédigé : six rubriques, points remarquables, conclusion", "Votre score global, le PDF et la carte de partage"]
              ).map((t) => (
                <li key={t} className="flex items-center gap-3 px-4 py-3 t-small">
                  <Icon name="lock" size={16} className="flex-none text-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          {retour && <AwaitPayment />}
          {view.relocked ? (
            <p className="t-small font-medium" style={{ color: "var(--bm-warning-text)" }}>
              Le paiement de ce rapport a été remboursé ou contesté : il est de nouveau verrouillé. Pour toute question, voir la page{" "}
              <Link href="/contact" className="underline">Contact et signalement</Link>.
            </p>
          ) : (
            <div className="space-y-3 text-center">
              <Button href={`/paiement/${id}`} fullOnMobile arrow className="sm:min-w-[320px]">Débloquer pour {formatEur(view.priceEur)}</Button>
              <p className="t-small text-muted">
                Paiement unique, sans abonnement
                {isFreeBeta() ? " · en cryptomonnaie par Plisio" : ""} · accès par ce lien privé.
              </p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const r = view.results;
  const dateFr = view.createdAt.toLocaleDateString("fr-FR", { timeZone: "UTC" });

  // Formule photo, version 2 : compte rendu morphométrique (en-tête, tableau, rubriques, points remarquables, conclusion, note).
  if (r.morpho) {
    const partial = r.morpho.partielle;
    return (
      <div className="container-bm container-narrow py-8 md:py-14 space-y-8">
        <TrackView event="report_view" once={id} />
        <TrackOnView event="result_view" once={id} />
        {retour && <TrackOnView event="purchase_success" once={id} />}
        {banner}
        <MorphoReport results={r} date={dateFr} beta={view.freeBeta} />
        {r.declared && <DeclaredComparison results={r} />}
        <section aria-label="Actions" className="space-y-4 no-print">
          {!partial && (
            <ShareButtons id={id} />
          )}
          {partial && <Button href="/analyse/photo?f=B" fullOnMobile arrow>Reprendre la photo</Button>}
          <ReportActions id={id} />
          <p className="t-small text-muted">
            {view.freeBeta
              ? `Bêta gratuite : ce rapport est conservé ${BETA.reportTtlDays} jours au plus, sans garantie. Téléchargez-le en PDF pour le garder.`
              : partial
                ? "Rapport partiel, sans paiement : téléchargez-le en PDF si vous souhaitez le garder."
                : `Ce rapport reste accessible par son lien pendant au moins ${REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.`}{" "}
            <Link href="/methode" className="text-accent underline">Voir la méthode</Link>.
          </p>
        </section>
      </div>
    );
  }
  const state = r.state === "rest" ? "Au repos" : "En érection";
  const declared = r.formula === "A";
  // Offre d'analyse photo, juste après un résultat du questionnaire, si la formule photo est accessible.
  const photo = declared ? await photoAccess() : { available: false };

  return (
    <div className="container-bm py-6 md:py-12 space-y-8">
      <TrackView event="report_view" once={id} />
      <TrackOnView event="result_view" once={id} />
      {retour && <TrackOnView event="purchase_success" once={id} />}

      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="t-eyebrow">Rapport · {SITE.name}</p>
          {view.freeBeta && <Badge tone="warning">BÊTA GRATUITE</Badge>}
        </div>
        <h1 className="t-h1 !text-[30px] !leading-[34px] md:!text-[44px] md:!leading-[48px]">Votre résultat est prêt.</h1>
        <p className="mono t-small text-muted">
          Référence #{id.slice(0, 8).toUpperCase()} · {dateFr} · {state}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <ResultHero results={r} animate />
        <div className="space-y-4 no-print">
          <ShareButtons id={id} />
          {banner}
        </div>
      </div>

      {photo.available && <PhotoOffer variant="result" paid={photoPaidByPlisio()} />}
      {photo.available && (
        <StickyCta hideWhen="[data-photo-offer], [data-share-buttons]" after={900}>
          <TrackedLink href="/analyse/photo?f=B" event="analysis_cta_click" kind="upsell_click" className="btn btn-primary btn-block">
            <Icon name="camera" size={18} />
            <span>Mon analyse complète{photoPaidByPlisio() ? ` · ${formatEur(FORMULAS.B.priceEur)}` : ""}</span>
          </TrackedLink>
        </StickyCta>
      )}

      <ReportDashboard results={r} lead="none" />

      {r.declared && <DeclaredComparison results={r} />}

      {/* Détail des valeurs (tableau de données) */}
      <section aria-labelledby="detail" className="space-y-3">
        <h2 id="detail" className="t-h3">Détail des valeurs</h2>
        {/* Mobile : le tableau devient une liste de cartes (charte, section 34) */}
        <ul className="md:hidden space-y-3">
          {[
            { l: "Longueur", v: `${f1(r.length.value)} cm`, m: r.length.marginPct ? `± ${r.length.marginPct} %` : "déclarée", p: pf(r.length.percentile), med: `${f1(r.length.referenceMedian)} cm` },
            { l: "Circonférence", v: `${f1(r.girth.value)} cm`, m: r.girth.marginPct ? `± ${r.girth.marginPct} %` : "déclarée", p: pf(r.girth.percentile), med: `${f1(r.girth.referenceMedian)} cm` },
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
                <td className="right font-semibold text-accent">{pf(r.length.percentile)}</td>
                <td className="right">{f1(r.length.referenceMedian)} cm</td>
              </tr>
              <tr>
                <th scope="row" className="font-normal">Circonférence</th>
                <td className="right">{f1(r.girth.value)} cm</td>
                <td className="right text-muted">{r.girth.marginPct ? `± ${r.girth.marginPct} %` : "déclarée"}</td>
                <td className="right font-semibold text-accent">{pf(r.girth.percentile)}</td>
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

      {/* Synthèse : texte du rapport, après les données. Formules photo : modèle FIXE (trois observations, un verdict), rédigé par le modèle
          à partir d'indicateurs calculés et validé contre un schéma versionné (aucun chiffre). Formule A : commentaire calculé. */}
      {r.standard ? (
        <Card as="section" soft className="space-y-3">
          <p className="t-eyebrow">Observations du laboratoire</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted leading-relaxed" data-standard-comment={r.standard.schemaVersion}>
            {r.standard.observations.map((o, i) => (
              <li key={i} data-observation>{o}</li>
            ))}
          </ol>
          <p className="t-eyebrow">Verdict</p>
          <p className="leading-relaxed font-medium" data-verdict>{r.standard.verdict}</p>
          <p className="t-small text-muted">
            Observations et verdict portent sur la qualité de la photo, le cadrage, la cohérence des estimations et la position statistique générale ; les
            chiffres du rapport sont tous calculés par le site à partir des points repérés.
          </p>
        </Card>
      ) : (
        <Card as="section" soft className="space-y-2">
          <p className="t-eyebrow">Synthèse</p>
          <p className="text-muted leading-relaxed">{r.comment}</p>
        </Card>
      )}

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
        <ShareButtons id={id} />
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

/** Formule C : comparaison déclaré / estimé (au-delà de 20 % d'écart, invitation à vérifier la méthode de mesure). */
function DeclaredComparison({ results: r }: { results: ReportResults }) {
  if (!r.declared) return null;
  return (
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
  );
}

/** Partager et défier : les deux gestes de la boucle de croissance, visibles dès le résultat. */
function ShareButtons({ id }: { id: string }) {
  return (
    <div className="card !p-5 space-y-3" data-share-buttons>
      <p className="font-semibold">Comparez-vous à vos amis</p>
      <p className="t-small text-muted -mt-1">Une carte avec ce que vous choisissez de montrer, ou un défi : votre ami fait le test, vous comparez.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TrackedLink href={`/r/${id}/partager`} event="share_click" className="btn btn-primary btn-block">
          <Icon name="share" size={18} />
          <span>Partager mon résultat</span>
        </TrackedLink>
        <TrackedLink href={`/r/${id}/defi`} event="challenge_click" className="btn btn-secondary btn-block">
          <Icon name="users" size={18} />
          <span>Défier un ami</span>
        </TrackedLink>
      </div>
    </div>
  );
}
