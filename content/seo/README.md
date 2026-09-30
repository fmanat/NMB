# Pages de contenu (SEO)

Une page = un fichier `content/seo/<slug>.md`. Ce fichier README n'est pas une page : il est ignoré.

## Les 8 slugs du lancement

`taille-moyenne-penis-france`, `taille-penis-par-pays`, `comment-mesurer-son-penis`, `circonference-moyenne-penis`, `courbure-penis-normale`, `taille-repos-erection`, `etudes-taille-penis`, `faq`.

Le nom du fichier doit être exactement `<slug>.md`. Un autre nom est ignoré ou refusé.

## Format

```markdown
---
slug: faq
title: Titre de la page (60 caractères maximum)
metaDescription: Description pour les moteurs de recherche (155 caractères maximum)
targetKeyword: mot clé visé
faq:
  - q: Une question ?
    a: Sa réponse.
sources:
  - title: Nom de la source
    url: https://adresse-de-la-source
---
## Un titre H2

Texte. Lien vers [l'analyse](/analyse) et vers [une autre page](taille-repos-erection).

### Un titre H3
```

## Règles contrôlées automatiquement

- Titres **H2 et H3 uniquement** dans le corps (le H1 vient du champ `title`).
- Ni image, ni HTML brut.
- Liens internes : `/analyse` ou le slug d'une des 8 pages (avec ou sans `/`). Tout autre lien interne est refusé. Les liens externes sont en `https://`.
- `title` ≤ 60 caractères, `metaDescription` ≤ 155 caractères, `targetKeyword` obligatoire.
- Questions (`faq`) et sources : chacune avec tous ses champs ; adresses `http(s)` uniquement.

Cible de longueur : 800 à 1 500 mots par page (simple avertissement).

## Vérifier

```bash
npm run seo:check
```

Avec `-- --urls`, l'outil vérifie aussi que chaque adresse de source répond. Il ne vérifie **pas** qu'un chiffre cité figure dans sa source : cela se fait à la relecture.

## Publication

Tant que `SEO_PUBLISH` (fichier `.env`) est vide :
- chaque page affiche la mention interne « à relire avant publication », est en `noindex` et n'apparaît pas dans le sitemap ;
- en production, les pages sont introuvables.

Après relecture, mettre `SEO_PUBLISH=on` et **reconstruire le site** (le réglage est lu à la construction).

## Dossier `a-corriger/`

Une page qui ne respecte pas le format (par exemple un titre de plus de 60 caractères) fait échouer la construction du site. Tant qu'une page n'est pas corrigée, elle est rangée dans `content/seo/a-corriger/`, que le site ignore. Une fois corrigée, elle se déplace dans `content/seo/` (et `npm run seo:check` doit passer sans erreur).
