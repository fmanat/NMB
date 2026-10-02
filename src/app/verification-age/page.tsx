import { Doc } from "@/components/Doc";
import { startAgeVerification } from "./actions";

export const metadata = { title: "Vérification d'âge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string; refus?: string }> }) {
  const { f, refus } = await searchParams;
  const formula = f === "C" ? "C" : "B";
  return (
    <Doc title="Vérification d'âge">
      <p className="mt-4">
        L&apos;envoi d&apos;une photo est réservé aux adultes. La vérification est réalisée par un prestataire tiers : il peut savoir
        que la demande vient de ce site, et la procédure n&apos;est pas anonyme au sens du RGPD. Ce site, lui, ne reçoit qu&apos;une
        réponse « majeur : oui », sans aucune donnée d&apos;identité. Cette réponse reste valable 30 minutes.
      </p>
      {refus && <p className="mt-4 text-[var(--bm-error-text)]" role="alert">La vérification n&apos;a pas abouti. Vous ne pouvez pas envoyer de photo.</p>}
      <form action={startAgeVerification.bind(null, formula)} className="mt-6">
        <button type="submit" className="btn btn-primary btn-block-mobile">Vérifier mon âge</button>
      </form>
    </Doc>
  );
}
