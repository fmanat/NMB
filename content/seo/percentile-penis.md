---
slug: percentile-penis
title: Percentile pénis : tableau de 10 à 20 cm et calcul
h1: Percentile du pénis : définition, calcul et tableau complet
breadcrumb: Percentile du pénis
metaDescription: Percentile du pénis : ce que c'est, comment il se calcule, et le tableau des percentiles de 10 à 20 cm (longueur) et de 9 à 15 cm (circonférence).
targetKeyword: percentile pénis
verified: 2026-10-03
ogFigure: "{{quantile:erect-length:50}}"
ogLabel: 50e percentile de la longueur en érection (Veale et al., BJU Int., 2015)
faq:
  - q: Qu'est-ce qu'un percentile ?
    a: C'est la part d'une population de référence dont la valeur est inférieure à la vôtre. Au 70e percentile, environ 70 % des hommes de la population de référence mesurent moins.
  - q: Un percentile est-il une note ?
    a: Non. Il décrit un rang dans un groupe de comparaison, sans jugement. Le site affiche aussi un score sur 100, volontairement indulgent, qui n'est jamais présenté comme un percentile.
  - q: Comment le site calcule-t-il le percentile ?
    a: Par une loi normale, à partir de la moyenne et de l'écart-type publiés par Veale et al. (2015) pour l'état indiqué (repos ou érection). Le calcul est fait dans le code du site, avec les mêmes fonctions pour le rapport, le calculateur et les pages de contenu.
  - q: Pourquoi le percentile est-il borné à {{borne-haute}} ?
    a: Aux extrémités, une loi normale devient une extrapolation. Le rapport affiche donc les percentiles entre {{borne-basse}} et {{borne-haute}}, et le questionnaire écarte les valeurs situées à plus de {{max-sigma}} écarts-types de la moyenne.
  - q: Le percentile change-t-il selon la source ?
    a: Oui, de quelques points. Des synthèses plus récentes rapportent des moyennes en érection plus élevées que Veale et al. ; avec ces références, une même mesure aurait un rang légèrement plus bas. Un percentile est une estimation de position.
sources:
  - title: Veale et al. (2015), Am I normal? A systematic review and construction of nomograms for flaccid and erect penis length and circumference in up to 15,521 men, BJU International
    url: https://pubmed.ncbi.nlm.nih.gov/25487360/
  - title: Mostafaei et al. (2025), A Systematic Review and Meta-Analysis of Penis Length and Circumference According to WHO Regions, Urology Research and Practice
    url: https://pmc.ncbi.nlm.nih.gov/articles/PMC11923605/
---
Un percentile répond à une question simple : parmi les hommes d'une population de référence, quelle part mesure moins que vous ? C'est l'information principale du rapport du site, plus parlante qu'une moyenne isolée. Cette page explique ce qu'est un percentile, comment le site le calcule, puis donne le tableau complet, centimètre par centimètre, pour la longueur et la circonférence en érection.

## Ce qu'est un percentile

Rangez par ordre croissant les mesures d'un grand groupe d'hommes. Le 25e percentile est la valeur sous laquelle se trouve le premier quart du groupe, le 50e percentile (la médiane) celle qui le partage en deux moitiés, le 90e celle sous laquelle se trouvent neuf hommes sur dix.

Inversement, à partir d'une mesure, on peut dire à quel percentile elle correspond. Selon les références utilisées par le site, une longueur en érection de 14 cm correspond au {{rang:erect-length:14}} : environ {{pct:erect-length:14}} des hommes de la population de référence mesurent moins.

Trois précisions évitent les contresens :

- **Un percentile n'est pas un pourcentage de réussite.** Le 50e percentile n'est pas « la moitié de la note » : c'est exactement le milieu de la population.
- **Un percentile dépend du groupe de comparaison.** Il n'a de sens qu'avec sa référence, ici les hommes mesurés par les études retenues par Veale et al. (2015).
- **Un percentile ne juge rien.** Il ne dit rien de la santé, de la fonction ou de la valeur de quiconque. Il décrit un rang, et rien d'autre.

## Comment le site le calcule

Le site ne dispose pas de la liste des mesures individuelles des études : les synthèses publient des moyennes et des écarts-types. Il fait donc comme les auteurs de la revue de référence, qui ont simulé 20 000 observations à partir d'une loi normale pour tracer leurs courbes : il suppose que les mesures suivent une loi normale de même moyenne et de même écart-type, puis calcule la part de cette loi située sous votre valeur.

Les paramètres sont ceux publiés par Veale et al. (2015) :

| Mesure | Moyenne | Écart-type | Hommes mesurés |
|---|---|---|---|
| Longueur en érection | {{moyenne:erect-length}} | {{ecart-type:erect-length}} | {{effectif:erect-length}} |
| Circonférence en érection | {{moyenne:erect-girth}} | {{ecart-type:erect-girth}} | {{effectif:erect-girth}} |
| Longueur au repos | {{moyenne:rest-length}} | {{ecart-type:rest-length}} | {{effectif:rest-length}} |
| Circonférence au repos | {{moyenne:rest-girth}} | {{ecart-type:rest-girth}} | {{effectif:rest-girth}} |

Concrètement, le calcul mesure la distance entre votre valeur et la moyenne, l'exprime en écarts-types, puis lit la part de la courbe en cloche située à gauche de ce point. À la moyenne exacte, le percentile vaut 50. À un écart-type au-dessus, il vaut environ {{pct-sigma:1}} ; à deux écarts-types, environ {{pct-sigma:2}}.

Deux règles de prudence complètent le calcul. Le percentile est affiché avec une décimale et borné entre {{borne-basse}} et {{borne-haute}}, parce qu'aux extrémités la loi normale devient une extrapolation. Et le questionnaire écarte les valeurs situées à plus de {{max-sigma}} écarts-types de la moyenne. Le rang en toutes lettres (« 70e percentile ») retient la partie entière, jamais arrondie à la hausse.

## Tableau des percentiles

Les tableaux ci-dessous sont calculés par le site, avec les mêmes fonctions que le rapport. Chaque ligne, en longueur comme en circonférence, renvoie vers une page qui détaille la position correspondante.

[[tableau-percentiles]]

Lecture : la colonne « sur 1 000 hommes » donne le nombre d'hommes de la population de référence, sur 1 000, dont la mesure est inférieure à la valeur de la ligne.

## La distribution en image

Les courbes suivantes montrent la répartition de la longueur et de la circonférence en érection selon la loi normale du site. La zone foncée rassemble les hommes situés entre le 10e et le 90e percentile.

[[distribution]]

## Les limites d'un percentile

Un percentile n'est jamais plus précis que la mesure qu'on lui donne et que la référence qu'il utilise.

**La mesure.** Autour de la médiane, la courbe est dense : un demi-centimètre de plus ou de moins peut déplacer le rang de plusieurs points. À 13 cm, le site calcule le {{rang:erect-length:13}} ; à 13,5 cm, le {{rang:erect-length:13.5}}. Une mesure soigneuse, en érection complète, règle appuyée jusqu'à l'os pubien, compte autant que le calcul.

**La référence.** Les moyennes publiées varient d'une synthèse à l'autre. La méta-analyse de Mostafaei et al. (2025), qui regroupe 33 études, rapporte par exemple une moyenne en érection de 13,84 cm, supérieure à celle de Veale et al. Avec cette référence, chaque mesure aurait un rang un peu plus bas. Le site a retenu Veale et al. pour ses critères de sélection stricts : mesures prises par des professionnels de santé, procédure standard, exclusion des situations particulières.

**L'état.** Une mesure au repos se compare aux références au repos, une mesure en érection aux références en érection. Mélanger les deux fausse le rang.

## Trouver votre percentile

Saisissez une longueur et une circonférence : le rang s'affiche aussitôt, calculé sur votre appareil. Pour un document complet, avec la courbure et des repères de taille, passez par [le questionnaire](/analyse).

[[calculateur]]

Deux lectures complémentaires : [quelle est la taille normale ?](/taille-penis-normale), qui replace le percentile dans l'éventail des tailles habituelles, et [la taille moyenne](/taille-moyenne-penis), qui traite aussi de l'absence de moyenne française.
