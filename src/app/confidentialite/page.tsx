import { Doc } from "@/components/Doc";
import { COMPANY, HOST } from "@/config/company";
import { BETA, isFreeBeta, isPhotoBeta } from "@/lib/mode";

export const metadata = { title: "Politique de confidentialité", alternates: { canonical: "/confidentialite" } };

export default function Page() {
  if (isFreeBeta()) return <BetaPolicy />;
  return (
    <Doc title="Politique de confidentialité">
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
        de 5 rapports n&apos;y est détaillé. Lorsqu&apos;une photo comporte une carte de référence exploitable, nous conservons aussi, pour
        vérifier la justesse des estimations du modèle, quatre nombres : la longueur et la circonférence mesurées sur la carte et celles
        estimées par le modèle sans la carte. Rien d&apos;autre (ni date, ni rapport, ni identifiant) n&apos;y est associé.
      </p>

      <h2>Adresse IP</h2>
      <p>Hachée, utilisée uniquement pour limiter le nombre d&apos;analyses, effacée après 24 heures.</p>

      <h2>Cookies</h2>
      <p>
        Aucun cookie de suivi, de publicité ou de mesure d&apos;audience. Seuls des cookies fonctionnels peuvent être posés, illisibles par
        les scripts de la page : « défi » (24 heures) lorsque vous relevez le défi d&apos;un ami ; « âge » (30 minutes, sans donnée
        d&apos;identité) après la vérification d&apos;âge d&apos;une formule avec photo ; « paiement » (2 heures) pour vous ramener à votre rapport
        après la page du prestataire de paiement. L&apos;administration du site utilise en plus un cookie de session réservé à ses administrateurs.
      </p>

      <h2>Mesure d&apos;audience</h2>
      <p>
        Sans cookie, hébergée dans l&apos;Union européenne. Nous comptons, de façon anonyme, quelques étapes du parcours : visite de l&apos;accueil, début du questionnaire, questionnaire terminé, rapport affiché, carte de partage créée, défi créé ou relevé, aperçu verrouillé et paiement. Chaque événement n&apos;est qu&apos;une ligne « type d&apos;événement + date » : aucun cookie, aucune adresse IP, aucun identifiant, aucun lien avec un rapport ou un appareil. Ces comptages servent à améliorer le service ; ils ne permettent pas de vous reconnaître. Nous ne comptons pas les visiteurs dont le navigateur envoie le signal Do Not Track ou Global Privacy Control. Aucun pixel publicitaire, aucun outil tiers de suivi.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez supprimer votre rapport à tout moment depuis sa page. Vous pouvez retirer votre consentement ; cela ne
        permet pas d&apos;effacer avant 30 jours les copies conservées par xAI. Contact : ________.
      </p>
    </Doc>
  );
}

// Version limitée à ce que fait la bêta gratuite : questionnaire déclaratif, aucun envoi à un prestataire d'analyse ; en bêta photo
// (PHOTO_BETA active), les paragraphes sur la photo, le prestataire d'analyse et le transfert hors UE s'ajoutent.
function BetaPolicy() {
  const photo = isPhotoBeta();
  return (
    <Doc title="Politique de confidentialité (bêta)">
      <p>
        Responsable du traitement : l&apos;éditeur du site (contact : {COMPANY.contactEmail}). Pendant la bêta, le
        service ne demande {photo ? "aucun compte, aucun e-mail et aucune donnée de paiement ; la photo du protocole photo est facultative et n'est jamais enregistrée par le site" : "aucune photo, aucun compte, aucun e-mail et aucune donnée de paiement"}.
      </p>

      {photo && (
        <>
          <h2>Votre photo (protocole photo, en bêta)</h2>
          <p>
            Bitomètre ne stocke jamais votre photo : elle est traitée en mémoire, pendant l&apos;analyse, puis abandonnée. Elle n&apos;est écrite
            ni dans notre base de données, ni dans nos fichiers, ni dans nos journaux. Les données d&apos;image sont des données sensibles (RGPD,
            art. 9) : nous ne les traitons qu&apos;avec votre consentement explicite, donné avant l&apos;envoi. Une vérification d&apos;âge par un
            prestataire tiers précède l&apos;envoi ; le site n&apos;en reçoit qu&apos;une réponse « majeur : oui », sans donnée d&apos;identité, valable 30 minutes.
          </p>
          <h2>Prestataire d&apos;analyse (SpaceXAI LLC (connue sous le nom xAI), États-Unis)</h2>
          <p>
            L&apos;analyse de la photo est réalisée par l&apos;interface de programmation (API) de SpaceXAI LLC (connue sous le nom xAI, anciennement
            X.AI Corp.), société du Nevada dont le siège social est situé 800 W Cesar Chavez St., Austin, Texas 78701, États-Unis. Pour détecter les
            abus, xAI conserve les requêtes envoyées à son API, images comprises, pendant 30 jours, puis les supprime automatiquement. Selon sa
            documentation, xAI ne les utilise pas pour entraîner ses modèles sans autorisation explicite. Notre site ne peut pas effacer ces copies
            avant ce délai. Cet envoi constitue un transfert hors de l&apos;Union européenne, qui n&apos;a lieu qu&apos;avec votre consentement explicite.
            Le modèle reçoit la photo pour en estimer les dimensions et la forme (et, si une carte de référence est posée à côté, y repérer des
            points à partir desquels notre programme calcule la longueur et la circonférence), puis, sans la photo, les valeurs calculées par notre
            programme pour rédiger le rapport. Ses observations descriptives ne sont ni enregistrées ni journalisées : seul le rapport final est conservé.
          </p>
          <h2>Filtrage d&apos;images déjà répertoriées</h2>
          <p>
            Lorsqu&apos;un prestataire de comparaison d&apos;empreintes est configuré, la photo est comparée, avant analyse, à des bases d&apos;images
            déjà répertoriées ; ce contrôle ne reconnaît que des images connues et ne détermine ni l&apos;âge d&apos;une personne ni la nature
            d&apos;une image nouvelle. Tant qu&apos;aucun prestataire n&apos;est configuré, aucun filtrage n&apos;a lieu.
          </p>
        </>
      )}

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
        rapport et ne permet pas de le retrouver.{photo
          ? " Lorsqu'une photo comporte une carte de référence exploitable, nous conservons aussi, pour vérifier la justesse des estimations du modèle, quatre nombres : la longueur et la circonférence mesurées sur la carte et celles estimées par le modèle sans la carte. Rien d'autre (ni date, ni rapport, ni identifiant) n'y est associé."
          : ""} Des agrégats quotidiens anonymes peuvent être transmis à un outil interne ; aucun
        groupe de moins de 5 rapports n&apos;y est détaillé.
      </p>

      <h2>Mesure d&apos;audience</h2>
      <p>
        Nous comptons, de façon anonyme, quelques étapes du parcours : visite de l&apos;accueil, début du questionnaire, questionnaire terminé, rapport affiché, carte de partage créée, défi créé ou relevé. Chaque événement n&apos;est qu&apos;une ligne « type d&apos;événement + date » : aucun cookie, aucune adresse IP, aucun identifiant, aucun lien avec un rapport ou un appareil. Ces comptages servent à améliorer le service ; ils ne permettent pas de vous reconnaître. Nous ne comptons pas les visiteurs dont le navigateur envoie le signal Do Not Track ou Global Privacy Control. Aucun pixel publicitaire, aucun outil tiers de suivi.
      </p>

      <h2>Cookies</h2>
      <p>
        Aucun cookie de suivi, de publicité ou de mesure d&apos;audience. {photo ? "Seuls des cookies fonctionnels peuvent être posés, illisibles par les scripts de la page : « défi » (24 heures) lorsque vous relevez le défi d'un ami ; « âge » (30 minutes, sans donnée d'identité) après la vérification d'âge du protocole photo." : "Un seul cookie fonctionnel peut être posé : lorsque vous relevez le défi d'un ami, un cookie « défi » (24 heures, illisible par les scripts de la page) rattache votre rapport à ce défi. Il ne sert à rien d'autre."}{" "}
        L&apos;administration du site utilise en plus un cookie de session réservé à ses administrateurs.
      </p>

      {photo ? (
        <>
          <h2>Questionnaire : aucun envoi à un prestataire d&apos;analyse</h2>
          <p>
            Les valeurs du questionnaire ne sont envoyées à aucun service d&apos;analyse ou d&apos;intelligence artificielle : ce rapport est calculé
            par notre propre programme. Seule la photo du protocole photo est envoyée au prestataire d&apos;analyse décrit plus haut.
          </p>
        </>
      ) : (
        <>
          <h2>Aucun envoi à un prestataire d&apos;analyse</h2>
          <p>
            Pendant la bêta, vos données ne sont envoyées à aucun service d&apos;analyse ou d&apos;intelligence artificielle : le rapport est
            calculé par notre propre programme.
          </p>
        </>
      )}

      <h2>Hébergement</h2>
      <p>
        {HOST.legalName}, dans la région : {HOST.dataRegion}. L&apos;hébergeur traite les données pour notre compte ; il peut
        faire intervenir du personnel situé hors de l&apos;Union européenne pour l&apos;exploitation de la plateforme (garanties à confirmer
        avant l&apos;ouverture au public).
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez supprimer votre rapport à tout moment depuis sa page, et demander l&apos;accès, la rectification ou l&apos;effacement
        de vos données en nous écrivant : {COMPANY.contactEmail}. Si vous résidez dans l&apos;Union européenne, vous pouvez aussi saisir l&apos;autorité de protection des données de votre pays
        (en France, la CNIL).
      </p>
    </Doc>
  );
}
