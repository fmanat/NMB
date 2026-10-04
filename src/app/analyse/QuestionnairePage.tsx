import { cookies } from "next/headers";
import Link from "next/link";
import { FORMULAS, formatEur } from "@/config/site";
import { TrackView } from "@/components/TrackView";
import { TrackOnView } from "@/components/Tracked";
import { Icon } from "@/components/ui/Icon";
import { CHALLENGE_COOKIE } from "@/lib/challenge";
import { isFreeBeta } from "@/lib/mode";
import { QuestionnaireForm } from "./QuestionnaireForm";

/**
 * Écran du test (protocole A). `photo` : la formule photo est accessible (lien discret pour qui vient avec cette intention ; l'offre
 * principale est présentée après le résultat). `photoPaid` : elle est payante.
 */
export async function QuestionnairePage({ photo = false, photoPaid = false }: { photo?: boolean; photoPaid?: boolean } = {}) {
  const beta = isFreeBeta();
  const challenged = Boolean((await cookies()).get(CHALLENGE_COOKIE)?.value);
  return (
    <div className="container-bm container-narrow py-6 md:py-12">
      <TrackView event="questionnaire_start" />
      <TrackOnView event="test_start" />
      {challenged && (
        <p className="mb-5 flex items-center gap-2 rounded-[12px] bg-[var(--bm-navy-900)] px-4 py-3 text-white t-small font-semibold" data-challenge-banner>
          <Icon name="users" size={18} className="flex-none text-[#9fc2ff]" />
          Défi d&apos;un ami : à vous de jouer. Vos résultats seront comparés quand vous aurez le vôtre.
        </p>
      )}
      <QuestionnaireForm beta={beta} />
      <p className="t-small text-muted mt-5 flex items-start gap-2">
        <Icon name="lock" size={16} className="mt-0.5 flex-none" />
        <span>Pas de compte, pas d&apos;e-mail. Votre résultat s&apos;ouvre par un lien privé que vous pouvez supprimer à tout moment.</span>
      </p>
      {photo && (
        <p className="t-small text-muted mt-3 flex items-start gap-2" data-photo-link>
          <Icon name="camera" size={16} className="mt-0.5 flex-none" />
          <span>
            Vous préférez une analyse sur photo ?{" "}
            <Link href="/analyse/photo?f=B" className="text-accent underline font-semibold">Analyse photo{photoPaid ? ` (${formatEur(FORMULAS.B.priceEur)})` : ""}</Link>
          </span>
        </p>
      )}
    </div>
  );
}
