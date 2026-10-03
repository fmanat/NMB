import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ProgressStepper } from "@/components/analysis/ProgressStepper";
import { FORMULAS, formatEur } from "@/config/site";
import { isFreeBeta, isPhotoBeta } from "@/lib/mode";
import Link from "next/link";
import { QuestionnairePage } from "./QuestionnairePage";

export const metadata = { title: "Analyse", robots: { index: false } };

const HREF = { A: "/analyse/questionnaire", B: "/analyse/photo?f=B", C: "/analyse/photo?f=C" } as const;
const ICON: Record<"A" | "B" | "C", IconName> = { A: "ruler", B: "camera", C: "scanLine" };
const NOTE = {
  A: "Mesures déclarées, sans photo.",
  B: "Analyse de votre photo. Vérification d'âge par un prestataire tiers.",
  C: "Photo et mesures déclarées, avec comparaison. Vérification d'âge par un prestataire tiers.",
} as const;

// Bêta photo (bêta gratuite + PHOTO_BETA active) : deux protocoles gratuits, A et B ; libellés qui ne promettent que ce qui est fait.
const BETA_NOTE = {
  A: "Mesures que vous déclarez, sans photo. Rapport immédiat.",
  B: "Rapport morphométrique établi à partir de votre photo par un modèle d'analyse (xAI, États-Unis) : estimation visuelle, ou mesure calibrée si une carte au format bancaire figure sur la photo. Vérification d'âge par un prestataire tiers avant l'envoi.",
} as const;

function BetaChoice() {
  return (
    <div className="container-bm container-narrow py-8 md:py-14">
      <ProgressStepper steps={["Méthode", "Mesures", "Rapport"]} current={0} />
      <h1 className="t-h1 mt-8 !text-[30px] !leading-[34px] md:!text-[40px] md:!leading-[44px]">Choisissez un protocole</h1>
      <p className="t-lead text-muted mt-3">Les deux protocoles sont gratuits pendant la bêta : aucun paiement n&apos;est demandé.</p>
      <ul className="mt-8 space-y-4">
        {(["A", "B"] as const).map((id) => {
          const f = FORMULAS[id];
          return (
            <li key={id}>
              <Link href={HREF[id]} className="block" data-protocol={id}>
                <Card hover className="flex items-center gap-4">
                  <span className="grid place-items-center size-12 rounded-[10px] bg-soft text-accent flex-none"><Icon name={ICON[id]} size={24} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="t-caption text-accent uppercase tracking-[0.08em]">Protocole {id}</span>
                      {id === "B" && <Badge tone="warning">Bêta</Badge>}
                    </span>
                    <span className="block font-semibold text-foreground">{f.label}</span>
                    <span className="block t-small text-muted">{BETA_NOTE[id]}</span>
                  </span>
                  <span className="t-small font-semibold text-accent flex-none">Gratuit</span>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="t-small text-muted mt-6">
        Le protocole photo est en bêta : la photo n&apos;est jamais enregistrée par Bitomètre, mais elle est envoyée au prestataire d&apos;analyse qui conserve
        les requêtes 30 jours (détails dans la politique de confidentialité).
      </p>
    </div>
  );
}

export default function Page() {
  // Bêta gratuite : un seul protocole, donc pas de choix : /analyse est le questionnaire ; bêta photo : choix entre A et B.
  if (isFreeBeta()) return isPhotoBeta() ? <BetaChoice /> : <QuestionnairePage />;
  return (
    <div className="container-bm container-narrow py-8 md:py-14">
      <ProgressStepper steps={["Méthode", "Mesures", "Résultats", "Rapport"]} current={0} />
      <h1 className="t-h1 mt-8 !text-[30px] !leading-[34px] md:!text-[40px] md:!leading-[44px]">Choisissez un protocole</h1>
      <p className="t-lead text-muted mt-3">Comment souhaitez-vous faire votre analyse ?</p>
      <ul className="mt-8 space-y-4">
        {Object.values(FORMULAS).map((f) => (
          <li key={f.id}>
            <Link href={HREF[f.id]} className="block">
              <Card hover className="flex items-center gap-4">
                <span className="grid place-items-center size-12 rounded-[10px] bg-soft text-accent flex-none"><Icon name={ICON[f.id]} size={24} /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="t-caption text-accent uppercase tracking-[0.08em]">Protocole {f.id}</span>
                    {f.id === "B" && <Badge tone="blue">Recommandé</Badge>}
                  </span>
                  <span className="block font-semibold text-foreground">{f.label}</span>
                  <span className="block t-small text-muted">{NOTE[f.id]}</span>
                </span>
                <span className="num t-data-l flex-none">{formatEur(f.priceEur)}</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
