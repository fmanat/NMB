import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { FORMULAS, formatEur } from "@/config/site";
import { AGE_COOKIE, isAgeTokenValid } from "@/lib/age/token";
import { getCaptcha } from "@/lib/providers";
import { PhotoFlow } from "./PhotoFlow";

export const metadata = { title: "Envoi de la photo", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const formula = f === "C" ? "C" : "B";
  // Sans jeton de majorité valide, l'écran d'envoi est inaccessible (contrôle refait côté serveur à l'envoi).
  const store = await cookies();
  if (!isAgeTokenValid(store.get(AGE_COOKIE)?.value)) redirect(`/verification-age?f=${formula}`);

  const def = FORMULAS[formula];
  return (
    <Doc title={`Protocole ${formula} : ${def.label.toLowerCase()} (${formatEur(def.priceEur)})`}>
      <div className="mt-6">
        <PhotoFlow formula={formula} captchaMode={getCaptcha().id} />
      </div>
    </Doc>
  );
}
