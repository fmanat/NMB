import { ScanButton } from "@/components/ScanButton";
import { Icon } from "@/components/ui/Icon";
import { TryItLoader } from "./TryItLoader";

/**
 * Section « Essayez » de l'accueil : texte et mention rendus par le serveur, simulation interactive chargée en différé dans le navigateur.
 * La simulation ne fait aucune requête et ne stocke rien : elle appelle les mêmes fonctions de calcul que le rapport réel.
 */
export function TrySection() {
  return (
    <section id="essayez" aria-labelledby="essayez-titre" className="section">
      <div className="container-bm">
        <p className="t-eyebrow">Essayez</p>
        <h2 id="essayez-titre" className="t-h2 mt-3 max-w-[30ch]">Déplacez les curseurs, voyez où vous vous situez.</h2>
        <p className="t-lead text-muted mt-4 max-w-[46rem]">
          Les mêmes références et les mêmes calculs que le rapport (percentiles, courbes, repères de taille), exécutés dans votre navigateur.
        </p>
        <p className="mt-4 inline-flex items-start gap-2 rounded-[10px] bg-[var(--bm-blue-050)] border border-[var(--bm-blue-100)] px-4 py-3 text-sm font-semibold">
          <Icon name="lock" size={18} className="mt-0.5 flex-none text-accent" />
          <span>Simulation locale : rien n&apos;est enregistré ni envoyé.</span>
        </p>
        <noscript>
          <p className="t-small text-muted mt-4">La simulation demande JavaScript. Le questionnaire, lui, fonctionne sans.</p>
        </noscript>
        <div className="mt-8">
          <TryItLoader />
        </div>
        <div className="mt-8 text-center">
          <ScanButton label="Remplir le vrai questionnaire" />
        </div>
      </div>
    </section>
  );
}
