import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { isFreeBeta } from "@/lib/mode";
import { getChallengeState, type Side } from "@/lib/challenge";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { getReportView } from "@/lib/view";
import { startChallenge } from "../actions";
import { CopyLink } from "./CopyLink";
import { WithdrawButton } from "./WithdrawButton";

export const metadata = { title: "Défier un ami", robots: { index: false, follow: false, nocache: true }, ...PRIVATE_SOCIAL };

const f1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const basisLabel = (s: Side) => (s.basis === "declared" ? "valeurs déclarées" : "analyse de photo");

function Row({ label, me, other }: { label: string; me: string; other: string }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="p-3 font-sans font-normal text-left text-muted">{label}</th>
      <td className="p-3 text-accent">{me}</td>
      <td className="p-3 text-accent-2">{other}</td>
    </tr>
  );
}

/** Percentile affiché, ou « — » s'il n'est pas calculé (rapport photo au repos). */
const pct = (p: number | null) => (p === null ? "—" : f1(p));

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { id } = await params;
  const { erreur } = await searchParams;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();
  if (view.status === "locked") redirect(`/r/${id}`);
  if (view.results.morpho?.partielle) redirect(`/r/${id}`); // rapport partiel : pas de défi
  const state = await getChallengeState(id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = "challengeId" in state ? `${proto}://${host}/defi/${state.challengeId}` : "";

  return (
    <Doc title="Défier un ami">
      {erreur && <p className="mt-4 text-[var(--bm-error-text)]" role="alert">{erreur}</p>}

      {state.status === "none" && (
        <>
          <p className="mt-4">
            Créez un lien de défi et envoyez-le à un ami.{" "}
            {isFreeBeta()
              ? "Il remplit le questionnaire pour obtenir son propre rapport, gratuit pendant la bêta. Vous ne voyez rien de l'autre tant qu'il n'a pas son rapport : ensuite, "
              : "Il suit le parcours complet de son protocole, vérification d'âge comprise pour les protocoles photo, et paie son propre rapport. Vous ne voyez rien de l'autre tant que vos deux rapports ne sont pas débloqués : ensuite, "}
            scores et percentiles côte à côte, sans aucune image.
          </p>
          <form action={startChallenge.bind(null, id)} className="mt-6">
            <button type="submit" className="btn btn-primary btn-block-mobile">Créer mon lien de défi</button>
          </form>
        </>
      )}

      {state.status === "creator_waiting_friend" && (
        <>
          <p className="mt-4">Envoyez ce lien à votre ami. Il ne révèle rien de votre rapport.</p>
          <div className="mt-4"><CopyLink url={inviteUrl} /></div>
          <p className="mt-4 text-sm">En attente : personne n&apos;a encore relevé le défi.</p>
          <div className="mt-6"><WithdrawButton id={id} /></div>
        </>
      )}

      {state.status === "waiting_payment" && (
        <>
          <p className="mt-4">Le défi est relevé. La comparaison apparaîtra dès que vos deux rapports seront débloqués.</p>
          {state.role === "creator" && <div className="mt-4"><CopyLink url={inviteUrl} /></div>}
          <div className="mt-6"><WithdrawButton id={id} /></div>
        </>
      )}

      {state.status === "withdrawn_self" && <p className="mt-4">Vous avez retiré votre rapport de la comparaison. Plus rien n&apos;est partagé.</p>}
      {state.status === "withdrawn_other" && <p className="mt-4">L&apos;autre participant a retiré son rapport de la comparaison.</p>}

      {state.status === "ready" && (
        <>
          <div className="panel overflow-x-auto mt-6">
            <table className="w-full text-sm num">
              <thead className="text-left text-muted font-sans">
                <tr>
                  <th scope="col" className="p-3"><span className="sr-only">Indicateur</span></th>
                  <th scope="col" className="p-3">Vous</th>
                  <th scope="col" className="p-3">Votre ami</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Score" me={`${state.me.score} / 100`} other={`${state.other.score} / 100`} />
                <Row label="Percentile de longueur" me={pct(state.me.lengthPercentile)} other={pct(state.other.lengthPercentile)} />
                <Row label="Percentile de circonférence" me={pct(state.me.girthPercentile)} other={pct(state.other.girthPercentile)} />
                <Row label="Base des valeurs" me={basisLabel(state.me)} other={basisLabel(state.other)} />
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Les scores sont des notes de présentation, pas des percentiles. Des valeurs déclarées ne sont pas vérifiées : comparer
            un protocole questionnaire à un protocole photo n&apos;est pas équivalent.
          </p>
          <div className="mt-6"><WithdrawButton id={id} /></div>
        </>
      )}

      <p className="mt-6"><Link href={`/r/${id}`} className="underline">Retour au rapport</Link></p>
    </Doc>
  );
}
