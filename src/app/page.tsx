import Link from "next/link";
import { FORMULAS, formatEur } from "@/config/site";
import { ScanButton } from "@/components/ScanButton";
import { Gauge } from "@/components/Gauge";

const BADGES = ["Connexion chiffrée", "Photo jamais stockée par Bitomètre", "Aucun compte"];

const FORMULA_TEXT: Record<string, string> = {
  A: "Vos mesures déclarées et quelques questions de forme. Rapport calculé sans photo.",
  B: "Analyse de votre photo avec une carte de référence. Rapport complet.",
  C: "Photo et mesures déclarées, avec comparaison déclaré / estimé.",
};

export default function Home() {
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
          Un rapport chiffré en quelques minutes : score sur 100, percentiles, courbure, symétrie. Sans compte,
          paiement unique.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <ScanButton label="Lancer l'analyse" />
          <ul className="flex flex-wrap justify-center gap-2 text-xs text-muted">
            {BADGES.map((b) => (
              <li key={b} className="border border-border rounded-full px-3 py-1 bg-surface">
                <span className="text-accent mr-1">●</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-14 flex justify-center gap-8 opacity-90">
          <Gauge label="Score" />
          <Gauge label="Symétrie" />
          <Gauge label="Confiance" />
        </div>
      </section>

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
          Paiement unique, sans abonnement, accès à votre rapport par son lien privé. Le détail du calcul est public :{" "}
          <Link href="/methode" className="underline">
            Précision et méthode
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
