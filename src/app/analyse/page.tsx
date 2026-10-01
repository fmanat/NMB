import Link from "next/link";
import { redirect } from "next/navigation";
import { isFreeBeta } from "@/lib/mode";
import { FORMULAS, formatEur } from "@/config/site";
import { Doc } from "@/components/Doc";

export const metadata = { title: "Analyse", robots: { index: false } };

const HREF = { A: "/analyse/questionnaire", B: "/analyse/photo?f=B", C: "/analyse/photo?f=C" } as const;
const NOTE = {
  A: "Mesures déclarées, sans photo.",
  B: "Analyse de votre photo. Vérification d'âge par un prestataire tiers.",
  C: "Photo et mesures déclarées, avec comparaison. Vérification d'âge par un prestataire tiers.",
} as const;

export default function Page() {
  if (isFreeBeta()) redirect("/analyse/questionnaire"); // bêta gratuite : un seul protocole
  return (
    <Doc title="Choisissez un protocole">
      <div className="mt-6 space-y-3">
        {Object.values(FORMULAS).map((f) => (
          <Link key={f.id} href={HREF[f.id]} className="block">
            <div className="panel p-4 flex items-center justify-between hover:border-accent">
              <div>
                <p className="num text-xs text-accent">PROTOCOLE {f.id}</p>
                <p className="font-semibold text-foreground">{f.label}</p>
                <p className="text-xs">{NOTE[f.id]}</p>
              </div>
              <p className="num text-xl text-accent-2">{formatEur(f.priceEur)}</p>
            </div>
          </Link>
        ))}
      </div>
    </Doc>
  );
}
