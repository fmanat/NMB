import { Doc } from "@/components/Doc";

export const metadata = { title: "Politique de confidentialité" };

export default function Page() {
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
