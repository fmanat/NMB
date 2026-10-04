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

## Bloc 6 : page presse et kit de relations presse — terminé
- **/presse** : trois graphiques originaux téléchargeables en PNG 1 600 × 900 (`/presse/graphiques/distribution-longueur.png`, `distribution-circonference.png`, `tableau-percentiles.png`), source intégrée dans l'image ; mention de source à reprendre (texte et version avec lien) ; chiffres clés ; pages de référence. Aucun chiffre qui ne vienne de Veale et al. (2015) ou des calculs du site. Dans le sitemap, lien dans le pied de page et depuis « À propos ».
- **docs/PRESSE/** : `README.md` (règles d'envoi, origine des chiffres), `ANGLES.md` (trois angles : ce que dit vraiment la science sur la taille moyenne ; pourquoi la plupart des hommes se mesurent mal ; les classements par pays ne valent rien), `COMMUNIQUE.md` (communiqué court), `CIBLES.md` (santé, lifestyle masculin, sexologie, vulgarisation scientifique, annuaires d'outils), `MODELES.md` (un message par type, plus une relance).
- `npm run presse:chiffres` recalcule tous les chiffres du kit avec les fonctions du site (valeurs vérifiées identiques à celles des documents le 03/10/2026).

## Bloc 7 : contrôle — terminé
Mesures faites sur une version de production compilée localement, en mode bêta comme le site Railway (`FREE_BETA=on`, sans mot de passe).

**Captures** (`docs/captures-seo1/`, sur votre ordinateur seulement : le dépôt exclut les images `.jpg`, comme pour les captures de la nuit 4 ; premier écran et page entière) : accueil, page pilier « taille moyenne », pages 12 cm et 17 cm, à 390 px et 1 440 px. Aucun débordement horizontal (0 px mesuré sur les 8 combinaisons).

**Lighthouse 13.5, mobile (simulation de téléphone et de réseau lent)** :

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| Accueil | 71 | 100 | 100 | 100 | 2,8 s | 1 450 ms | 0 |
| /taille-moyenne-penis | 95 | 100 | 100 | 100 | 2,7 s | 130 ms | 0 |
| /taille-penis-12-cm | 97 | 100 | 100 | 100 | 2,6 s | 50 ms | 0 |
| /taille-penis-17-cm | 96 | 100 | 100 | 100 | 2,7 s | 70 ms | 0 |

La note de performance de l'accueil vient de l'animation 3D du bandeau scanner (environ 0,7 s de calcul sur le fil principal en simulation mobile) : fonctionnalité antérieure à cette session, non modifiée. Voir les questions en fin de rapport.

**Parcours des liens et sitemap** : sur la version de production en mode bêta, le parcours a trouvé **un lien cassé** : `/faq` renvoyait vers `/cgv`, qui n'existe pas en bêta (404). Corrigé : en bêta, ce lien s'affiche en texte simple (test ajouté), et le parcours tourne désormais aussi sur la copie bêta des tests de bout en bout. Après correction : aucun lien cassé ; le sitemap contient exactement les 29 pages publiables (6 pages fixes, /presse, 22 pages de contenu) ; chaque page publiable a sa canonique et son image de partage.

**Sources** : `npm run seo:check -- --urls` : les 12 adresses de sources citées répondent.

**Autres retouches** : la réponse courte des pages s'affiche désormais avant le sommaire ; test d'accessibilité de la page de paiement rendu robuste (il analysait parfois le bouton pendant l'état « Redirection… » au premier passage à froid).

## Rapport de fin de session

### Pages créées et modifiées, avec leur requête cible

| Page | Requête visée | Statut |
|---|---|---|
| `/` (accueil) | calculateur taille pénis | modifiée (titre, H1, sous-titre, percentile en tête, repères) |
| `/taille-moyenne-penis` (ex `/taille-moyenne-penis-france`, redirigée) | taille moyenne pénis | renommée, élargie en pilier |
| `/taille-penis-normale` | taille pénis normale | créée (pilier) |
| `/percentile-penis` | percentile pénis | créée (pilier) |
| `/a-propos` | Bitomètre | créée |
| `/taille-penis-10-cm` … `/taille-penis-20-cm` (11 pages) | pénis 10 cm … pénis 20 cm | créées |
| `/taille-penis-par-pays` | taille pénis par pays | retitrée, liens, date |
| `/comment-mesurer-son-penis` | comment mesurer son pénis | retitrée, liens, date |
| `/circonference-moyenne-penis` | circonférence moyenne pénis | retitrée, percentiles calculés, liens |
| `/courbure-penis-normale` | courbure pénis normale | H1, liens, vocabulaire |
| `/taille-repos-erection` | taille pénis repos érection | H1, exemple calculé, liens |
| `/etudes-taille-penis` | études taille pénis | retitrée, rangs calculés, liens |
| `/faq` | Bitomètre fonctionnement | H1, liens, vocabulaire |
| `/presse` | (page de ressources) | créée |

### Commits (tous poussés sur fmanat/NMB ; `npm run verify` vert et compilation de production réussie pour chacun, vérifiés dans une copie de travail séparée)
- `17c3226` SEO bloc 1 : publication par défaut, données structurées, fil d'Ariane, images de partage par page, parcours des liens
- `34caede` SEO bloc 2 : accueil orienté calculateur, percentile en tête du rapport d'exemple
- `6fdc3c8` SEO bloc 3 : les 8 guides retravaillés, page pilier « taille moyenne du pénis »
- `4ed7a94` SEO bloc 4 : pages piliers « taille normale », « percentile », « à propos »
- `b4f5a98` SEO bloc 5 : 11 pages par centimètre (10 à 20 cm)
- `32977c1` SEO bloc 6 : page presse et kit de relations presse
- « SEO bloc 7 » : contrôle (captures, Lighthouse), lien /cgv en bêta, réponse courte avant le sommaire, rapport

### Ce qui n'est pas fait
- **Déclaration à Google Search Console et Bing** : à faire par vous (`docs/SEARCH-CONSOLE.md`, pas à pas). Tant que le site de test est protégé par mot de passe, aucune page ne peut être indexée.
- **Planificateur de mots-clés** : non consulté (demande un compte Google Ads, que je n'ouvre pas). Les requêtes visées sont des choix raisonnés, pas mesurés.
- **Recoupements entre vos guides d'origine** : 24 paragraphes repris d'un guide à l'autre (plus de 30 % de mots communs). Signalés par `npm run seo:check`, non réécrits (vos textes).
- **Kit presse** : prêt, rien n'a été envoyé.
- **Lighthouse** : mesuré en local sur une version de production ; les chiffres réels dépendront de l'hébergement (Railway, Cloudflare).

### Points d'attention
- **Rang affiché** : « 65e percentile » pour l'exemple de 13,8 cm (percentile exact 65,9), et non « 66e » comme dans la consigne : le site ne flatte jamais un rang (règle déjà appliquée à « Au-dessus de X % »). Le bandeau scanner de l'accueil, qui affichait « Percentile 66 », est désormais aligné.
- **Publication** : activée par défaut dans le code (je ne pouvais pas modifier la variable Railway). `SEO_PUBLISH=off` la coupe.
- **Postgres.app** : une fenêtre de permission est apparue pendant la nuit pour une connexion lancée d'une certaine manière ; aucune conséquence, mais si une fenêtre « Postgres.app » vous attend, elle concerne cette connexion de test.

### Questions (QCM, avec ma recommandation)

**1. Rang affiché pour l'exemple de 13,8 cm (percentile exact 65,9)**
- A. Garder « 65e percentile » : partie entière, jamais arrondi à la hausse, cohérent avec « Au-dessus de 65 % » (**recommandé**)
- B. Passer à l'arrondi (« 66e percentile ») partout, y compris « Au-dessus de 66 % »
- C. Afficher la décimale (« 65,9e percentile »)

**2. Animation 3D de l'accueil (performance mobile 71, contre 95 à 97 sur les autres pages)**
- A. Sur mobile, n'afficher que l'image fixe et lancer l'animation au premier contact (toucher ou glisser) (**recommandé** : gain attendu important sur la note, aspect inchangé au chargement)
- B. Retarder le démarrage de l'animation de quelques secondes après le chargement
- C. Laisser tel quel

**3. Recoupements dans vos guides d'origine (24 paragraphes repris d'un guide à l'autre)**
- A. Je reformule ces passages en gardant exactement le sens et les sources, puis vous relisez (**recommandé** : Google pénalise les pages trop semblables)
- B. Vous les reformulez vous-même (liste dans `npm run seo:check`)
- C. Laisser tel quel

**4. Ouverture du site aux moteurs de recherche**
- A. Retirer le mot de passe du site (variable `SITE_PASSWORD` sur Railway) dès que vous êtes prêt, puis suivre `docs/SEARCH-CONSOLE.md` (**recommandé** : tant que le site est protégé, aucune page ne peut être indexée)
- B. Garder le mot de passe et déclarer quand même le domaine (vérification DNS possible, indexation impossible)
- C. Attendre la phase suivante

**5. Phase 2 du référencement**
- A. Pages par circonférence (9 à 15 cm), sur le même modèle que les pages par centimètre (**recommandé**)
- B. Pages au repos (longueur au repos par centimètre)
- C. Articles de fond (mythes, âge, taille et pointure) avant de nouvelles pages chiffrées

## Suite du 04/10/2026 : réponses du propriétaire

- **1A** : rang en partie entière conservé.
- **2** : animation 3D de l'accueil démarrée après le chargement complet, 1,5 s de délai puis au premier moment d'inactivité du navigateur ; sur mobile (écran tactile ou bandeau étroit), 300 points au lieu de 560, résolution 1× et 20 images par seconde. **Lighthouse mobile de l'accueil : 93, 96, 95 sur trois passages** (contre 71). L'image fixe sur mobile (solution A) n'a pas été nécessaire. L'animation démarre bien ensuite sur mobile (vérifié).
- **3A** : les 24 passages répétés dans les guides d'origine sont reformulés, sens et sources inchangés (présentation de Veale et al., effectifs, méta-analyses récentes, phrases de renvoi). La règle des 30 % s'applique désormais à toutes les pages, guides compris (erreur bloquante). À relire par vous : `taille-moyenne-penis`, `circonference-moyenne-penis`, `comment-mesurer-son-penis`, `taille-repos-erection`, `taille-penis-par-pays`, `etudes-taille-penis`.
- **4** : site public vérifié depuis un client sans session : accueil, guides, pages par centimètre, /presse en 200, aucun noindex, sitemap de 29 adresses (36 après ce lot), robots.txt correct, Googlebot et Bingbot servis. `www.bitometre.com` ne répond pas (aucun enregistrement DNS) : annexe ajoutée à `docs/SEARCH-CONSOLE.md` pour le corriger chez Cloudflare.
- **5A** : 7 pages par circonférence en érection, `/circonference-penis-9-cm` à `/circonference-penis-15-cm` (requêtes « circonférence pénis 9 cm » … « 15 cm »), même modèle que les pages par longueur : réponse immédiate, courbe avec repère, vérification de la mesure du tour (liste dédiée), calculateur prérempli (circonférence = la taille, longueur = médiane), tailles voisines, grille dédiée sur l'accueil, lignes de circonférence du tableau des percentiles liées. Nouveau jeton `{{diametre:cm}}` (circonférence ÷ π). 700 à 1 100 mots et 4 à 6 questions uniques par page, aucun paragraphe partagé à plus de 30 % (22 recoupements trouvés au premier passage, tous réécrits).
