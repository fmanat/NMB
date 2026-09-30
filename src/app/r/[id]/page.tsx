import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE, formatEur } from "@/config/site";
import { Distribution } from "@/components/Distribution";
import { DIRECTION_FR } from "@/lib/report";
import { referenceFor } from "@/lib/stats";
import { getReportView } from "@/lib/view";
import { ReportActions } from "./ReportActions";

export const metadata = {
  title: "Rapport",
  robots: { index: false, follow: false, nocache: true },
};

const f1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();

  const banner = (
    <p className="text-xs border border-border rounded-lg px-3 py-2 bg-surface text-muted print:hidden">
      Pas de compte : enregistrez ce lien dans vos favoris. Il est le seul moyen de retrouver ce rapport.
    </p>
  );

  if (view.status === "locked") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        {banner}
        <div className="panel p-6 text-center space-y-4">
          <p className="num text-xs text-accent tracking-widest">ANALYSE TERMINÉE</p>
          <h1 className="text-2xl font-semibold">Votre rapport est prêt</h1>
          <div className="grid grid-cols-3 gap-3 select-none" aria-hidden="true">
            {["Score", "Longueur", "Percentiles"].map((l) => (
              <div key={l} className="panel p-3">
                <p className="text-xs text-muted">{l}</p>
                <p className="num text-2xl blur-sm">00</p>
              </div>
            ))}
          </div>
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
      {banner}
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="num text-xs text-accent tracking-widest">RAPPORT · {SITE.name.toUpperCase()}</p>
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
              <td className="p-3 font-sans text-muted">déclarée</td>
              <td className="p-3 text-accent-2">{f1(r.length.percentile)}</td>
              <td className="p-3">{f1(r.length.referenceMedian)} cm</td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3 font-sans">Circonférence</td>
              <td className="p-3">{f1(r.girth.value)} cm</td>
              <td className="p-3 font-sans text-muted">déclarée</td>
              <td className="p-3 text-accent-2">{f1(r.girth.percentile)}</td>
              <td className="p-3">{f1(r.girth.referenceMedian)} cm</td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3 font-sans">Courbure</td>
              <td className="p-3 font-sans" colSpan={4}>
                {{ none: "Aucune", light: "Légère", marked: "Marquée" }[r.curvature.category]}
                {r.curvature.direction !== "none" && ` ${DIRECTION_FR[r.curvature.direction]}`} (valeur déclarée, angle
                retenu {r.curvature.angleDeg}°)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

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
        Résultats calculés à partir de valeurs déclarées, non vérifiées. Les percentiles reposent sur une loi normale et
        les références de Veale et al. (BJU International, 2015). Le score sur 100 est une note de présentation
        indulgente, pas un percentile. Ceci n&apos;est pas un avis médical.{" "}
        <Link href="/methode" className="underline">Voir la méthode</Link>.
      </aside>

      <ReportActions id={id} />
    </div>
  );
}
