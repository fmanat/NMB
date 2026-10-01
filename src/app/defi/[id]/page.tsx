import { notFound } from "next/navigation";
import { Doc } from "@/components/Doc";
import { getInvite } from "@/lib/challenge";
import { isFreeBeta } from "@/lib/mode";
import { acceptChallenge } from "./actions";

export const metadata = { title: "Relever le défi", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invite = await getInvite(id);
  if (!invite) notFound();
  const beta = isFreeBeta();
  return (
    <Doc title="Un ami vous défie">
      {invite.available ? (
        <>
          <p className="mt-4">
            Faites votre propre analyse et comparez vos résultats avec ceux de votre ami.{" "}
            {beta
              ? "Vous remplissez le questionnaire pour obtenir votre propre rapport, gratuit pendant la bêta."
              : "Vous suivez le parcours complet du protocole de votre choix (vérification d'âge comprise pour les protocoles photo) et vous payez votre propre rapport."}{" "}
            Chacun peut retirer son rapport de la comparaison à tout moment. Aucune image n&apos;est jamais partagée.
          </p>
          <form action={acceptChallenge.bind(null, id)} className="mt-6">
            <button type="submit" className="btn-primary">Relever le défi</button>
          </form>
        </>
      ) : (
        <p className="mt-4">Ce défi a déjà été relevé ou n&apos;est plus disponible.</p>
      )}
    </Doc>
  );
}
