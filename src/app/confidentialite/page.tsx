import { Doc } from "@/components/Doc";
import { COMPANY, HOST } from "@/config/company";
import { BETA, isFreeBeta } from "@/lib/mode";

export const metadata = { title: "Politique de confidentialité" };

export default function Page() {
  if (isFreeBeta()) return <BetaPolicy />;
  return (
    <Doc title="Politique de confidentialité" draft>
      <h2>Données que nous conservons</h2>
      <p>
        Identifiant du rapport, formule, résultats chiffrés, commentaire, statut de paiement et date. Aucun e-mail, aucun
        compte, aucune donnée d&apos;identité.
      </p>

      <h2>Votre photo (formules avec photo)</h2>
      <p>
        Bitomètre ne stocke jamais votre photo : elle est traitée en mémoire, pendant l&apos;analyse, puis abandonnée.
        Elle n&apos;est écrite ni dans notre base de données, ni dans nos fichiers, ni dans nos journaux. Les données
        d&apos;image sont des données sensibles (RGPD, art. 9) : nous ne les traitons qu&apos;avec votre consentement
        explicite, donné avant l&apos;envoi.
      </p>

      <h2>Prestataire d&apos;analyse (SpaceXAI LLC (connue sous le nom xAI), États-Unis)</h2>
      <p>
        L&apos;analyse de la photo est réalisée par l&apos;interface de programmation (API) de SpaceXAI LLC (connue sous le nom
        xAI, anciennement X.AI Corp.), société du Nevada dont le siège social est situé 800 W Cesar Chavez St., Austin, Texas
        78701, États-Unis. Pour détecter les abus, xAI conserve les requêtes envoyées à son API, images comprises, pendant 30
        jours, puis les supprime automatiquement. Selon sa documentation, xAI ne les utilise pas pour entraîner ses
        modèles sans autorisation explicite. Notre site ne peut pas effacer ces copies avant ce délai.
      </p>

      <h2>Transfert de données hors de l&apos;Union européenne</h2>
      <p>
        L&apos;envoi de votre photo à xAI constitue un transfert de données personnelles vers un pays situé hors de
        l&apos;Union européenne. Il n&apos;a lieu qu&apos;avec votre consentement explicite, recueilli avant
        l&apos;envoi, après l&apos;information ci-dessus. Garanties applicables au transfert (décision d&apos;adéquation
        ou clauses contractuelles types) : ________ (à confirmer avant publication).
      </p>

      <h2>Accord de traitement des données</h2>
      <p>
        Accord de traitement des données (RGPD, art. 28) conclu avec SpaceXAI LLC (xAI) : ________ (à signer et référencer avant
        publication). Liste des autres prestataires ayant accès à des données : hébergeur ________, prestataire de
        paiement ________, prestataire de vérification d&apos;âge ________.
      </p>

      <h2>Statistiques anonymes et paiements</h2>
      <p>
        Pour mesurer l&apos;activité du service, Bitomètre conserve un journal anonyme : pour chaque rapport créé, la formule,
        la date, le score et la date de paiement éventuelle. Ce journal ne contient ni l&apos;adresse de votre rapport, ni
        adresse IP, ni aucune donnée d&apos;identité ; il n&apos;est pas effacé quand vous supprimez votre rapport, et il ne
        permet pas de le retrouver. Les paiements (montant, date, référence du prestataire de paiement) sont conservés pendant la
        durée exigée par les obligations comptables, sans lien avec le contenu de votre rapport. Des agrégats quotidiens anonymes
        (nombre d&apos;analyses, score moyen, répartition) peuvent être transmis à un outil de publication ; aucun groupe de moins
        de 5 rapports n&apos;y est détaillé.
      </p>

      <h2>Adresse IP</h2>
      <p>Hachée, utilisée uniquement pour limiter le nombre d&apos;analyses, effacée après 24 heures.</p>

      <h2>Mesure d&apos;audience</h2>
      <p>Sans cookie, hébergée dans l&apos;Union européenne. Aucun pixel publicitaire.</p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez supprimer votre rapport à tout moment depuis sa page. Vous pouvez retirer votre consentement ; cela ne
        permet pas d&apos;effacer avant 30 jours les copies conservées par xAI. Contact : ________.
      </p>
    </Doc>
  );
}

// Version limitée à ce que fait la bêta gratuite : questionnaire déclaratif, aucune photo, aucun envoi à un prestataire d'analyse.
function BetaPolicy() {
  return (
    <Doc title="Politique de confidentialité (bêta)" draft>
      <p>
        Responsable du traitement : {COMPANY.legalName}, société de droit anglais (voir les mentions légales). Pendant la bêta, le
        service ne demande aucune photo, aucun compte, aucun e-mail et aucune donnée de paiement.
      </p>

      <h2>Données que nous conservons</h2>
      <p>
        Les mesures et réponses que vous déclarez (état, longueur, circonférence, courbure), le rapport calculé (score, percentiles,
        commentaire), la date de création et l&apos;identifiant aléatoire du rapport. Ces données sont des données de santé ou
        relatives à la vie sexuelle (RGPD, art. 9) : elles ne sont traitées qu&apos;avec votre consentement explicite, que vous
        donnez en cochant la case prévue avant de soumettre le questionnaire. Le rapport est effacé automatiquement au plus tard {BETA.reportTtlDays} jours après sa création, ou
        immédiatement si vous le supprimez depuis sa page.
      </p>

      <h2>Adresse IP</h2>
      <p>Hachée (empreinte non réversible), utilisée uniquement pour limiter le nombre d&apos;analyses, effacée après 24 heures.</p>

      <h2>Statistiques anonymes</h2>
      <p>
        Nous conservons un journal anonyme : pour chaque rapport créé, la date, la formule et le score. Il ne contient ni
        l&apos;adresse de votre rapport, ni adresse IP, ni donnée d&apos;identité ; il n&apos;est pas effacé quand vous supprimez votre
        rapport et ne permet pas de le retrouver. Des agrégats quotidiens anonymes peuvent être transmis à un outil interne ; aucun
        groupe de moins de 5 rapports n&apos;y est détaillé.
      </p>

      <h2>Mesure d&apos;audience</h2>
      <p>Sans cookie et sans adresse IP. Aucun pixel publicitaire, aucun outil tiers de suivi.</p>

      <h2>Aucun envoi à un prestataire d&apos;analyse</h2>
      <p>
        Pendant la bêta, vos données ne sont envoyées à aucun service d&apos;analyse ou d&apos;intelligence artificielle : le rapport est
        calculé par notre propre programme.
      </p>

      <h2>Hébergement</h2>
      <p>
        {HOST.legalName}, dans la région : {HOST.dataRegion}. L&apos;hébergeur traite les données pour notre compte ; il peut
        faire intervenir du personnel situé hors de l&apos;Union européenne pour l&apos;exploitation de la plateforme (garanties à confirmer
        avant l&apos;ouverture au public).
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez supprimer votre rapport à tout moment depuis sa page, et demander l&apos;accès, la rectification ou l&apos;effacement
        de vos données en nous écrivant : {COMPANY.contactEmail}. Autorité de contrôle : Information Commissioner&apos;s Office (ICO,
        Royaume-Uni) ; si vous résidez dans l&apos;Union européenne, vous pouvez aussi saisir l&apos;autorité de votre pays (en France, la CNIL).
        Numéro d&apos;enregistrement ICO : {COMPANY.icoNumber}.
      </p>
    </Doc>
  );
}
