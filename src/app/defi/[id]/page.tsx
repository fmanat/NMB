import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvite } from "@/lib/challenge";
import { recordEvent, shouldCount } from "@/lib/funnel";
import { isFreeBeta } from "@/lib/mode";
import { TrackOnView } from "@/components/Tracked";
import { Icon } from "@/components/ui/Icon";
import { acceptChallenge } from "./actions";

export const metadata = { title: "Relever le défi", robots: { index: false, follow: false } };

/** Page d'arrivée d'un ami invité : l'enjeu, ce qu'il va faire, et un seul bouton. Ne révèle rien du rapport de l'auteur du défi. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invite = await getInvite(id);
  if (!invite) notFound();
  const beta = isFreeBeta();
  // Visite d'un lien de défi (arrivée par un ami) : comptage anonyme, robots et Do Not Track exclus.
  if (invite.available && shouldCount(await headers())) await recordEvent("challenge_visit");
  return (
    <div className="container-bm py-10 md:py-16">
      <TrackOnView event="referral_visit" once={id} />
      <div className="mx-auto max-w-xl">
        {invite.available ? (
          <div className="rounded-[22px] bg-[var(--bm-navy-900)] text-white p-6 md:p-10 text-center shadow-[var(--shadow-elevated)]">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10 text-[#9fc2ff]"><Icon name="users" size={28} /></span>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9fc2ff]">Défi</p>
            <h1 className="t-h1 mt-2 !text-[32px] !leading-[36px] md:!text-[40px] md:!leading-[44px]">Un ami vous défie</h1>
            <p className="mt-4 text-[#dbe6f7] text-[17px] leading-[26px]">
              Il a déjà son résultat. À quel percentile êtes-vous ? Faites le test, puis comparez vos résultats côte à côte.
            </p>
            <ul className="mt-6 space-y-2 text-left text-[15px] text-[#c9d6ea] max-w-[26rem] mx-auto">
              <li className="flex gap-2"><Icon name="check" size={18} className="mt-0.5 flex-none text-[#9fc2ff]" />{beta ? "Le test est gratuit pendant la bêta, environ une minute, sans compte." : "Vous suivez le parcours de votre choix et payez votre propre rapport."}</li>
              <li className="flex gap-2"><Icon name="check" size={18} className="mt-0.5 flex-none text-[#9fc2ff]" />Comparaison des scores et des percentiles seulement : aucune mesure, aucune image.</li>
              <li className="flex gap-2"><Icon name="check" size={18} className="mt-0.5 flex-none text-[#9fc2ff]" />Chacun peut retirer son rapport de la comparaison à tout moment.</li>
            </ul>
            <form action={acceptChallenge.bind(null, id)} className="mt-8">
              <button type="submit" className="btn btn-block !bg-white !text-[var(--bm-navy-900)] hover:!bg-[var(--bm-blue-100)] !min-h-[56px]">
                <span>Relever le défi</span>
                <Icon name="arrowRight" size={18} />
              </button>
            </form>
            <p className="mt-4 t-small text-[#9fb3d1]">Réservé aux adultes. Résultats statistiques, pas un avis médical.</p>
          </div>
        ) : (
          <div className="card text-center space-y-3">
            <h1 className="t-h2">Ce défi n&apos;est plus disponible</h1>
            <p className="text-muted">Il a déjà été relevé ou retiré. Vous pouvez quand même découvrir votre percentile.</p>
            <Link href="/" className="btn btn-primary">Découvrir mon percentile</Link>
          </div>
        )}
      </div>
    </div>
  );
}
