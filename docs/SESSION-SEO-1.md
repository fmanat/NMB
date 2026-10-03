# Session SEO 1 : phase 1 du plan de référencement (nuit du 03/10/2026)

Session autonome, sans question. Journal mis à jour à la fin de chaque bloc. À relire en cas de reprise.

## Règles suivies
- Aucun compte ouvert, aucun message envoyé, aucune variable Railway modifiée, aucun appel xAI.
- Tous les chiffres des pages viennent des fonctions du site (`src/lib/seoFigures.ts`, `src/lib/stats.ts`) : dans les fichiers Markdown ils sont écrits sous forme de jetons `{{…}}`, remplacés au chargement ; un jeton invalide fait échouer la construction.
- Sources vérifiées sur les résumés PubMed (service eutils du NCBI) le 03/10/2026 : Veale 2015 (PMID 25487360), Wessells 1996 (8709382), Sengezer 2002 (12068220), Yafi 2018 (30068977), Bondil 1992 (1459150), Belladelli 2023 (36792094), Mostafaei 2025 (40248849).
- Écriture : jamais « court », « petit », « insuffisant », « anormal », « défaut », aucun dénigrement (contrôle automatique, voir bloc 5).

## Décisions prises seul (à valider)
- **Publication par défaut** : je ne peux pas modifier les variables Railway. `SEO_PUBLISH` devient « publié sauf `off` » (au lieu de « caché sauf `on` »). Le site de test reste protégé par mot de passe : rien n'est indexé tant qu'il n'est pas ouvert.
- **Rang en percentile** : partie entière, jamais arrondie à la hausse, comme « Au-dessus de X % » du rapport. Le rapport d'exemple (13,8 cm) affiche donc « 65e percentile : au-dessus d'environ 65 % » (percentile exact 65,9) et non « 66e ».
- **20 cm** : au-delà de 4 écarts-types, le questionnaire et le calculateur refusent la valeur (règle existante, `MAX_SIGMA`). La page 20 cm le dit et affiche « au-delà du 99e percentile ».
- **Textes du propriétaire** : la règle « je ne réécris pas leur texte » (CLAUDE.md) est levée pour cette session par la demande explicite (élargir la page France, retitrer les guides). Les passages d'origine sont conservés autant que possible ; les ajouts sont signalés ci-dessous.

## Bloc 1 : technique — terminé
- Publication activée par défaut (`src/lib/seo.ts`, `isPublished`), documentation mise à jour (`.env.example`, README, SPEC §19).
- Chargeur de contenu étendu : champs `h1`, `breadcrumb`, `verified`, `ogFigure`, `ogLabel` ; blocs `[[calculateur]]`, `[[distribution]]`, `[[tableau-percentiles]]`, `[[tailles]]`, `[[mesure]]` ; jetons de chiffres ; nouveaux slugs (piliers, à propos, 11 pages par centimètre) ; liens vers `/` et `/presse` autorisés.
- Page `taille-moyenne-penis-france` renommée `taille-moyenne-penis`, redirection permanente (308) de l'ancienne adresse (`src/lib/seoRenamed.ts`, `next.config.ts`).
- Sitemap : pages publiques fixes + pages de contenu publiées, date = date de vérification. robots.txt inchangé (déjà correct).
- Balises canoniques : accueil, pages de contenu, méthode, contact, pages légales.
- Fil d'Ariane visible + BreadcrumbList ; WebSite + Organization (nom Bitomètre seulement) sur toutes les pages ; WebApplication sur l'accueil ; Article (auteur « Rédaction Bitomètre ») sur chaque page de contenu ; FAQPage conservé.
- Image de partage par page : `/og/page/<slug>` (titre + chiffre clé calculé), `/og/page/accueil` ; image neutre par défaut pour les pages légales.
- Mini-calculateur « Essayez » réutilisable (valeurs préremplies, version compacte).
- Parcours automatique des liens : `e2e/liens.spec.ts` (aucun lien interne cassé ; sitemap = exactement les pages indexables ; canonique = soi-même ; image de partage servie). Les liens vers une page de contenu absente ne sont pas affichés.
- `docs/SEARCH-CONSOLE.md` : Google Search Console et Bing par DNS chez Cloudflare, sitemap, planificateur de mots-clés.
- Tests : `tests/seo-figures.test.ts` (quantile, jetons, cohérence avec le rapport).

## Bloc 2 : page d'accueil — terminé
- Titre de page « Calculateur taille pénis : percentile et moyenne | Bitomètre » ; H1 « Calculateur de taille du pénis » ; sous-titre au ton laboratoire qui dit ce qu'on obtient en une minute.
- Méta-description orientée clic (deux variantes : bêta gratuite / payant), sans chiffre trompeur (l'effectif de 15 521 hommes ne concerne pas la longueur en érection : il n'est pas mis en avant).
- Rapport d'exemple : le percentile est l'information principale (« 65e percentile : au-dessus d'environ 65 % de la population de référence »), le score passe au second plan dans un encadré (option `lead="percentile"` de `ReportDashboard`, utilisée seulement sur l'accueil ; le rapport réel est inchangé).
- Bandeau « scanner » de l'accueil : « Percentile 66 » (arrondi) remplacé par « 65e percentile » (partie entière), pour être cohérent avec « Au-dessus de 65 % » affiché plus bas. Fonction commune `rankLabel` (`src/lib/format.ts`).
- Section « Où vous situez-vous ? » (11 tailles) et « Comprendre les chiffres » (pages piliers) : `src/components/content/HomeGuides.tsx`. Chaque lien n'apparaît que si sa page existe et est publiée.
- Bandeau défilant : « Indicateurs dans chaque rapport : 4 » au lieu de « Mesures ».
- Pied de page : libellés courts des guides (champ `breadcrumb`), sans les pages par centimètre.

## Bloc 3 : les 8 guides — terminé
- `taille-moyenne-penis-france` → **`taille-moyenne-penis`** (redirection permanente), élargie en page pilier : réponse en tête, moyennes au repos et en érection, longueur et circonférence, distribution (courbes calculées), France (passages d'origine conservés), Internet. Requête visée : « taille moyenne pénis ».
- Pour chaque guide : `title` et `metaDescription` orientés requête, `h1`, `breadcrumb`, `verified` (03/10/2026), chiffre clé de l'image de partage ; mini-calculateur ajouté par la mise en page ; liens vers l'accueil (« À lire aussi »), les piliers et des pages par centimètre pertinentes ; signature « Rédaction Bitomètre » ; références existantes conservées.
- Chiffres de Veale et al. (moyennes, écarts-types, effectifs) remplacés par des jetons calculés : mêmes valeurs, une seule source dans le code.
- Liens vers une page pas encore créée : affichés en texte simple (jamais de lien cassé) ; ils deviennent des liens dès que la page existe.
- **Modifications de vos textes** (règles d'écriture) : « petits échantillons » → « échantillons réduits » (taille-moyenne) ; « plus courte » → « donner une valeur inférieure » (mesure) ; « anormale/anormal » → « un problème médical », « le signe d'un problème », « pathologique » (courbure, 4 occurrences) ; FAQ du service : « Par défaut » → « sauf choix contraire », « un petit nombre de photos » → « un nombre limité de photos » (2 occurrences).
- Contrôles ajoutés : `src/lib/contentQuality.ts`, `tests/content-quality.test.ts`, `npm run seo:check` (mots interdits, paragraphes partagés à plus de 30 %, longueurs).
- **À voir** : `npm run seo:check` signale 24 recoupements de plus de 30 % entre vos guides d'origine (paragraphes repris d'un guide à l'autre, par exemple « Ces moyennes ne reposent pas sur le même nombre d'hommes… »). Simple avertissement : je n'ai pas réécrit vos textes pour cela.

## Bloc 4 : pages piliers nouvelles — terminé
- **/taille-penis-normale** (« taille pénis normale ») : réponse en tête, population de référence, distribution (courbes), sens statistique de « normal », repos et érection, mesure, calculateur, grille des tailles. 1 050 mots (corps et questions-réponses).
- **/percentile-penis** (« percentile pénis ») : définition, calcul (loi normale, garde-fous), tableaux de 10 à 20 cm (longueur, chaque ligne liée à sa page) et de 9 à 15 cm (circonférence), calculés par le site, courbes de distribution, limites, calculateur. 1 085 mots.
- **/a-propos** (« Bitomètre ») : ce qu'est le site, méthode, sources, politique de mise à jour, limites, confidentialité ; aucune identité de personne ni de société. 967 mots.
- Le contrôle des paragraphes partagés a fait réécrire plusieurs passages de ces pages trop proches des guides existants.
- Tableaux pleine largeur, zone « 80 % » des courbes plus contrastée.

## Bloc 5 : les 11 pages par centimètre — terminé
- `/taille-penis-10-cm` à `/taille-penis-20-cm` (requêtes « pénis 10 cm » … « pénis 20 cm »). Mise en page commune automatique : fil d'Ariane (Accueil › Percentile du pénis › N cm), réponse immédiate (rang calculé, « sur 1 000 hommes, environ N mesurent moins »), courbe avec le repère, « Vérifier sa mesure en quatre points », calculateur prérempli (longueur = la taille, circonférence = médiane de référence), tailles voisines, appel vers le questionnaire, grille des autres tailles.
- Contenu propre à chaque page selon sa place : 10-12 cm (relativiser, erreurs de mesure, repos/érection, circonférence ; 11 cm : le 10e percentile n'est qu'un repère ; 12 cm : premier quartile, variation selon la référence) ; 13-14 cm (ce que « dans la moyenne » veut dire, densité au centre, sensibilité au demi-centimètre) ; 15-16 cm (proportions, haut de la courbe, vérifications) ; 17-20 cm (rareté, extrapolation de la loi normale sur 692 hommes, hommes « attendus » au-delà, erreurs qui ajoutent, pouces, limite des 4 écarts-types pour 20 cm).
- 4 à 6 questions-réponses par page, toutes différentes ; 700 à 1 100 mots par page (corps et questions-réponses), vérifié par test.
- Contrôle automatique des paragraphes partagés (> 30 %) : 75 recoupements trouvés au premier passage, tous éliminés par réécriture (pages 10 à 20, piliers, à propos), réponses des questions-réponses comprises.
- 20 cm : au-delà de 4 écarts-types, le calculateur prérempli affiche le message de refus du questionnaire (comportement existant), la page l'explique.
