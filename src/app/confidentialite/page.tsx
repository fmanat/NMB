import { Doc } from "@/components/Doc";

export const metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <Doc title="Politique de confidentialité" draft>
      <h2>Données conservées</h2>
      <p>
        Identifiant du rapport, formule, résultats chiffrés, commentaire, statut de paiement et date. Aucun e-mail, aucun
        compte, aucune donnée d&apos;identité.
      </p>
      <h2>Photo</h2>
      <p>Traitée en mémoire, transmise uniquement au moteur d&apos;analyse, jamais stockée. Conservation côté prestataire : ________.</p>
      <h2>Adresse IP</h2>
      <p>Hachée, utilisée uniquement pour limiter le nombre d&apos;analyses, effacée après 24 heures.</p>
      <h2>Mesure d&apos;audience</h2>
      <p>Sans cookie, hébergée dans l&apos;Union européenne. Aucun pixel publicitaire.</p>
      <h2>Vos droits</h2>
      <p>Vous pouvez supprimer votre rapport à tout moment depuis sa page. Contact : ________.</p>
    </Doc>
  );
}
