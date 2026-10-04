import { cookies } from "next/headers";
import { photoPaidByPlisio } from "@/lib/payments/policy";
import { notFound, redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { FORMULAS, formatEur } from "@/config/site";
import { AGE_COOKIE, isAgeTokenValid } from "@/lib/age/token";
import { photoAccess } from "@/lib/photoAccess";
import { getCaptcha } from "@/lib/providers";
import { PhotoFlow } from "./PhotoFlow";

export const metadata = { title: "Envoi de la photo", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const formula = f === "C" ? "C" : "B";
  const { available: beta, preview } = await photoAccess();
  if (beta && formula === "C") notFound(); // bêta photo : la formule C reste masquée
  // Sans jeton de majorité valide, l'écran d'envoi est inaccessible (contrôle refait côté serveur à l'envoi).
  const store = await cookies();
  if (!isAgeTokenValid(store.get(AGE_COOKIE)?.value)) redirect(`/verification-age?f=${formula}`);

  const def = FORMULAS[formula];
  const paid = photoPaidByPlisio(); // formule photo payante par Plisio (src/lib/payments/policy.ts)
  return (
    <Doc title={`Protocole ${formula} : ${def.label.toLowerCase()} (${beta && !paid ? "gratuit pendant la bêta" : formatEur(def.priceEur)})`}>
      {preview && <div className="mt-4"><p className="rounded-[10px] border border-[var(--bm-warning-text)] px-4 py-3 t-small" data-photo-preview>
          <strong>Aperçu administrateur.</strong> La formule photo n&apos;est visible qu&apos;avec votre session d&apos;administration : le public ne la voit pas.
        </p></div>}
      {beta && paid && (
        <p className="mt-4 t-small text-muted">
          Les dimensions sont estimées à partir de la photo par un modèle d&apos;analyse, ou mesurées sur une carte de référence si vous en posez
          une à côté. Une fois l&apos;analyse terminée, le rapport est verrouillé jusqu&apos;au paiement ({formatEur(def.priceEur)} TTC, paiement unique en
          cryptomonnaie sur la page de Plisio). En cas de refus de la photo, aucun paiement n&apos;est demandé.
        </p>
      )}
      {beta && !paid && (
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
