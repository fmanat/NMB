import Link from "next/link";
import { FORMULAS, formatEur } from "@/config/site";
import { Doc } from "@/components/Doc";

export const metadata = { title: "Analyse", robots: { index: false } };

export default function Page() {
  return (
    <Doc title="Choisissez un protocole">
      <div className="mt-6 space-y-3">
        {Object.values(FORMULAS).map((f) => {
          const available = f.id === "A";
          const body = (
            <div className={`panel p-4 flex items-center justify-between ${available ? "hover:border-accent" : "opacity-50"}`}>
              <div>
                <p className="num text-xs text-accent">PROTOCOLE {f.id}</p>
                <p className="font-semibold text-foreground">{f.label}</p>
                {!available && <p className="text-xs">Bientôt disponible</p>}
              </div>
              <p className="num text-xl text-accent-2">{formatEur(f.priceEur)}</p>
            </div>
          );
          return available ? (
            <Link key={f.id} href="/analyse/questionnaire" className="block">{body}</Link>
          ) : (
            <div key={f.id}>{body}</div>
          );
        })}
      </div>
    </Doc>
  );
}
