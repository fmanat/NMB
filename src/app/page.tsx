import Link from "next/link";
import { FORMULAS, REPORT_ACCESS, formatEur } from "@/config/site";
import { BETA, isFreeBeta } from "@/lib/mode";
import { ScanButton } from "@/components/ScanButton";
import { Gauge } from "@/components/Gauge";

const BADGES = ["Connexion chiffrée", "Photo jamais stockée par Bitomètre", "Aucun compte"];
const BADGES_BETA = ["Connexion chiffrée", "Aucun compte", "Bêta gratuite"];

const FORMULA_TEXT: Record<string, string> = {
  A: "Vos mesures déclarées et quelques questions de forme. Rapport calculé sans photo.",
  B: "Analyse de votre photo avec une carte de référence. Rapport complet.",
  C: "Photo et mesures déclarées, avec comparaison déclaré / estimé.",
};

export default function Home() {
  const beta = isFreeBeta();
  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-16 sm:py-24 text-center">
        <p className="num text-xs text-accent tracking-widest uppercase mb-4">
          Dossier n° ---- · Laboratoire de statistiques biométriques
        </p>
        <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight">
          Mesurez. Comparez. <span className="text-accent">Quantifiez.</span>
        </h1>
        <p className="mt-5 mx-auto max-w-xl text-muted">
          Un rapport chiffré en quelques minutes : score sur 100, percentiles, courbure, symétrie.{" "}
          {beta ? "Sans compte, gratuit pendant la bêta." : "Sans compte, paiement unique."}
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <ScanButton label="Lancer l'analyse" />
          <ul className="flex flex-wrap justify-center gap-2 text-xs text-muted">
            {(beta ? BADGES_BETA : BADGES).map((b) => (
              <li key={b} className="border border-border rounded-full px-3 py-1 bg-surface">
                <span className="text-accent mr-1">●</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-14 flex justify-center gap-3 sm:gap-8 opacity-90">
          <Gauge label="Score" />
          <Gauge label="Symétrie" />
          <Gauge label="Confiance" />
        </div>
      </section>

      {beta ? (
        <section className="py-8">
          <h2 className="text-2xl font-semibold mb-6">Le questionnaire</h2>
          <div className="panel p-5 flex flex-col gap-3 max-w-md">
            <span className="num text-xs text-accent">PROTOCOLE A · BÊTA GRATUITE</span>
            <h3 className="text-lg font-semibold">{FORMULAS.A.label}</h3>
            <p className="text-sm text-muted flex-1">Vos mesures déclarées et quelques questions de forme. Rapport calculé immédiatement.</p>
            <p className="num text-2xl text-accent-2">Gratuit</p>
          </div>
          <p className="mt-4 text-xs text-muted">
            Service en bêta : gratuit, sans garantie de conservation des rapports (effacés au plus tard après {BETA.reportTtlDays} jours).
            Le détail du calcul est public :{" "}
            <Link href="/methode" className="underline">
              Précision et méthode
            </Link>
            .
          </p>
        </section>
      ) : (
        <section className="py-8">
          <h2 className="text-2xl font-semibold mb-6">Trois protocoles</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.values(FORMULAS).map((f) => (
              <div key={f.id} className="panel p-5 flex flex-col gap-3">
                <span className="num text-xs text-accent">PROTOCOLE {f.id}</span>
                <h3 className="text-lg font-semibold">{f.label}</h3>
                <p className="text-sm text-muted flex-1">{FORMULA_TEXT[f.id]}</p>
                <p className="num text-2xl text-accent-2">{formatEur(f.priceEur)}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Paiement unique, sans abonnement, rapport accessible par son lien privé pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment. Le détail du calcul est public :{" "}
            <Link href="/methode" className="underline">
              Précision et méthode
            </Link>
            .
          </p>
        </section>
      )}
    </div>
  );
}
