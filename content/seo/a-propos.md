---
slug: a-propos
title: À propos de Bitomètre : méthode, sources et limites
h1: À propos de Bitomètre
breadcrumb: À propos
metaDescription: Ce qu'est Bitomètre, comment les chiffres sont calculés, quelles sources sont utilisées, comment les pages sont mises à jour, et les limites du service.
targetKeyword: Bitomètre
verified: 2026-10-03
ogFigure: "{{effectif-total}}"
ogLabel: hommes mesurés dans la synthèse de référence (Veale et al., BJU Int., 2015)
faq:
  - q: Qui écrit les pages de Bitomètre ?
    a: La rédaction de Bitomètre. Chaque page est signée « Rédaction Bitomètre », porte une date de vérification et la liste de ses références.
  - q: Bitomètre donne-t-il des conseils médicaux ?
    a: Non. Le site calcule des positions statistiques à partir de références publiées. Il ne pose aucun diagnostic. En cas de gêne, de douleur ou de question médicale, un professionnel de santé est le bon interlocuteur.
  - q: Les chiffres des pages sont-ils écrits à la main ?
    a: Non. Les moyennes, percentiles et proportions affichés sont calculés par le code du site à partir des références, avec les mêmes fonctions que le rapport. Une erreur de calcul se corrigerait donc partout à la fois.
  - q: Comment signaler une erreur ?
    a: Par la page Contact et signalement. Un signalement sur un chiffre ou une source conduit à revérifier la page concernée, corrigée et redatée si nécessaire.
sources:
  - title: Veale et al. (2015), Am I normal? A systematic review and construction of nomograms for flaccid and erect penis length and circumference in up to 15,521 men, BJU International
    url: https://pubmed.ncbi.nlm.nih.gov/25487360/
---
Bitomètre est un site français qui situe des mesures du pénis dans une population de référence. Il calcule des percentiles, des courbes de distribution et des repères à partir d'études scientifiques publiées, et présente le tout avec le sérieux d'un rapport de laboratoire. Cette page décrit ce que fait le service, la méthode, les sources, la façon dont les pages sont tenues à jour, et ce que le site ne prétend pas faire.

## Ce que fait Bitomètre

Le service principal est [un questionnaire](/analyse) : vous indiquez votre longueur et votre circonférence, au repos ou en érection, ainsi qu'une courbure approximative. Le site calcule votre position dans la population de référence et produit un rapport chiffré : percentiles, courbes, repères de taille, et une note de présentation sur 100. Il n'y a ni compte ni adresse e-mail : le rapport s'ouvre par un lien privé.

Les pages de contenu du site, comme celle-ci, répondent aux questions les plus fréquentes : moyennes, ce que « normal » veut dire, mesure, courbure, études. Elles sont accessibles à tous, sans inscription.

## La méthode

Toutes les positions affichées reposent sur la même méthode, décrite en détail sur la page [Précision et méthode](/methode).

- **Références.** Moyennes et écarts-types publiés par Veale et al. dans le *BJU International* en 2015, une revue systématique qui n'a retenu que des mesures prises par des professionnels de santé selon une procédure standard, sur des échantillons d'au moins 50 hommes, pour un total allant jusqu'à {{effectif-total}} hommes.
- **Calcul.** Les mesures sont supposées suivre une loi normale de même moyenne et de même écart-type ; le percentile est la part de cette loi située sous la valeur. En érection, la longueur moyenne de référence est de {{moyenne:erect-length}} (écart-type {{ecart-type:erect-length}}) et la circonférence moyenne de {{moyenne:erect-girth}} (écart-type {{ecart-type:erect-girth}}).
- **Garde-fous.** Aux extrémités de la courbe, le site préfère se taire plutôt qu'inventer une précision : affichage limité à l'intervalle {{borne-basse}}–{{borne-haute}}, refus des valeurs éloignées de plus de {{max-sigma}} écarts-types, et rang toujours arrondi vers le bas.
- **Score.** La note sur 100 est volontairement indulgente et n'est jamais présentée comme un percentile. Sa formule est publique.

Le [tableau des percentiles](/percentile-penis) montre le résultat de ces calculs, centimètre par centimètre.

## Les sources

Le site cite ses sources sur chaque page, dans une liste « Références » placée en bas. Il privilégie :

- les revues systématiques et méta-analyses publiées dans des revues à comité de lecture ;
- les études où la mesure est prise par un professionnel de santé, plutôt que déclarée ;
- les recommandations des sociétés savantes d'urologie pour les questions de mesure et de courbure.

Chaque chiffre tiré d'une source est vérifié sur la source elle-même avant publication. Les chiffres issus de sondages déclaratifs ou de classements sans méthode publiée ne sont pas repris comme références ; lorsqu'ils sont évoqués, c'est pour expliquer leurs limites, comme sur la page [taille du pénis par pays](/taille-penis-par-pays).

## La mise à jour des pages

Chaque page porte une date de vérification sous son titre. Cette date change lorsque le contenu est relu, que ses sources sont contrôlées ou qu'une correction est apportée.

Aucune statistique n'est saisie à la main dans les textes : chaque valeur est produite au moment de la construction du site, par le code qui sert aussi au rapport. Une référence mise à jour se répercute donc d'un coup sur toutes les pages.

Une erreur peut être signalée par la page [Contact et signalement](/contact). Un signalement portant sur un chiffre ou une source conduit à revérifier la page ; si une correction est nécessaire, la page est redatée.

## Les limites du service

Le site s'efforce d'être exact sur ce qu'il fait et clair sur ce qu'il ne fait pas.

- **Des estimations statistiques, pas un diagnostic.** Le site situe une mesure parmi d'autres ; il ne se prononce ni sur la santé ni sur la sexualité de personne, et ne donne aucun avis médical.
- **Une référence parmi d'autres.** D'autres synthèses rapportent des moyennes différentes de celles de Veale et al. ; avec elles, les rangs changeraient de quelques points. La page [ce que disent les études](/etudes-taille-penis) les compare.
- **Des mesures déclarées.** Avec le questionnaire, le site calcule à partir des valeurs saisies, sans pouvoir les vérifier. Une mesure prise sans méthode donne un rang sans signification ; le guide [comment mesurer son pénis](/comment-mesurer-son-penis) explique la méthode de comparaison.
- **Les extrémités de la courbe.** La loi normale décrit bien le centre de la distribution ; aux extrémités, elle devient une extrapolation, d'où les bornes appliquées.

## Confidentialité

Aucune inscription : ni nom, ni e-mail, ni mot de passe. Ce que le site conserve, et pour combien de temps, est décrit dans la [politique de confidentialité](/confidentialite). Les mentions obligatoires sont sur la page [mentions légales](/mentions-legales).
