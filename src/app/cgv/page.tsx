import Link from "next/link";
import { Doc } from "@/components/Doc";

export const metadata = { title: "Conditions générales de vente" };

export default function Page() {
  return (
    <Doc title="Conditions générales de vente" draft>
      <h2>Vendeur</h2>
      <p>
        Le vendeur est l&apos;éditeur du site, identifié dans les <Link href="/mentions-legales" className="underline">mentions légales</Link>.
      </p>

      <h2>Objet et prix</h2>
      <p>
        Vente d&apos;un rapport d&apos;analyse chiffré, en paiement unique et sans abonnement. Le prix de chaque protocole est
        indiqué en euros, toutes taxes comprises, avant le paiement.
      </p>

      <h2>Accès immédiat et renonciation au droit de rétractation</h2>
      <p>
        Le rapport est un contenu numérique fourni sans support matériel. Avant le paiement, l&apos;acheteur demande
        expressément l&apos;accès immédiat à son rapport, renonce à son droit de rétractation et reconnaît le perdre dès que
        l&apos;accès commence.
      </p>
      <p>Cette renonciation s&apos;appuie sur :</p>
      <ul>
        <li>
          pour les acheteurs relevant du droit britannique : le règlement 37 des Consumer Contracts (Information, Cancellation and
          Additional Charges) Regulations 2013 (« CCR 2013 »), qui prévoit la perte du droit d&apos;annulation lorsque la fourniture
          d&apos;un contenu numérique commence après le consentement exprès du consommateur et sa reconnaissance de cette perte ;
        </li>
        <li>
          pour les acheteurs relevant du droit français : l&apos;article L221-28, 13° du Code de la consommation (contenu numérique
          non fourni sur un support matériel dont l&apos;exécution a commencé après accord préalable exprès du consommateur et
          renoncement exprès à son droit de rétractation).
        </li>
      </ul>

      <h2>Droit applicable</h2>
      <p>
        Les présentes conditions sont régies par le droit anglais. Si vous êtes consommateur, cela ne vous prive pas de la
        protection que vous accordent les dispositions impératives de la loi du pays où vous résidez habituellement.
      </p>

      <h2>À compléter</h2>
      <p>
        Modes de paiement acceptés, garantie légale applicable aux contenus numériques, réclamations, médiation de la consommation
        et juridiction compétente : ________.
      </p>
    </Doc>
  );
}
