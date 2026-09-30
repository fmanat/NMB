import { Doc } from "@/components/Doc";

export const metadata = { title: "Conditions générales de vente" };

export default function Page() {
  return (
    <Doc title="Conditions générales de vente" draft>
      <h2>Objet et prix</h2>
      <p>Vente d&apos;un rapport d&apos;analyse chiffré, en paiement unique, prix TTC en euros affichés sur le site.</p>
      <h2>Accès immédiat et rétractation</h2>
      <p>
        Avant le paiement, l&apos;utilisateur demande l&apos;accès immédiat à son rapport et renonce à son droit de
        rétractation (Code de la consommation, art. L221-28, 13°).
      </p>
      <h2>À compléter</h2>
      <p>Responsabilité, réclamations, médiation, droit applicable : ________.</p>
    </Doc>
  );
}
