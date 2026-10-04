import { exampleReport } from "@/lib/exampleReport";
import { isPhotoPaidPublic } from "@/lib/payments/policy";
import { isFreeBeta } from "@/lib/mode";
import { buildTickerItems } from "@/lib/ticker";
import { getLiveAnalysisStats } from "@/lib/tickerStats";
import { TickerBand } from "./TickerBand";

/**
 * Bandeau défilant de l'accueil. Composant serveur : lit les agrégats de la base (mémoire courte, délai maximal, jamais bloquant),
 * la date de construction injectée par next.config.ts et le mode bêta, puis rend la liste. L'accueil étant régénéré toutes les
 * quelques minutes (`revalidate` de la page), le compteur reste à jour sans appel réseau dans le navigateur.
 */
export async function InfoTicker() {
  const live = await getLiveAnalysisStats();
  const items = buildTickerItems({
    freeBeta: isFreeBeta(),
    photoPaid: isPhotoPaidPublic(),
    // Remplacé à la construction par next.config.ts (`env`) ; en développement : date du démarrage du serveur.
    buildDate: process.env.BITOMETRE_BUILD_DATE,
    live,
    report: exampleReport(),
  });
  return <TickerBand items={items} />;
}
