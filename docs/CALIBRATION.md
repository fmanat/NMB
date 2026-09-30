# Calibration : mesurer la précision réelle de l'analyse

## Pourquoi

Le calcul géométrique a été validé **en simulation** (voir le tableau en bas) : sur des milliers de prises de vue virtuelles, l'erreur reste sous 6,1 % quand les points sont repérés parfaitement. Ce que la simulation **ne sait pas** : avec quelle précision le modèle d'intelligence artificielle place les points sur une vraie photo (flou, reflets, ombres, objectif déformant). Seule une calibration sur de vraies photos répond. Tant qu'elle n'est pas faite, la marge affichée (± 10 % minimum) reste une hypothèse, et la page « Précision et méthode » le dit.

Ordre à suivre : **d'abord des objets cylindriques de dimensions connues**, sans aucune donnée personnelle ; **ensuite un seul test anatomique, le vôtre**.

## Matériel

- Une **carte au format bancaire** (n'importe laquelle), posée côté verso.
- **3 à 5 objets cylindriques rigides** à extrémités nettes : rouleau de papier essuie-tout, rouleau de ruban adhésif, tube en carton ou en PVC, bouteille à fond plat (mesurez seulement la partie cylindrique, sans col ni bouchon), pot cylindrique. Variez les diamètres (de 3 à 5 cm) et les longueurs (de 8 à 18 cm).
- Une **règle rigide** et un **mètre ruban souple** (ou une ficelle et la règle).
- Votre **téléphone**, avec l'**objectif principal** : sans zoom, sans mode portrait, sans grand-angle (le calcul suppose la focale de l'objectif principal).
- Une surface plane (table) et une bonne lumière.

## Étape 1 : mesurer la vérité

Pour chaque objet, notez en centimètres, avec une décimale :
- la **longueur** : de bout en bout de la partie cylindrique, à la règle rigide ;
- la **circonférence** : faites le tour avec le mètre ruban (ou une ficelle que vous mesurez ensuite à la règle), sans serrer.

Mesurez deux fois et gardez la moyenne. Écrivez les valeurs dans le tableau de la section « Tableau à remplir ».

## Étape 2 : prendre les photos

Règles identiques à celles du site (en dehors, la photo sera refusée) :
- la carte **entière**, ses **4 coins** visibles, posée à plat **sur la même surface** que l'objet, à côté de lui ;
- la carte doit occuper **au moins 15 % de la largeur de l'image** (un côté de la carte sur environ un sixième de la photo) ;
- l'appareil incliné de **50° au maximum** par rapport à la verticale (0° = directement au-dessus) ;
- pas de zoom, image nette, pas de reflet sur la carte.

Pour **chaque objet**, prenez 6 photos :

| Inclinaison | Lumière du jour | Lumière artificielle |
|---|---|---|
| Vue de dessus (0°) | 1 photo | 1 photo |
| Environ 25° | 1 photo | 1 photo |
| Environ 45° | 1 photo | 1 photo |

Changez aussi la position de la carte autour de l'objet et la direction de l'objet d'une photo à l'autre. Avec 4 objets, cela fait 24 photos. **Minimum utile : 15 photos.**

## Étape 3 : préparer le fichier

Copiez toutes les photos dans le dossier `photos-test/` (ignoré par git). Créez dans ce même dossier le fichier `calibration.json`, avec une ligne par photo et les valeurs réelles de l'étape 1 :

```json
[
  { "file": "rouleau1_haut_jour.jpg", "length": 13.0, "girth": 11.2, "state": "erect" },
  { "file": "rouleau1_45_lampe.jpg",  "length": 13.0, "girth": 11.2, "state": "erect" }
]
```

(`state` vaut toujours `erect` pour un objet : ce champ ne sert qu'aux comparaisons avec les références statistiques, pas à la calibration.)

## Étape 4 : lancer

D'abord un essai gratuit, pour vérifier que l'outil lit bien vos fichiers :

```bash
npm run calibrate -- --simulate
```

Puis le vrai essai avec le moteur d'analyse (payant : environ 1 à 2 centimes de dollar par photo, donc moins de 0,50 $ pour 24 photos) :

```bash
npm run calibrate
```

L'outil affiche, pour chaque photo, la mesure réelle, la mesure estimée, l'écart, l'inclinaison, la taille de la carte et la marge affichée. Il n'affiche jamais les noms de fichiers ni les images.

## Étape 5 : lire et décider

La synthèse donne, pour la longueur et la circonférence : le biais, l'écart typique (80e et 90e percentiles) et la **part des mesures dans la marge affichée**.

| Résultat | Décision |
|---|---|
| **90 % ou plus** dans la marge affichée | La marge est juste. Passez à l'étape 6. |
| Entre 75 % et 90 % | La marge est trop optimiste. Dans `src/config/site.ts`, augmentez `MARGIN.markerNoisePx` (2 → 3 → 4) puis relancez jusqu'à atteindre 90 %. |
| Moins de 75 % | Un problème de fond : regardez si les refus ou les écarts se concentrent sur un cas (forte inclinaison, petite carte, un éclairage, un objet). Notez-le et ne passez pas à l'étape 6. |
| Beaucoup de refus | Vérifiez que vos photos respectent l'étape 2 ; sinon les seuils (`PHOTO_LIMITS`) sont peut-être trop stricts pour de vraies photos. |

Un **biais** marqué (toujours trop grand ou toujours trop petit) indique un problème d'échelle : notez-le, il se corrige dans le calcul, pas dans la marge.

## Étape 6 : un seul test anatomique, le vôtre

À faire seulement si l'étape 5 est concluante.

1. Mesurez-vous deux fois, à la règle et au mètre ruban, avec la **même méthode** que pour les objets ; notez la valeur sans arrondir à la hausse. Votre propre mesure a une incertitude d'environ ± 3 à 5 mm.
2. Prenez **une seule photo**, carte à côté dans le même plan, inclinaison faible, sans visage ni élément identifiant.
3. Ajoutez-la à `calibration.json`, placez-la seule dans `photos-test/` (retirez les autres) et lancez `npm run calibrate`.
4. Rappel : le prestataire d'analyse conserve les requêtes 30 jours (voir la politique de confidentialité).
5. **Supprimez la photo** de `photos-test/` immédiatement après.

## Tableau à remplir

| # | Objet | Inclinaison | Lumière | Longueur réelle (cm) | Longueur estimée (cm) | Écart (%) | Circonf. réelle (cm) | Circonf. estimée (cm) | Écart (%) | Dans la marge ? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | |
| 2 | | | | | | | | | | |
| 3 | | | | | | | | | | |
| 4 | | | | | | | | | | |
| 5 | | | | | | | | | | |
| 6 | | | | | | | | | | |
| … | | | | | | | | | | |
| Test anatomique | (vous) | | | | | | | | | |

Écart (%) = (estimé − réel) ÷ réel × 100.

## Résultats de la simulation (point de départ)

Commande : `npm run geometry:report`. Scènes simulées : caméra sténopé, carte et cylindre posés sur une table, inclinaison de 0° à 50°, rotations de la carte et de l'objet, cartes de 150 à 600 px de large, focale réelle de 80 % à 120 % de la focale supposée, cylindres de 10 à 16 cm de long et de 3 à 4,5 cm de diamètre.

| Calcul | Repérage | Erreur circonférence (90e / max) | Dans la marge |
|---|---|---|---|
| Ancien (tout projeté dans le plan de la carte) | parfait | 67 % / 207 % | (non concerné) |
| **Actuel (pose de l'appareil)** | parfait | **3,7 % / 6,1 %** | **100 %** |
| **Actuel** | bruité (2 px par point), carte ≥ 250 px | 9,5 % / 27 % | 94 % |

Limites connues de la simulation, que seule la calibration lèvera : imprécision réelle du modèle d'IA, flou et reflets, distorsion de l'objectif, objet non parfaitement cylindrique, sujet tenu en l'air (le calcul suppose un sujet posé sur la même surface que la carte), carte pliée ou décollée du plan.
