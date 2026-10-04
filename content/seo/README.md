# Pages de contenu (SEO)

Une page = un fichier `content/seo/<slug>.md`. Ce fichier README n'est pas une page : il est ignoré.

## Les slugs

- **Pages piliers** : `taille-moyenne-penis` (ancienne `taille-moyenne-penis-france`, redirigée), `taille-penis-normale`, `percentile-penis`.
- **Guides** : `taille-penis-par-pays`, `comment-mesurer-son-penis`, `circonference-moyenne-penis`, `courbure-penis-normale`, `taille-repos-erection`, `etudes-taille-penis`, `faq`.
- **Information** : `a-propos`.
- **Pages par centimètre** : longueur en érection, `taille-penis-10-cm` à `taille-penis-20-cm` ; circonférence en érection, `circonference-penis-9-cm` à `circonference-penis-15-cm`.

La liste fait foi dans `src/lib/seo.ts`. Le nom du fichier doit être exactement `<slug>.md`. La nature de la page (pilier, guide, information, centimètre) se déduit du slug et décide de la mise en page.

## Format

```markdown
---
slug: taille-penis-14-cm
title: Titre pour les moteurs (60 caractères maximum)
h1: Titre affiché en haut de la page (facultatif, sinon le title)
breadcrumb: Libellé court du fil d'Ariane et du pied de page (facultatif, sinon le h1)
metaDescription: Description pour les moteurs de recherche (155 caractères maximum)
targetKeyword: requête visée
verified: 2026-10-03
ogFigure: "{{moyenne:erect-length}}"
ogLabel: libellé du chiffre clé de l'image de partage
faq:
  - q: Une question ?
    a: Sa réponse.
sources:
  - title: Nom de la source
    url: https://adresse-de-la-source
---
## Un titre H2

Texte. Lien vers [l'analyse](/analyse), [l'accueil](/) et [une autre page](taille-repos-erection).

[[calculateur]]
```

- `verified` : date de vérification affichée sous le titre (« Vérifié le … ») et reprise dans les données structurées et le sitemap.
- `ogFigure` et `ogLabel` vont ensemble : le chiffre clé de l'image de partage. Sans eux, l'image affiche la longueur moyenne en érection. Les pages par centimètre calculent le leur (le percentile).
- Chaque page est signée « Rédaction Bitomètre » automatiquement.

## Chiffres : toujours des jetons, jamais à la main

Toute statistique (moyenne, écart-type, effectif, percentile, proportion, valeur à un percentile) s'écrit sous forme de jeton `{{…}}`, calculé au chargement avec les fonctions du site. Un jeton inconnu ou mal écrit fait échouer la construction, avec le nom du fichier.

Séries : `erect-length`, `erect-girth`, `rest-length`, `rest-girth`.

| Jeton | Exemple | Affiche |
|---|---|---|
| `moyenne:série` | `{{moyenne:erect-length}}` | 13,12 cm |
| `ecart-type:série` | `{{ecart-type:erect-length}}` | 1,66 cm |
| `effectif:série`, `effectif-total` | `{{effectif:erect-length}}` | 692 |
| `pct:série:cm` | `{{pct:erect-length:14}}` | part en dessous, une décimale |
| `rang:série:cm` | `{{rang:erect-length:14}}` | « 70e percentile » (partie entière) |
| `sur1000:série:cm` | `{{sur1000:erect-length:14}}` | nombre sur 1 000 en dessous |
| `au-dessus:série:cm` | `{{au-dessus:erect-length:16}}` | part au-dessus |
| `entre:série:a:b` | `{{entre:erect-length:12:14}}` | part entre deux valeurs |
| `quantile:série:p` | `{{quantile:erect-length:90}}` | valeur au 90e percentile |
| `sigma:série:cm`, `ecart:série:cm` | `{{sigma:erect-length:17}}` | distance à la moyenne (écarts-types, cm) |
| `un-sur-dessus:série:cm`, `un-sur-dessous:série:cm` | `{{un-sur-dessus:erect-length:17}}` | « 1 homme sur 100 » |
| `attendus:série:cm` | `{{attendus:erect-length:17}}` | hommes attendus au-delà, dans l'échantillon publié |
| `dans-sigma:k`, `pct-sigma:k` | `{{dans-sigma:1}}` | part à moins de k écarts-types ; percentile à +k écarts-types |
| `borne-basse`, `borne-haute`, `max-sigma` | `{{max-sigma}}` | règles d'affichage du rapport |
| `pouces:cm`, `pouces-en-cm:pouces` | `{{pouces:18}}` | conversions (1 pouce = 2,54 cm) |
| `diametre:cm` | `{{diametre:12}}` | diamètre d'une section ronde de cette circonférence (÷ π) |

Les chiffres tirés d'une autre source (par exemple une méta-analyse récente) s'écrivent tels quels, après vérification sur la source.

## Blocs

Une ligne seule `[[nom]]` insère un bloc calculé par le site :

- `[[calculateur]]` : le mini-calculateur « Essayez » (prérempli avec la taille sur les pages par centimètre) ;
- `[[distribution]]` : les courbes de la longueur et de la circonférence en érection ;
- `[[tableau-percentiles]]` : les tableaux de 10 à 20 cm (longueur) et de 9 à 15 cm (circonférence) ;
- `[[tailles]]` : la grille des 11 pages par centimètre ;
- `[[mesure]]` : « Vérifier sa mesure en quatre points ».

Si une page ne place pas le calculateur ou la grille des tailles, la mise en page les ajoute après le corps. Les pages par centimètre ont en plus, automatiquement : la réponse immédiate (percentile et « sur 1 000 hommes »), la courbe avec le repère, la vérification de la mesure, les tailles voisines et l'appel vers le questionnaire.

## Règles contrôlées automatiquement

- Titres **H2 et H3 uniquement** dans le corps (le H1 vient du champ `h1` ou `title`).
- Ni image, ni HTML brut.
- Liens internes : `/`, `/analyse`, le slug d'une page de contenu, ou `/methode`, `/confidentialite`, `/cgv`, `/contact`, `/mentions-legales`, `/presse`. Un lien vers une page de contenu absente est affiché en texte simple (jamais de lien cassé) et signalé. Les liens externes sont en `https://`.
- `title` ≤ 60 caractères, `metaDescription` ≤ 155 caractères, `targetKeyword` obligatoire.
- **Mots interdits** (règles d'écriture héritées du rapport, aucun dénigrement) : « court », « petit », « insuffisant », « anormal », « défaut », sous toutes leurs formes.
- **Pages quasi identiques** : aucun paragraphe ne doit partager plus de 30 % de ses suites de trois mots avec un paragraphe d'une autre page, quelle qu'elle soit (test `tests/content-quality.test.ts`, et erreur dans `npm run seo:check`).
- Longueurs : pages par centimètre, 700 à 1 100 mots (corps et questions-réponses) et 4 à 6 questions ; nouvelles pages piliers, 900 à 1 500 mots ; autres pages, corps de 600 à 1 500 mots (avertissement).

## Vérifier

```bash
npm run seo:check
```

Avec `-- --urls`, l'outil vérifie aussi que chaque adresse de source répond. Il ne vérifie **pas** qu'un chiffre cité d'une source externe figure dans cette source : cela se fait à la relecture.

## Publication

Les pages sont **publiées par défaut** (indexables, dans le sitemap). `SEO_PUBLISH=off` (fichier `.env` ou variable de l'hébergeur) les coupe : pages en `noindex`, hors sitemap, introuvables en production. Le réglage est lu à la construction du site.

## Dossier `a-corriger/`

Une page qui ne respecte pas le format fait échouer la construction du site. Tant qu'une page n'est pas corrigée, elle est rangée dans `content/seo/a-corriger/`, que le site ignore. Une fois corrigée, elle se déplace dans `content/seo/` (et `npm run seo:check` doit passer sans erreur).
