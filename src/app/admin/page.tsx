import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FINANCE, FORMULAS } from "@/config/site";
import { ADMIN_COOKIE, isAdminTokenValid } from "@/lib/admin/auth";
import { dashboardStats, type Finance, type FormulaKey } from "@/lib/admin/stats";
import { computeFunnel, funnelCounts } from "@/lib/funnel";
import { logout } from "./actions";

export const metadata = { title: "Tableau de bord", robots: { index: false, follow: false, nocache: true } };

const PERIODS = [
  { key: "7", label: "7 jours", days: 7 },
  { key: "30", label: "30 jours", days: 30 },
  { key: "90", label: "90 jours", days: 90 },
  { key: "tout", label: "Depuis le début", days: null },
] as const;

const MOTIFS: Record<string, string> = {
  visage_visible: "Visage visible",
  plusieurs_personnes: "Plusieurs personnes",
  sujet_non_conforme: "Sujet non conforme",
  carte_absente_ou_illisible: "Carte absente ou illisible",
  image_non_originale: "Image non originale",
  doute_majorite: "Doute sur la majorité",
  reperage_incomplet: "Repérage incomplet",
  confiance_faible: "Confiance trop faible",
  mesure_invraisemblable: "Mesure invraisemblable",
  inclinaison_trop_forte: "Photo trop inclinée",
  carte_trop_petite: "Carte trop petite dans l'image",
  calcul_impossible: "Calcul impossible",
  empreinte_connue: "Image déjà répertoriée (empreinte)",
  image_invalide: "Fichier image invalide",
  fournisseur_timeout: "Prestataire d'analyse : délai dépassé",
  fournisseur_network: "Prestataire d'analyse : réseau",
  fournisseur_auth: "Prestataire d'analyse : clé refusée",
  fournisseur_policy: "Prestataire d'analyse : accès refusé",
  fournisseur_invalid: "Prestataire d'analyse : réponse invalide",
};
const OUTCOMES: Record<string, string> = { refused: "Refus", blocked: "Bloquée", error: "Erreur technique" };

const eur = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const usd = (n: number | null, digits = 4) => (n === null ? "—" : n.toLocaleString("fr-FR", { style: "currency", currency: "USD", minimumFractionDigits: digits }));
const pct = (r: number | null) => (r === null ? "—" : `${(r * 100).toFixed(0)} %`);
const nb = (n: number) => n.toLocaleString("fr-FR");

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="panel p-4 space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children}
      {note && <p className="text-xs text-muted">{note}</p>}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm num">
        <thead className="text-left text-muted font-sans">
          <tr>{head.map((h, i) => <th key={i} scope="col" className="py-2 pr-4 font-normal">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-sans" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const financeRow = (label: string, f: Finance) => [label, nb(f.transactions), eur(f.grossCents), eur(f.vatCents), eur(f.netOfVatCents), eur(f.feeCents), eur(f.netCents)];

export default async function Page({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  if (!isAdminTokenValid((await cookies()).get(ADMIN_COOKIE)?.value)) redirect("/admin/connexion");
  const { jours } = await searchParams;
  const period = PERIODS.find((p) => p.key === jours) ?? PERIODS[1];
  const d = await dashboardStats(period.days);
  const keys = Object.keys(FORMULAS) as FormulaKey[];
  // Entonnoir : trois périodes côte à côte, toujours les mêmes (7 jours, 30 jours, depuis le début).
  const funnelPeriods = PERIODS.filter((p) => p.key === "7" || p.key === "30" || p.key === "tout");
  const funnels = await Promise.all(funnelPeriods.map(async (p) => ({ p, rows: computeFunnel(await funnelCounts(p.days)) })));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Tableau de bord</h1>
          <p className="text-xs text-muted">Chiffres réels, agrégés et anonymes. Période : {period.label.toLowerCase()}.</p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-secondary btn-sm">Se déconnecter</button>
        </form>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Période">
        {PERIODS.map((p) => (
          <Link key={p.key} href={`/admin?jours=${p.key}`} className={`panel px-3 py-1.5 ${p.key === period.key ? "border-accent text-accent" : "text-muted hover:border-accent"}`}>
            {p.label}
          </Link>
        ))}
      </nav>

      <Card
        title="Entonnoir de conversion"
        note="Événements anonymes, sans cookie ni adresse IP : ce sont des comptages d'événements, pas de personnes (un visiteur peut en produire plusieurs ; les robots et les visiteurs qui refusent le suivi — Do Not Track, Global Privacy Control — ne sont pas comptés). Chaque taux est le rapport à l'étape précédente de sa chaîne ; entre parenthèses, le rapport aux visites de l'accueil. Les étapes de la version payante restent à 0 pendant la bêta gratuite. Les périodes sont indépendantes de celle choisie ci-dessus."
      >
        <Table
          head={["Étape", ...funnels.flatMap(({ p }) => [`Nombre · ${p.label}`, "Taux"])]}
          rows={funnels[0].rows.map((s, i) => [
            s.label,
            ...funnels.flatMap(({ rows }) => {
              const r = rows[i];
              return [nb(r.count), r.parent ? `${pct(r.rateFromParent)} (${pct(r.rateFromTop)})` : "—"];
            }),
          ])}
        />
      </Card>

      <Card
        title="Analyses lancées"
        note="Protocole A : un rapport créé compte comme une analyse. Protocoles photo : chaque tentative d'envoi compte, y compris les refus et les erreurs."
      >
        <Table
          head={["Protocole", "Lancées", "Abouties", "Refusées", "Bloquées", "Erreurs"]}
          rows={keys.map((k) => {
            const r = d.launched[k];
            return [`${k} · ${FORMULAS[k].label}`, nb(r.launched), nb(r.delivered), nb(r.refused), nb(r.blocked), nb(r.error)];
          })}
        />
      </Card>

      <Card title="Refus par motif" note="Seul le motif est journalisé, jamais l'image.">
        {d.refusals.length === 0 ? (
          <p className="text-sm text-muted">Aucun refus sur la période.</p>
        ) : (
          <Table head={["Type", "Motif", "Nombre"]} rows={d.refusals.map((r) => [OUTCOMES[r.outcome] ?? r.outcome, MOTIFS[r.motif] ?? r.motif, nb(r.n)])} />
        )}
      </Card>

      <Card
        title="Conversion par protocole"
        note={`Parmi les rapports créés sur la période, part de ceux qui ont été payés. Un rapport payé après la fin de la période compte dans sa période de création. Hors bêta gratuite : ${nb(d.freeBetaReports)} rapport(s) créé(s) en bêta gratuite sur la période (débloqués sans paiement) ne sont pas comptés ici.`}
      >
        <Table
          head={["Protocole", "Rapports créés", "Payés", "Conversion"]}
          rows={keys.map((k) => [`${k} · ${FORMULAS[k].label}`, nb(d.conversion[k].created), nb(d.conversion[k].paid), pct(d.conversion[k].rate)])}
        />
      </Card>

      <Card
        title="Revenus"
        note={`TVA ${(FINANCE.vatRate * 100).toFixed(0)} % et commission du prestataire de paiement ${(FINANCE.paymentFeeRate * 100).toFixed(0)} % (valeur provisoire), modifiables dans src/config/site.ts. Brut = encaissé TTC. Net = TTC − TVA − commission. Le coût d'analyse (en dollars) n'est pas déduit. Remboursés ou contestés sur la période (déjà exclus de ces revenus) : ${nb(d.refunds.refunded)} remboursement(s), ${nb(d.refunds.disputed)} contestation(s), soit ${eur(d.refunds.cents)}.`}
      >
        <Table
          head={["Protocole", "Paiements", "Brut TTC", "TVA", "HT", "Commission", "Net"]}
          rows={[...keys.map((k) => financeRow(`${k} · ${FORMULAS[k].label}`, d.revenue.byFormula[k])), financeRow("Total", d.revenue.total)]}
        />
      </Card>

      <Card title="Défis entre amis" note="Comptés au moment de l'événement : ces chiffres ne baissent pas quand un rapport est supprimé.">
        <Table head={["Défis créés", "Défis relevés", "Part relevée"]} rows={[[nb(d.challenges.created), nb(d.challenges.taken), pct(d.challenges.created > 0 ? d.challenges.taken / d.challenges.created : null)]]} />
      </Card>

      <Card
        title="Coût d'analyse par le modèle"
        note="En dollars, au tarif configuré (XAI_PRICE_IN_PER_M et XAI_PRICE_OUT_PER_M). Le coût d'une analyse livrée inclut le coût des refus."
      >
        <Table
          head={["Appels au modèle", "Analyses livrées", "Jetons (entrée / sortie)", "Coût total", "Moyenne par appel", "Par analyse livrée", "Durée moyenne"]}
          rows={[
            [
              nb(d.ai.modelCalls),
              nb(d.ai.delivered),
              `${nb(d.ai.tokensIn)} / ${nb(d.ai.tokensOut)}`,
              usd(d.ai.costUsd),
              usd(d.ai.avgPerCallUsd),
              usd(d.ai.avgPerDeliveredUsd),
              d.ai.avgVisionSeconds === null ? "—" : `${d.ai.avgVisionSeconds.toFixed(0)} s`,
            ],
          ]}
        />
      </Card>
    </div>
  );
}
