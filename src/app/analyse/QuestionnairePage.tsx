import { ProgressStepper } from "@/components/analysis/ProgressStepper";
import { TrackView } from "@/components/TrackView";
import { Icon } from "@/components/ui/Icon";
import { isFreeBeta } from "@/lib/mode";
import { QuestionnaireForm } from "./QuestionnaireForm";

/** Écran de saisie des mesures (protocole A) : indicateur d'étapes, une seule question (« quelles sont vos mesures ? »), formulaire. */
export function QuestionnairePage() {
  const beta = isFreeBeta();
  return (
    <div className="container-bm container-narrow py-8 md:py-14">
      <TrackView event="questionnaire_start" />
      <ProgressStepper steps={beta ? ["Mesures", "Calcul", "Rapport"] : ["Méthode", "Mesures", "Résultats", "Rapport"]} current={beta ? 0 : 1} />
      <h1 className="t-h1 mt-8 !text-[30px] !leading-[34px] md:!text-[40px] md:!leading-[44px]">{beta ? "Vos mesures" : "Protocole A : questionnaire"}</h1>
      <p className="t-lead text-muted mt-3">Indiquez vos valeurs en centimètres. Elles servent uniquement à calculer votre rapport.</p>
      <div className="mt-6 md:mt-8">
        <QuestionnaireForm beta={beta} />
      </div>
      <p className="t-small text-muted mt-5 flex items-start gap-2">
        <Icon name="lock" size={16} className="mt-0.5 flex-none" />
        <span>Pas de compte, pas d&apos;e-mail. Votre rapport est accessible par un lien privé que vous pouvez supprimer à tout moment.</span>
      </p>
    </div>
  );
}
