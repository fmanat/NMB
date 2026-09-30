---
slug: faq
title: Bitomètre : questions fréquentes sur le service
metaDescription: Comment fonctionne Bitomètre ? Méthode, précision des estimations, confidentialité de la photo, paiement et défi entre amis : les réponses à vos questions.
targetKeyword: Bitomètre fonctionnement
faq:
  - q: Comment fonctionne Bitomètre ?
    a: Vous choisissez un protocole, vous fournissez vos mesures ou une photo, et le site calcule un rapport chiffré : percentiles, marges d’erreur pour les protocoles photo, score sur 100. Le rapport est d’abord verrouillé ; il s’ouvre après le paiement. Aucun compte n’est nécessaire.
  - q: Quelle est la différence entre les trois protocoles ?
    a: Le protocole A est un questionnaire : il utilise uniquement les mesures que vous déclarez, sans photo, et ces valeurs ne sont pas vérifiées. Le protocole B estime vos mesures à partir d’une photo prise avec une carte bancaire à côté. Le protocole C ajoute vos mesures déclarées et les compare aux mesures estimées.
  - q: Comment les mesures sont-elles estimées à partir d’une photo ?
    a: Un modèle d’intelligence artificielle repère des points sur l’image (coins de la carte, base et extrémité, ligne médiane, bords). Il ne donne aucune mesure : ce sont les calculs du site qui en déduisent les dimensions, en prenant la carte bancaire (85,60 × 53,98 mm) comme référence d’échelle.
  - q: Quelle est la précision de l’analyse ?
    a: Les mesures issues d’une photo sont des estimations, affichées avec une marge d’erreur jamais inférieure à ± 10 %. Cette marge n’a pas encore été validée sur un grand nombre de photos de référence. Les valeurs du questionnaire, elles, ne sont pas vérifiées.
  - q: Comment sont calculés les percentiles et le score ?
    a: Chaque mesure est comparée aux distributions de la revue systématique de Veale et al. (2015), selon l’état choisi (repos ou érection). Le score sur 100 est une note de présentation volontairement indulgente ; ce n’est pas un percentile. La formule est publiée sur la page Précision et méthode.
  - q: Ma photo est-elle stockée ?
    a: Bitomètre ne la stocke jamais : elle est réduite et débarrassée de ses métadonnées dans votre navigateur, traitée en mémoire, puis abandonnée. Elle est toutefois envoyée au prestataire d’analyse, SpaceXAI LLC (connue sous le nom xAI, États-Unis), qui conserve les requêtes 30 jours pour détecter les abus, sans les utiliser pour l’entraînement selon sa documentation. Le site ne peut pas effacer ces copies avant ce délai.
  - q: Que conserve Bitomètre sur moi ?
    a: Aucun compte, aucun e-mail. Le site conserve votre rapport (formule, résultats, commentaire, statut de paiement, date). Votre adresse IP n’est conservée que sous forme hachée, pour limiter le nombre d’analyses, et effacée après 24 heures. Les rapports non payés sont effacés après 24 heures. Des statistiques anonymes (formule, date, montant, score) restent conservées sans lien avec votre rapport.
  - q: Pourquoi ma photo a-t-elle été refusée ?
    a: L’analyse est refusée lorsque la photo ne permet pas un repérage fiable ou ne respecte pas les consignes (carte de référence absente ou illisible, visage visible, image non conforme). Le message est volontairement le même dans tous les cas. Aucun paiement n’est demandé et vous pouvez reprendre la photo.
  - q: Comment se passe le paiement ?
    a: Le paiement est unique, en euros, sans abonnement. Le prix de chaque protocole est affiché avant le paiement. Avant de payer, vous cochez une case pour demander l’accès immédiat à votre rapport et renoncer à votre droit de rétractation. Le rapport ne s’ouvre qu’après confirmation du paiement par le prestataire de paiement.
  - q: Comment retrouver ou supprimer mon rapport ?
    a: Sans compte, le lien de votre rapport est le seul moyen de le retrouver : enregistrez-le dans vos favoris. Ce lien est long et aléatoire, et la page n’est pas indexée par les moteurs de recherche. Le bouton « Supprimer mon rapport » l’efface définitivement.
  - q: Comment fonctionne le défi entre amis ?
    a: Depuis votre rapport débloqué, vous créez un lien de défi. Votre ami suit le parcours complet de son protocole et paie son propre rapport. La comparaison, faite de scores et de percentiles sans aucune image, n’apparaît qu’une fois les deux rapports débloqués, et seulement sur les pages privées des deux participants. Chacun peut retirer son rapport de la comparaison à tout moment.
  - q: Que montre la carte de partage ?
    a: Par défaut, le score seul. Vous pouvez ajouter un ou deux percentiles, ou une mesure de référence comme la tour Eiffel. La carte ne contient aucune image de vous et indique « valeurs déclarées » pour le questionnaire. Supprimer votre rapport supprime aussi ses cartes.
  - q: Bitomètre remplace-t-il un avis médical ?
    a: Non. C’est un service statistique. Si la courbure estimée atteint 30° ou plus, le rapport suggère un avis médical ; une courbure nouvelle, douloureuse ou qui évolue relève toujours d’une consultation.
sources:
  - title: Veale et al. — Am I normal? A systematic review and construction of nomograms for flaccid and erect penis length and circumference in up to 15,521 men
    url: https://pubmed.ncbi.nlm.nih.gov/25487360/
  - title: FAQ - API Security | SpaceXAI Docs
    url: https://docs.x.ai/developers/faq/security
---
Bitomètre est un service d'analyse chiffrée : il situe des mesures par rapport à des données scientifiques publiées. Cette page décrit ce que le site fait, et seulement cela.

## Le parcours, étape par étape

1. Vous choisissez un protocole : questionnaire, photo, ou photo accompagnée de mesures déclarées. Avant d'envoyer une photo, vous indiquez votre année de naissance, vous cochez trois cases de confirmation et une vérification d'âge est réalisée par un prestataire tiers, qui ne transmet au site qu'une réponse « majeur : oui », valable 30 minutes.
2. Pour une photo, vous posez une carte au format bancaire à côté du sujet, côté verso visible. La photo est réduite et nettoyée de ses métadonnées dans votre navigateur avant l'envoi.
3. L'analyse dure en général de 20 à 60 secondes. L'écran affiche uniquement les étapes réellement exécutées : contrôle de recevabilité et extraction de la ligne médiane, calibration sur la carte de référence, calcul des percentiles.
4. Vous voyez d'abord un aperçu : pour les protocoles photo, l'indice de confiance et la symétrie. Le reste du rapport est verrouillé jusqu'au paiement.
5. Après le paiement, le rapport complet s'affiche à une adresse privée.

Le nombre d'analyses est limité à 5 par période de 24 heures.

## Précision : ce qu'il faut savoir avant de se fier à un chiffre

Une mesure estimée à partir d'une photo dépend de la qualité de l'image, de la perspective et d'une hypothèse : la circonférence est déduite de la largeur en supposant une section circulaire. C'est pourquoi chaque mesure est affichée avec une marge d'erreur, qui n'est jamais inférieure à ± 10 %.

Cette marge reste à valider sur un grand nombre de photos de référence. En attendant, il faut la lire comme une hypothèse prudente, pas comme une garantie.

Avec le protocole photo et mesures, le rapport compare vos mesures déclarées aux mesures estimées. Au-delà de 20 % d'écart, il affiche « Écart important : vérifiez votre méthode de mesure ».

Les percentiles sont calculés à partir des références publiées par Veale et al. en 2015. Ce sont des références internationales, pas des moyennes françaises. Pour comprendre la méthode de mesure, consultez [comment mesurer son pénis](/comment-mesurer-son-penis) ; pour les données disponibles, [les études sur la taille du pénis](/etudes-taille-penis).

## Confidentialité : où va la photo

Bitomètre ne stocke jamais votre photo : elle reste en mémoire le temps de l'analyse. Elle est cependant transmise à SpaceXAI LLC (connue sous le nom xAI), société américaine qui réalise l'analyse d'image. D'après la documentation du prestataire, les requêtes envoyées à son interface sont conservées 30 jours pour détecter les abus, puis supprimées, et ne servent pas à entraîner ses modèles. Bitomètre ne peut pas effacer ces copies avant ce délai, et vous y consentez explicitement avant l'envoi.

Le site ne demande ni compte ni adresse e-mail. Le détail figure dans la [politique de confidentialité](/confidentialite).

## Paiement et rapport

Le paiement est unique et sans abonnement. Il n'ouvre votre rapport que lorsque le prestataire de paiement en confirme la réussite ; un simple retour sur la page du site ne suffit pas. Les conditions figurent dans les [conditions générales de vente](/cgv).

Sans compte, l'adresse de votre rapport est le seul moyen de le retrouver. Enregistrez-la dans vos favoris. Vous pouvez supprimer votre rapport à tout moment ; la suppression est définitive.

## Partage et défi

Une carte de partage ne montre que ce que vous choisissez, jamais une image de vous. Un défi entre amis compare uniquement des scores et des percentiles, et chaque participant peut se retirer de la comparaison à tout moment.

## Ce que Bitomètre n'est pas

Ce n'est pas un avis médical et ce n'est pas un diagnostic. Le score sur 100 est une note de présentation volontairement indulgente, qui ne doit pas être lue comme un classement. Pour situer une mesure dans la population, seuls les percentiles font foi. Vous pouvez lire la [page de méthode](/methode) ou lancer [votre analyse](/analyse).
