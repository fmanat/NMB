import Link from "next/link";
import { notFound } from "next/navigation";
import { Doc } from "@/components/Doc";
import { FORMULAS, REPORT_ACCESS, formatEur } from "@/config/site";
import { BETA, isFreeBeta, isPhotoBeta } from "@/lib/mode";
import { photoPaidByPlisio } from "@/lib/payments/policy";

export const metadata = { title: "Conditions d'utilisation (bêta)", alternates: { canonical: "/conditions" } };

// Remplace les CGV pendant la bêta gratuite (les CGV restent prêtes pour la version payante : /cgv).
export default function Page() {
  if (!isFreeBeta()) notFound();
  const photo = isPhotoBeta();
  // Protocole photo payant par Plisio (PLISIO_SECRET_KEY renseignée) : textes factuels ajoutés le 04/10/2026, À FAIRE RELIRE PAR LE JURISTE.
  const paid = photo && photoPaidByPlisio();
  const price = formatEur(FORMULAS.B.priceEur);
  return (
    <Doc title="Conditions d'utilisation de la bêta">
      <h2>{paid ? "Service en bêta" : "Service en bêta, gratuit"}</h2>
      {paid ? (
        <p>
          Bitomètre est en phase de test (« bêta »). Le questionnaire et le rapport qui en découle sont gratuits. Le protocole photo est payant :{" "}
          {price} TTC par rapport, en paiement unique, sans abonnement. L&apos;éditeur est identifié dans les{" "}
          <Link href="/mentions-legales" className="underline">mentions légales</Link>.
        </p>
      ) : (
      <p>
        Bitomètre est en phase de test (« bêta »). {photo ? "Le questionnaire, le protocole photo et les rapports qui en découlent" : "Le questionnaire et le rapport qui en découle"} sont gratuits : aucun paiement
        n&apos;est demandé et aucune donnée de paiement n&apos;est collectée. L&apos;éditeur est identifié dans les{" "}
        <Link href="/mentions-legales" className="underline">mentions légales</Link>.
      </p>
      )}

      {paid && (
        <>
          <h2>Prix et paiement du protocole photo</h2>
          <ul>
            <li>Prix : {price} toutes taxes comprises, par rapport, en paiement unique. Aucun abonnement, aucun prix barré.</li>
            <li>
              Le paiement n&apos;est demandé qu&apos;une fois l&apos;analyse terminée : le rapport est alors verrouillé jusqu&apos;au paiement. Si la photo est
              refusée, aucun paiement n&apos;est demandé.
            </li>
            <li>
              Le paiement se fait en cryptomonnaie (BTC, ETH, LTC, SOL, ou USDT et USDC sur Ethereum, Tron pour l&apos;USDT, Solana pour l&apos;USDC) sur la page de paiement
              de Plisio, notre prestataire. La facture est établie en euros ; les éventuels frais de réseau de votre portefeuille restent à votre charge.
            </li>
            <li>
              Le rapport s&apos;ouvre uniquement lorsque Plisio nous confirme le paiement complet. Un paiement partiel, une facture expirée ou annulée
              n&apos;ouvrent pas le rapport.
            </li>
            <li>
              Avant le paiement, vous demandez l&apos;accès immédiat à votre rapport et renoncez expressément à votre droit de rétractation (Code de la
              consommation, article L221-28, 13° ; règlement 37 des Consumer Contracts Regulations 2013) : vous le perdez dès que l&apos;accès commence.
            </li>
            <li>Un rapport payé reste accessible par son lien privé pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.</li>
          </ul>
        </>
      )}

      <h2>Ce que fournit le service</h2>
      <p>
        {photo
          ? "Un rapport calculé à partir des valeurs que vous déclarez (questionnaire) ou estimées à partir de votre photo par un modèle d'analyse (protocole photo : estimation visuelle, ou mesure calibrée sur une carte de référence). Les valeurs déclarées ne sont pas vérifiées ; "
          : "Un rapport calculé à partir des valeurs que vous déclarez. Ces valeurs ne sont pas vérifiées ; "}
        les résultats sont des estimations statistiques, pas un avis médical (voir <Link href="/methode" className="underline">Précision et méthode</Link>).
        Le service est réservé aux personnes de 18 ans ou plus{photo ? " ; l'envoi d'une photo exige en plus une vérification d'âge par un prestataire tiers et votre consentement explicite, et la photo est envoyée au prestataire d'analyse décrit dans la politique de confidentialité" : ""}.
      </p>

      <h2>Aucune garantie de conservation</h2>
      <p>
        Pendant la bêta, nous ne garantissons ni la disponibilité du service ni la conservation des rapports gratuits. Un rapport gratuit est
        effacé automatiquement au plus tard {BETA.reportTtlDays} jours après sa création, et peut l&apos;être plus tôt (panne,
        arrêt ou évolution du service). Téléchargez votre rapport en PDF si vous souhaitez le garder. Vous pouvez aussi le
        supprimer à tout moment ; la suppression est définitive.
      </p>

      <h2>Votre usage</h2>
      <ul>
        <li>Vous déclarez avoir 18 ans ou plus et saisir vos propres valeurs{photo ? ", et n'envoyer qu'une photo de vous-même, sans visage ni autre personne" : ""}.</li>
        <li>Vous n&apos;utilisez pas le service pour tromper, harceler ou nuire à autrui, et vous ne cherchez pas à en perturber le fonctionnement.</li>
        <li>Le lien privé de votre rapport est le seul moyen d&apos;y accéder : conservez-le, ne le partagez qu&apos;à bon escient.</li>
      </ul>

      {!paid && (
        <>
          <h2>Passage à une version payante</h2>
          <p>
            Une version payante pourra être proposée plus tard, avec ses propres conditions de vente. Aucun paiement ne vous sera
            jamais demandé sans que ces conditions vous soient présentées avant.
          </p>
        </>
      )}

      <h2>Responsabilité et droit applicable</h2>
      <p>
        Le service est fourni « en l&apos;état »{paid ? "" : ", gratuitement"}. Ces conditions sont régies par le droit anglais ; si vous êtes
        consommateur, cela ne vous prive pas de la protection que vous accordent les dispositions impératives de la loi du pays où
        vous résidez habituellement. Elles sont à faire relire par un juriste avant l&apos;ouverture au public.
      </p>
    </Doc>
  );
}
