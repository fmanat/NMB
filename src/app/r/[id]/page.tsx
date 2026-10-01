import Link from "next/link";
import { notFound } from "next/navigation";
import { BETA, isFreeBeta } from "@/lib/mode";
import { REPORT_ACCESS, SITE, formatEur } from "@/config/site";
import { Distribution } from "@/components/Distribution";
import { TrackView } from "@/components/TrackView";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { DIRECTION_FR } from "@/lib/report";
import { referenceFor } from "@/lib/stats";
import { getReportView } from "@/lib/view";
import { AwaitPayment } from "./AwaitPayment";
import { ReportActions } from "./ReportActions";

export const metadata = {
  title: "Rapport",
  robots: { index: false, follow: false, nocache: true },
  ...PRIVATE_SOCIAL,
};

const f1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ retour?: string }> }) {
  const { id } = await params;
  const { retour } = await searchParams;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();
  // Bêta gratuite : il n'y a plus de paiement, donc plus de rapport verrouillé (un rapport antérieur non payé n'est pas proposé).
  if (view.status === "locked" && isFreeBeta()) notFound();

  const banner = (
    <p className="text-xs border border-border rounded-lg px-3 py-2 bg-surface text-muted print:hidden">
      Pas de compte : enregistrez ce lien dans vos favoris. Il est le seul moyen de retrouver ce rapport.
    </p>
  );

  if (view.status === "locked") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <TrackView event="locked_preview" once={id} />
        {banner}
        <div className="panel p-6 text-center space-y-4">
          <p className="num text-xs text-accent tracking-widest">ANALYSE TERMINÉE</p>
          <h1 className="text-2xl font-semibold">Votre rapport est prêt</h1>
          {view.preview && (
            <div className="grid grid-cols-2 gap-3">
              <div className="panel p-3">
                <p className="text-xs text-muted">Indice de confiance</p>
                <p className="num text-3xl text-accent">{view.preview.confidence}<span className="text-sm text-muted"> / 100</span></p>
              </div>
              <div className="panel p-3">
                <p className="text-xs text-muted">Symétrie</p>
                <p className="num text-3xl text-accent">{Math.round(view.preview.symmetry)}<span className="text-sm text-muted"> / 100</span></p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 select-none" aria-hidden="true">
            {["Score", "Longueur", "Percentiles"].map((l) => (
              <div key={l} className="panel p-3">
                <p className="text-xs text-muted">{l}</p>
                <p className="num text-2xl blur-sm">00</p>
              </div>
            ))}
          </div>
          {retour && <AwaitPayment />}
          <p className="text-sm text-muted">Les résultats sont verrouillés jusqu&apos;au paiement.</p>
          <Link href={`/paiement/${id}`} className="btn-primary">
            Débloquer pour {formatEur(view.priceEur)}
          </Link>
        </div>
      </div>
    );
  }

  const r = view.results;
  const lenRef = referenceFor(r.state, "length");
  const girthRef = referenceFor(r.state, "girth");
  const dateFr = view.createdAt.toLocaleDateString("fr-FR", { timeZone: "UTC" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
      <TrackView event="report_view" once={id} />
      {banner}
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="num text-xs text-accent tracking-widest">
            RAPPORT · {SITE.name.toUpperCase()}
            {view.freeBeta && <span className="ml-2 border border-border rounded px-1.5 py-0.5 text-accent-2">BÊTA GRATUITE</span>}
          </p>
          <h1 className="text-3xl font-semibold">Rapport d&apos;analyse</h1>
          <p className="num text-xs text-muted mt-1">
            Dossier {id.slice(0, 8).toUpperCase()} · {dateFr} · {r.state === "rest" ? "Au repos" : "En érection"}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-6xl text-accent leading-none">{r.score}</p>
          <p className="text-xs text-muted">/ 100</p>
        </div>
      </header>

      <section className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="p-3">Mesure</th>
              <th className="p-3">Valeur</th>
              <th className="p-3">Marge</th>
              <th className="p-3">Percentile</th>
              <th className="p-3">Médiane de référence</th>
            </tr>
          </thead>
          <tbody className="num">
            <tr className="border-t border-border">
              <td className="p-3 font-sans">Longueur</td>
              <td className="p-3">{f1(r.length.value)} cm</td>
              <td className="p-3 font-sans text-muted">{r.length.marginPct ? `± ${r.length.marginPct} %` : "déclarée"}</td>
              <td className="p-3 text-accent-2">{f1(r.length.percentile)}</td>
              <td className="p-3">{f1(r.length.referenceMedian)} cm</td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3 font-sans">Circonférence</td>
              <td className="p-3">{f1(r.girth.value)} cm</td>
              <td className="p-3 font-sans text-muted">{r.girth.marginPct ? `± ${r.girth.marginPct} %` : "déclarée"}</td>
              <td className="p-3 text-accent-2">{f1(r.girth.percentile)}</td>
              <td className="p-3">{f1(r.girth.referenceMedian)} cm</td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3 font-sans">Courbure</td>
              <td className="p-3 font-sans" colSpan={4}>
                {{ none: "Aucune", light: "Légère", marked: "Marquée" }[r.curvature.category]}
                {r.curvature.direction !== "none" && ` ${DIRECTION_FR[r.curvature.direction]}`}
                {r.formula === "A" ? ` (valeur déclarée, angle retenu ${r.curvature.angleDeg}°)` : ` (estimée, angle ${r.curvature.angleDeg}°)`}
              </td>
            </tr>
            {r.symmetry !== undefined && (
              <>
                <tr className="border-t border-border">
                  <td className="p-3 font-sans">Symétrie</td>
                  <td className="p-3">{Math.round(r.symmetry)} / 100</td>
                  <td className="p-3 font-sans text-muted" colSpan={3}>écart entre demi-largeurs gauche et droite</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 font-sans">Conicité</td>
                  <td className="p-3">{r.taper !== undefined ? String(r.taper).replace(".", ",") : "—"}</td>
                  <td className="p-3 font-sans text-muted" colSpan={3}>largeur sous le gland / largeur à la base</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 font-sans">Indice de confiance</td>
                  <td className="p-3">{r.confidence} / 100</td>
                  <td className="p-3 font-sans text-muted" colSpan={3}>qualité du repérage des points</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </section>

      {r.declared && (
        <section className="panel p-4 text-sm space-y-1">
          <h2 className="font-semibold">Comparaison déclaré / estimé</h2>
          <p className="num">
            Longueur : déclarée {f1(r.declared.declaredLength)} cm · estimée {f1(r.length.value)} cm · écart {r.declared.lengthGapPct > 0 ? "+" : ""}
            {f1(r.declared.lengthGapPct)} %
          </p>
          <p className="num">
            Circonférence : déclarée {f1(r.declared.declaredGirth)} cm · estimée {f1(r.girth.value)} cm · écart {r.declared.girthGapPct > 0 ? "+" : ""}
            {f1(r.declared.girthGapPct)} %
          </p>
          {r.declared.flagged && <p className="text-accent-2">Écart important : vérifiez votre méthode de mesure.</p>}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <Distribution label="Longueur" value={r.length.value} mean={lenRef.mean} sd={lenRef.sd} />
        <Distribution label="Circonférence" value={r.girth.value} mean={girthRef.mean} sd={girthRef.sd} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Comparaison à des objets du quotidien</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {r.everyday.map((o) => (
            <li key={o.label} className="panel p-3 text-sm">
              {o.label} <span className="num text-accent-2 block text-lg">{f1(o.times)} × vous</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Mesures de référence</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {r.landmarks.map((l) => (
            <li key={l.label} className="panel p-3 text-sm">
              {l.label} <span className="num text-accent-2 block text-lg">{l.times.toLocaleString("fr-FR")} × vous</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Commentaire</h2>
        <p className="text-muted leading-relaxed">{r.comment}</p>
      </section>

      <aside className="panel p-4 text-sm text-muted">
        <h2 className="font-semibold text-foreground mb-1">Précision et limites</h2>
        {r.formula === "A"
          ? "Résultats calculés à partir de valeurs déclarées, non vérifiées."
          : "Mesures estimées à partir d'une photographie : elles dépendent de la qualité de l'image, de la perspective et de l'hypothèse d'une section circulaire. La marge d'erreur indiquée n'est jamais inférieure à ± 10 %."}{" "}
        Les percentiles reposent sur une loi normale et
        les références de Veale et al. (BJU International, 2015). Le score sur 100 est une note de présentation
        indulgente, pas un percentile. Ceci n&apos;est pas un avis médical.{" "}
        <Link href="/methode" className="underline">Voir la méthode</Link>.
      </aside>

      <div className="flex flex-wrap gap-3 print:hidden">
        <Link href={`/r/${id}/partager`} className="btn-primary">Partager ma carte</Link>
        <Link href={`/r/${id}/defi`} className="panel px-4 py-2 text-sm hover:border-accent">Défier un ami</Link>
      </div>

      <ReportActions id={id} />
      {view.freeBeta ? (
        <p className="text-xs text-muted print:hidden">
          Bêta gratuite : ce rapport est conservé {BETA.reportTtlDays} jours au plus, sans garantie. Téléchargez-le en PDF pour le garder.
        </p>
      ) : (
        <p className="text-xs text-muted print:hidden">
          Ce rapport reste accessible par son lien pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.
        </p>
      )}
    </div>
  );
}
