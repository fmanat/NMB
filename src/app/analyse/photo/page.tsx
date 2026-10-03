import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { FORMULAS, formatEur } from "@/config/site";
import { AGE_COOKIE, isAgeTokenValid } from "@/lib/age/token";
import { isPhotoBeta } from "@/lib/mode";
import { getCaptcha } from "@/lib/providers";
import { PhotoFlow } from "./PhotoFlow";

export const metadata = { title: "Envoi de la photo", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const formula = f === "C" ? "C" : "B";
  const beta = isPhotoBeta();
  if (beta && formula === "C") notFound(); // bêta photo : la formule C reste masquée
  // Sans jeton de majorité valide, l'écran d'envoi est inaccessible (contrôle refait côté serveur à l'envoi).
  const store = await cookies();
  if (!isAgeTokenValid(store.get(AGE_COOKIE)?.value)) redirect(`/verification-age?f=${formula}`);

  const def = FORMULAS[formula];
  return (
    <Doc title={`Protocole ${formula} : ${def.label.toLowerCase()} (${beta ? "gratuit pendant la bêta" : formatEur(def.priceEur)})`}>
      {beta && (
        <p className="mt-4 t-small text-muted">
          Bêta : aucun paiement n&apos;est demandé. Les dimensions sont estimées à partir de la photo par un modèle d&apos;analyse, ou mesurées
          sur une carte de référence si vous en posez une à côté ; le rapport s&apos;affiche directement.
        </p>
      )}
      <div className="mt-6">
        <PhotoFlow formula={formula} captchaMode={getCaptcha().id} />
      </div>
    </Doc>
  );
}
