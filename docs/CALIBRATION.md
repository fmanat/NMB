# Calibration : mesurer la précision réelle de l'analyse

But : savoir de combien l'analyse se trompe, pour fixer la marge d'erreur affichée sur des données et non au jugé. Tant que cette calibration n'est pas faite, la marge (± 10 % minimum) est une hypothèse, et la page « Précision et méthode » le dit.

## Ce qu'il faut

Un lot d'au moins **15 à 20 photos** dont vous connaissez les mesures réelles. Plus il y en a, plus la conclusion est solide. Variez l'éclairage, l'angle et la distance.

Pour ne pas multiplier les envois de photos intimes vers xAI (qui les conserve 30 jours), une partie du lot peut être des **objets de taille connue** (un tube, une bouteille, un rouleau) posés à côté d'une carte bancaire, photographiés de la même façon. Indiquez alors la longueur et la circonférence de l'objet.

## Préparer le lot

1. Copiez les photos dans le dossier `photos-test/` (ignoré par git : elles ne peuvent pas être publiées par erreur).
2. Créez dans ce même dossier un fichier `calibration.json` qui liste chaque photo et ses mesures réelles, en centimètres :

```json
[
  { "file": "photo1.jpg", "length": 13.0, "girth": 12.0, "state": "erect" },
  { "file": "tube1.jpg",  "length": 15.0, "girth": 10.0, "state": "erect" }
]
```

Règles : `length` est la longueur, `girth` la circonférence, `state` vaut `erect` (érection) ou `rest` (repos). Mesurez vous-même, à la règle souple, et notez les valeurs sans arrondir à la hausse.

## Lancer

D'abord un essai gratuit avec le moteur simulé, pour vérifier que l'outil lit bien vos fichiers :

```bash
npm run calibrate -- --simulate
```

Puis le vrai essai avec xAI (payant : environ 1 à 2 centimes par photo, moins de 0,50 $ pour 20 photos) :

```bash
npm run calibrate
```

L'outil n'affiche jamais les noms de fichiers ni les photos : uniquement des chiffres. Il utilise exactement le même code que le site.

## Lire les résultats

Pour chaque photo : mesure réelle, mesure estimée, écart en %, confiance, marge affichée. Puis une synthèse par mesure :

- **biais moyen** : positif = l'analyse surestime, négatif = elle sous-estime ;
- **écart absolu 80e / 90e percentile** : 8 photos sur 10 (ou 9 sur 10) ont un écart inférieur à cette valeur ;
- **dans ± 10 % / dans la marge affichée** : part des photos où l'estimation reste dans la marge annoncée. Si elle est très inférieure à 90 %, la marge affichée est trop optimiste ;
- **marge suggérée** : le 90e percentile de l'écart, jamais sous 10 %. Elle n'est proposée qu'à partir de 15 mesures.

La comparaison « largeur moyenne » permet de vérifier que le choix de la largeur maximale pour la circonférence reste le bon (réglage `GIRTH_FROM` dans `src/config/site.ts`).

## Ensuite

Si la marge suggérée diffère de la marge actuelle, on ajuste les paramètres `MARGIN` dans `src/config/site.ts` et on met à jour la page « Précision et méthode ». **Supprimez les photos de `photos-test/` dès la calibration terminée.**
