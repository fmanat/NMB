import Link from "next/link";
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
    <div className="container-bm container-narrow pt-6 pb-10 md:py-14">
      <h1 className="t-h1 !text-[28px] !leading-[32px] md:!text-[40px] md:!leading-[44px]">Vérification d&apos;âge</h1>
      <p className="mt-3 t-lead text-muted">
        L&apos;envoi d&apos;une photo est réservé aux adultes : un prestataire tiers vérifie votre âge (il peut savoir que la demande vient de ce site) et ne nous transmet qu&apos;une réponse
        « majeur : oui », sans donnée d&apos;identité (<Link href="/confidentialite" className="underline">détails</Link>).
      </p>
      {refus && <p className="mt-4 text-[var(--bm-error-text)]" role="alert">La vérification n&apos;a pas abouti. Vous ne pouvez pas envoyer de photo.</p>}
      <form action={startAgeVerification.bind(null, formula)} className="mt-6">
        <button type="submit" className="btn btn-primary btn-block">Vérifier mon âge</button>
      </form>
    </div>
  );
}
