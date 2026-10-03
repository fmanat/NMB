import { Doc } from "@/components/Doc";
import { adminPreviewBypassesAge } from "@/lib/photoAccess";
import { startAgeVerification } from "./actions";

export const metadata = { title: "Vérification d'âge", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string; refus?: string }> }) {
  const { f, refus } = await searchParams;
  const formula = f === "C" ? "C" : "B";
  if (await adminPreviewBypassesAge()) {
    // Aperçu administrateur sans prestataire réel : on le dit tel quel, sans rien présenter comme une vérification d'âge.
    return (
      <Doc title="Vérification d'âge">
        <p className="mt-4 rounded-[10px] border border-[var(--bm-warning-text)] px-4 py-3" data-photo-preview>
          <strong>Aperçu administrateur.</strong> Aucun prestataire de vérification d&apos;âge n&apos;est encore branché : votre session
          d&apos;administration en tient lieu pour cet aperçu. Le public n&apos;a pas accès à la formule photo. À l&apos;ouverture, cette étape
          sera remplacée par la vérification du prestataire.
        </p>
        <form action={startAgeVerification.bind(null, formula)} className="mt-6">
          <button type="submit" className="btn btn-primary btn-block-mobile">Continuer (aperçu administrateur)</button>
        </form>
      </Doc>
    );
  }
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
