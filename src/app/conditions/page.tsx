import Link from "next/link";
import { notFound } from "next/navigation";
import { Doc } from "@/components/Doc";
import { BETA, isFreeBeta } from "@/lib/mode";

export const metadata = { title: "Conditions d'utilisation (bêta)" };

// Remplace les CGV pendant la bêta gratuite (les CGV restent prêtes pour la version payante : /cgv).
export default function Page() {
  if (!isFreeBeta()) notFound();
  return (
    <Doc title="Conditions d'utilisation de la bêta" draft>
      <h2>Service en bêta, gratuit</h2>
      <p>
        Bitomètre est en phase de test (« bêta »). Le questionnaire et le rapport qui en découle sont gratuits : aucun paiement
        n&apos;est demandé et aucune donnée de paiement n&apos;est collectée. L&apos;éditeur est identifié dans les{" "}
        <Link href="/mentions-legales" className="underline">mentions légales</Link>.
      </p>

      <h2>Ce que fournit le service</h2>
      <p>
        Un rapport calculé à partir des valeurs que vous déclarez. Ces valeurs ne sont pas vérifiées ; les résultats sont des
        estimations statistiques, pas un avis médical (voir <Link href="/methode" className="underline">Précision et méthode</Link>).
        Le service est réservé aux personnes de 18 ans ou plus.
      </p>

      <h2>Aucune garantie de conservation</h2>
      <p>
        Pendant la bêta, nous ne garantissons ni la disponibilité du service ni la conservation des rapports. Un rapport est
        effacé automatiquement au plus tard {BETA.reportTtlDays} jours après sa création, et peut l&apos;être plus tôt (panne,
        arrêt ou évolution du service). Téléchargez votre rapport en PDF si vous souhaitez le garder. Vous pouvez aussi le
        supprimer à tout moment ; la suppression est définitive.
      </p>

      <h2>Votre usage</h2>
      <ul>
        <li>Vous déclarez avoir 18 ans ou plus et saisir vos propres valeurs.</li>
        <li>Vous n&apos;utilisez pas le service pour tromper, harceler ou nuire à autrui, et vous ne cherchez pas à en perturber le fonctionnement.</li>
        <li>Le lien privé de votre rapport est le seul moyen d&apos;y accéder : conservez-le, ne le partagez qu&apos;à bon escient.</li>
      </ul>

      <h2>Passage à une version payante</h2>
      <p>
        Une version payante pourra être proposée plus tard, avec ses propres conditions de vente. Aucun paiement ne vous sera
        jamais demandé sans que ces conditions vous soient présentées avant.
      </p>

      <h2>Responsabilité et droit applicable</h2>
      <p>
        Le service est fourni « en l&apos;état », gratuitement. Ces conditions sont régies par le droit anglais ; si vous êtes
        consommateur, cela ne vous prive pas de la protection que vous accordent les dispositions impératives de la loi du pays où
        vous résidez habituellement. Elles sont à faire relire par un juriste avant l&apos;ouverture au public.
      </p>
    </Doc>
  );
}
