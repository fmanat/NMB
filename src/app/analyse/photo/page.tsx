import { cookies } from "next/headers";
import { photoPaidByPlisio } from "@/lib/payments/policy";
import { notFound, redirect } from "next/navigation";
import { FORMULAS, formatEur } from "@/config/site";
import { AGE_COOKIE, isAgeTokenValid } from "@/lib/age/token";
import { photoAccess } from "@/lib/photoAccess";
import { getCaptcha } from "@/lib/providers";
import { PhotoFlow } from "./PhotoFlow";

export const metadata = { title: "Analyse de photo", robots: { index: false, follow: false } };

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
  const free = beta && !paid;
  return (
    <div className="container-bm container-narrow pt-6 pb-10 md:py-14">
      {preview && (
        <p className="mb-4 rounded-[10px] border border-[var(--bm-warning-text)] px-4 py-3 t-small" data-photo-preview>
          <strong>Aperçu administrateur.</strong> La formule photo n&apos;est visible qu&apos;avec votre session d&apos;administration : le public ne la voit pas.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="t-h1 !text-[28px] !leading-[32px] md:!text-[40px] md:!leading-[44px]">{formula === "C" ? "Analyse de photo + mesures" : "Analyse de photo"}</h1>
        <span className="num rounded-full bg-[var(--bm-blue-100)] px-3 py-1 text-lg font-bold text-[#0f55d1] dark:text-[var(--accent)]" data-photo-price>{free ? "Gratuit pendant la bêta" : formatEur(def.priceEur)}</span>
      </div>
      <p className="mt-2 t-lead">Votre rapport morphométrique complet, en général en moins d&apos;une minute.</p>
      {!free && (
        <p className="mt-1 t-small text-muted">Paiement unique après l&apos;analyse. Photo refusée : rien à payer.</p>
      )}
      <div className="mt-5">
        <PhotoFlow formula={formula} captchaMode={getCaptcha().id} />
      </div>
    </div>
  );
}
