import { InfoTicker } from "@/components/ticker/InfoTicker";

// Emplacement « bandeau » de la mise en page (route parallèle) : le bandeau défilant d'informations vraies s'affiche tout en haut de
// l'ACCUEIL seulement, au-dessus du menu. Les autres pages rendent l'emplacement vide (`default.tsx` au chargement, `[...autres]` lors
// d'une navigation dans le site). Même fraîcheur que l'accueil : régénéré toutes les 5 minutes (valeur littérale, vérifiée par test).
export const revalidate = 300;

export default function BandeauAccueil() {
  return <InfoTicker />;
}
