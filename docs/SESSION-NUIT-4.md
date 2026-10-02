# Journal de la session de nuit n° 4

Démarrée le 02/10/2026 à 22:07 (Europe/Paris), environ 8 h, autonome, **aucune question posée**. `caffeinate` lancé pour 9 h.
Après une compaction du contexte : relire ce journal, `docs/DECISIONS.md`, `CLAUDE.md` et `docs/SPEC.md`.

## Règles (du propriétaire)
- Dépôt à jour depuis GitHub au départ. Journal mis à jour à la fin de chaque bloc. Commit + push à la fin de chaque bloc, **`npm run verify` vert à chaque commit**.
- Problème qui résiste à 3 tentatives : le consigner ici, annuler les modifications en cours du bloc, passer au suivant.
- **Déploiement sur bitometre.com : uniquement aux blocs 0 et 9**, si `verify` est vert, suivi du test de fumée public (`RAILWAY_TEST_URL=https://bitometre.com npx playwright test -c playwright.remote.config.ts --grep-invert "protection par mot de passe|administration : connexion"`). Test en échec : redéployer la version précédente. Déploiement : `railway up -s web --ci` (le service n'est relié à aucun dépôt).
- **Interdits** : activer la formule photo sur le site public, utiliser une photo réelle, dépenser plus de 0,50 $ en appels xAI (images neutres fabriquées uniquement), ouvrir un compte, envoyer un message, inventer un chiffre affiché, représenter une anatomie.
- Décision non couverte : l'option la plus prudente, notée dans `docs/DECISIONS.md`.
- Dérogation de charte (bloc 1 seulement) : 3D et fond sombre autorisés pour le bandeau « scanner » en tête de l'accueil ; le reste du site reste clair.

## Blocs
| Bloc | Sujet | État |
|---|---|---|
| 0 | Limite par IP derrière Cloudflare | FAIT (avant la session, avec le propriétaire) |
| 1 | Bandeau scanner 3D | FAIT |
| 2 | Curseur interactif « Essayez » | FAIT |
| 3 | Bandeau défilant d'informations vraies | FAIT |
| 4 | Profils morphologiques (grille 3 × 3) | FAIT |
| 5 | Animations | FAIT |
| 6 | Formule photo en bêta, réponse standardisée (PHOTO_BETA, désactivée) | à faire |
| 7 | Kit de test photo (`docs/TEST-PHOTO.md`) | à faire |
| 8 | Vérification d'âge branchée (`docs/ACTIVATION-PHOTO.md`) | à faire |
| 9 | Déploiement, test de fumée, captures, Lighthouse | à faire |

## Bloc 0 : limite par IP derrière Cloudflare : FAIT
- Constat mesuré en production : via Cloudflare, `x-forwarded-for` commençait par une adresse Cloudflare (partagée) ; en accès direct Railway écrase `x-forwarded-for` et `x-real-ip` mais laisse passer `cf-connecting-ip` (falsifiable).
- `src/lib/clientIp.ts` : `cf-connecting-ip` lu uniquement si la connexion vue par l'hébergeur est dans les plages publiées par Cloudflare ; repli sur `x-real-ip`, puis `x-forwarded-for` (local), puis « inconnue ». Utilisé par `analyse/actions.ts`, `admin/actions.ts`, `api/analyse/route.ts`. 11 tests (`tests/client-ip.test.ts`).
- Vérifié sur bitometre.com : l'IPv4 du propriétaire a atteint la limite de 5 par 24 h tandis que son IPv6 (même nœud Cloudflare) passait encore : le compteur est par visiteur.
- Commit : `7c8fad1`.

## Bloc 1 : bandeau « scanner » 3D : FAIT
Dérogation de charte (3D, fond sombre) appliquée à ce seul bandeau ; le reste de l'accueil et du site reste clair.

**Ce qui est fait**
- Nuage de points d'un **cylindre géométrique abstrait** (court, bases plates, aucun détail évoquant un organe : hauteur 1,7 pour un diamètre 2), 5 anneaux de mesure (les deux extrêmes plus larges), axe central, **plan de balayage** qui monte et descend (période 6,4 s), rotation automatique lente (un tour en environ 28 s), rotation au doigt/à la souris (événements pointeur ; la souris incline aussi, le doigt ne fait tourner qu'horizontalement car `touch-action: pan-y` laisse la page défiler).
- Autour : les valeurs de l'exemple (`exampleReport()`, valeurs existantes uniquement : longueur 13,8 cm, circonférence 11,9 cm, percentiles, courbure 15°, score), badge « Exemple · valeurs fictives » en bas du bandeau.
- **Chargement différé** : la coque client (`ScannerShell`, quelques centaines d'octets) attend l'événement `load` puis un instant de repos (`requestIdleCallback`, 3 s au plus), puis importe dynamiquement le moteur (fichier de 3,8 Ko compressé, mesuré). Aucune dépendance ajoutée : canvas 2D et projection 3D maison.
- **Repli** : SVG statique calculé sur le serveur (même scène, même géométrie) présent dès le premier rendu ; il reste affiché sans JavaScript, sans canvas 2D, ou si le chargement du moteur échoue. Le canevas et le SVG sont `aria-hidden` ; les valeurs sont du texte réel ; une phrase réservée aux lecteurs d'écran décrit l'illustration.
- **Mouvement réduit** (`prefers-reduced-motion: reduce`) : aucune boucle d'animation, aucune inertie ; image fixe (plan figé), redessinée seulement pendant un glissement (aucune animation continue ne se lance). Réagit aussi à un changement de préférence en cours de visite.
- **Économie** : boucle suspendue hors écran (IntersectionObserver) et onglet masqué ; 30 images/s au plus ; tracé par lots (un remplissage par niveau de profondeur) ; 460 points (petit bandeau) ou 800 ; résolution du canevas plafonnée à 2.
- Disposition : mobile = bandeau pleine largeur entre le texte et les boutons (ordre de la section 31 du DS-01) ; ordinateur = colonne de droite, à la place de l'ancien aperçu de rapport. La carte « aperçu compact » (mobile) et l'aperçu complet (ordinateur) du hero sont **remplacés** par le bandeau ; le rapport complet reste plus bas (`#exemple`).

**Fichiers** : `src/lib/scanner3d.ts` (logique pure : graine, points, anneaux, projection, balayage), `src/components/scanner/ScannerBand.tsx` (serveur : valeurs, repli SVG), `ScannerShell.tsx` (client : chargement différé), `scannerEngine.ts` (dessin et pointeur, chargé dynamiquement), `src/app/page.tsx`, `tests/scanner3d.test.ts` (16 tests unitaires), `e2e/scanner.spec.ts` (11 tests : sans JavaScript, moteur indisponible, chargement différé, animé et glissement, mouvement réduit, 320/375/390 px avec détecteur de mise en page et axe-core sur fond sombre, axe sur l'accueil entière), `e2e/mobile.spec.ts` (« Premier écran de l'accueil » adapté : le bandeau précède le bouton, qui reste entièrement visible à 390×844, 375×700, 360×740).

**Lighthouse mobile** (accueil, site compilé `next build` + `next start`, Chromium de Playwright, simulation mobile par défaut, 5 passages) : performance **92, 95, 95, 95, 95** ; accessibilité 100 ; bonnes pratiques 100 ; CLS 0 ; FCP 0,9 à 1,0 s ; LCP 2,8 s (c'est le titre `h1`, pas le bandeau) ; TBT 70 à 190 ms. Première version (sans tracé par lots ni plafond d'images) : 49, 80, 95 selon la charge de la machine (TBT jusqu'à 3,7 s) : le tracé point par point coûtait trop sous ralentissement processeur, d'où l'optimisation. Mesure de séquence sur le site compilé : le fichier du moteur est demandé après `load`.

**Limites / à savoir**
- Le serveur de test local (base `nmb` ou `nmb_test`) ne répond pas aux requêtes qui touchent la base dans ce contexte d'exécution (les routes `/api/stats` et `/api/e` pendent environ 60 s avant l'échec, puis l'accueil continue) : pour mesurer, le serveur de production local a été lancé avec une base volontairement injoignable (`DATABASE_URL` pointant sur un port fermé), ce qui n'influence pas l'accueil statique. À ne pas confondre avec un défaut du bandeau.
- Le repli SVG n'est pas à l'échelle exacte du canevas sur mobile (le SVG se met à la hauteur du bandeau ; le canevas tient compte des colonnes de valeurs) : léger saut à la bascule.
- Le glissement au doigt ne fait tourner qu'horizontalement (choix : ne pas bloquer le défilement vertical de la page).
- Aucun essai sur un vrai téléphone ni un vrai lecteur d'écran (Chromium de Playwright et axe-core seulement).

## Bloc 2 : section « Essayez » (curseurs) : FAIT
**Ce qui est fait**
- Section `#essayez` juste sous le hero : curseurs natifs (`input type=range`, libellés « Longueur (cm) » et « Circonférence (cm) », valeur affichée et lue par `aria-valuetext`, bornes du questionnaire 2 à 30 cm et 3 à 25 cm, pas de 0,1 cm), choix « Au repos » / « En érection » (références du site), bouton « Revenir à l'exemple ». Valeurs de départ = rapport d'exemple (13,8 cm, 11,9 cm, en érection), badge « Exemple · valeurs fictives » tant qu'on n'y touche pas.
- Mise à jour en direct, dans le navigateur uniquement : encadrés « Au-dessus de X % », barres de percentile, courbes de distribution, repères de taille (objets du quotidien et monuments), tous produits par les vraies fonctions (`buildQuestionnaireReport`) et affichés par les composants du rapport. Mention « Simulation locale : rien n'est enregistré ni envoyé. » et bouton vers le vrai questionnaire. Valeur hors plage plausible : aucun résultat, message du questionnaire.
- Aucune requête, aucun WebSocket, aucun cookie ni stockage (vérifié par test e2e et par un test d'analyse des imports : seule dépendance, React).
- Mouvement réduit : aucune animation ni transition dans la section (règle globale, testée).

**Refactorisation sans changement de résultat** : `src/lib/reportCore.ts` (calculs, types, `OUT_OF_RANGE_MESSAGE`, sans zod) ; `report.ts` (schéma zod + ré-export) ; `src/components/report/ReportParts.tsx` (extrait de `ReportDashboard`) ; `choiceStyles.ts` (style des choix radio partagé avec le questionnaire) ; `globals.css` : les champs `range` sont exclus du style de champ de texte. Contrôle : HTML du tableau de bord et objets de résultat de 36 rapports (2 états, 6 couples, 3 courbures, avec et sans « exemple ») identiques octet pour octet avant et après.

**Fichiers** : `src/lib/tryIt.ts` (bornes, valeurs de départ, `simulate`), `src/components/try/TrySection.tsx` (serveur), `TryItLoader.tsx` (client, chargement différé), `TryIt.tsx` (client, interactif), `src/app/page.tsx`, `tests/try-it.test.ts` (34 tests : équivalence avec la chaîne du questionnaire pour 22 couples repos/érection, bornes, extrêmes, `snap`, composants identiques à ceux du rapport, aucune requête ni stockage ni dépendance serveur dans la fermeture des imports, import dynamique), `e2e/essayez.spec.ts` (13 tests : contenu et mention, clavier, repos/érection, plusieurs couples comparés aux fonctions du site, extrémités, aucune requête/WebSocket/cookie/stockage, chargement différé, mouvement réduit, 320/375/390 px avec détecteur de mise en page et axe-core dans quatre états, axe sur l'accueil entière).

**Lighthouse mobile** (accueil, site compilé, 5 passages) : performance **92, 95, 95, 95, 95** (identique au bloc 1) ; accessibilité 100 ; bonnes pratiques 100 ; CLS 0 ; TBT 70 à 190 ms. La simulation (13,6 Ko non compressés) n'est demandée qu'au défilement : vérifié, absente du chargement initial à 412 × 823.

**Limites / à savoir**
- La simulation exige JavaScript (mention `noscript`) ; le questionnaire, lui, fonctionne sans.
- Sur ordinateur, la zone reste vide (« Chargement… ») tant qu'elle n'est pas à 15 % dans l'écran : bref message, hauteur réservée.
- Curseur à la souris : la plage 2 à 30 cm est large (la plage plausible est plus étroite) ; hors plage, le message remplace les résultats (la page se raccourcit alors).
- Aucun essai sur un vrai téléphone ni lecteur d'écran. L'annonce vocale (percentiles) est différée de 0,6 s pour ne pas parler à chaque cran.

## Bloc 3 : bandeau défilant d'informations vraies : FAIT
**Ce qui est fait**
- Bandeau sobre (style clair, fond `--bm-blue-050`) **sous le hero**, avant la section « Essayez » ; le hero et le bouton principal ne bougent pas. Il remplace l'ancien bandeau de statistiques de l'en-tête (`Ticker.tsx`, qui interrogeait `/api/stats` depuis le navigateur sur toutes les pages) : composant, route `/api/stats`, `publicStats` et `globalStats` supprimés.
- Éléments, tous dérivés d'une source (aucun chiffre écrit en dur) :
  1. « Bêta gratuite » : seulement si `isFreeBeta()` ;
  2. « Longueur médiane de référence, en érection 13,12 cm, Veale et al., BJU Int., 2015 » : valeur lue par `referenceFor("erect", "length")` (constantes `REFERENCES` de `site.ts`, via `stats.ts`), source = constante `REFERENCE_SOURCE`. Un test vérifie que c'est bien une médiane pour la loi du site (percentile 50 en ce point) ;
  3. « Mesures dans chaque rapport 4 (longueur, circonférence, courbure, score) » : compte des clés `REPORT_MEASURES` (typées sur `keyof ReportResults`) présentes dans le rapport construit par le site ; un test e2e vérifie l'égalité avec le nombre de cartes de « Ce que mesure le rapport » ;
  4. « Version du 2 octobre 2026 » : date de construction réelle, `next.config.ts` (clé `env`, `BITOMETRE_BUILD_DATE`) calculée au `next build` (au démarrage de `next dev`), formatée en français (fuseau Europe/Paris). Date absente ou invalide : l'élément disparaît ;
  5. « Analyses réalisées N » et « Score moyen X sur 100 » : **seulement si N est strictement supérieur à `TICKER.analysesThreshold` (500)** : 500 n'affiche rien, 501 affiche. Base indisponible, lente (plus de 1,5 s) ou réponse incohérente : les deux éléments n'apparaissent pas, le reste du bandeau est intact.
- **Définition du compteur (la plus prudente)** : lignes du journal anonyme `report_log` dont le rapport a été **débloqué** (bêta gratuite, ou payé et non remboursé), tous protocoles. Un rapport créé mais jamais débloqué n'est pas compté. Le journal survit à la suppression et à la purge : une analyse réalisée reste comptée, le chiffre ne baisse pas quand un visiteur efface son rapport. Aucune donnée personnelle : un entier et une moyenne. (L'ancienne définition, photo payée seulement, n'aurait jamais pu s'afficher pendant la bêta gratuite, qui ne produit que des rapports du questionnaire.)
- **Fraîcheur du compteur sans appel réseau côté client** : l'accueil reste statique mais est **régénéré toutes les 5 minutes** (`export const revalidate = 300`, valeur littérale exigée par Next.js ; un test la borne entre 60 et 900). Le serveur lit la base à la construction puis à chaque régénération, avec mémoire de 60 s (30 s après un échec), délai maximal de 1,5 s et lectures simultanées partagées (`src/lib/tickerStats.ts`). Vérifié sur le site compilé : compteur de la construction (600), puis après le délai, la page servie en cache puis régénérée affiche 650 ; avec une base injoignable à la construction et à l'exécution, la page se construit et se régénère sans les deux éléments. Aucun JavaScript, aucune requête du navigateur pour le bandeau (test e2e).
- **Défilement** : CSS pur (`translateX` sur une piste de deux copies identiques, 55 s la boucle, chaque copie au moins aussi large que l'écran, bords fondus par un masque). **Pause** au survol, au focus clavier dans le bandeau et par une case « Pause » réelle (WCAG 2.2.2, sans JavaScript). **Mouvement réduit** : plus de défilement, plus de copie, plus de case ; la liste réelle devient visible, statique, sur plusieurs lignes (éléments qui passent à la ligne). Lecteurs d'écran : **une seule liste réelle** (`ul`, masquée visuellement par la technique « sr-only » hors mouvement réduit) ; le défilement visuel, avec ses deux copies, est entièrement `aria-hidden`. Les règles de mouvement réduit sont dans `globals.css` (non dans des classes Tailwind : une règle hors couche l'emporte sur les utilitaires).
- **Détecteur de mise en page (`e2e/layout.ts`)** : il traitait à tort comme visible le texte d'éléments imbriqués dans une boîte « sr-only » de 1 px. Corrigé dans le détecteur (contenu rogné à 1 px × 1 px ignoré) avec un test de sensibilité (`e2e/mobile.spec.ts`) : le même texte rendu visible reste signalé.

**Fichiers** : `src/lib/ticker.ts` (construction de la liste, pure), `src/lib/tickerStats.ts` (lecture serveur non bloquante), `src/lib/repo.ts` (`completedAnalysisStats`), `src/components/ticker/TickerBand.tsx` (présentation) et `InfoTicker.tsx` (serveur), `src/app/page.tsx`, `src/app/globals.css`, `src/config/site.ts` (`REFERENCE_SOURCE`, `TICKER`), `next.config.ts`, `playwright.config.ts` (`TICKER_STATS_TTL_MS=0` pour les sites de test), `tests/ticker.test.ts` (42 tests), `e2e/bandeau-common.ts` + `bandeau.spec.ts` (version payante) + `bandeau-beta.spec.ts` (bêta) : 21 tests chacun.

**Tests** : unitaires (chaque élément présent ou absent selon sa condition, seuil aux bornes 0, 499, 500, 501, base indisponible ou lente ou incohérente, valeurs identiques aux constantes, mémoire et échec, rendu HTML, choix de rendu de l'accueil) ; base de test remplie par SQL (500 puis 501 lignes, rapports non débloqués jamais comptés) ; e2e : contenu, bornes 500/501 sur une vraie base, date, nombre de mesures, rendu serveur sans requête, lecteurs d'écran (une liste, pas de doublon), défilement et pause (survol, focus, case), mouvement réduit, 320/375/390/1280 px dans les deux modes de mouvement (détecteur de mise en page, recouvrement des éléments défilants, axe-core sur le bandeau), axe-core sur l'accueil entière.

**`npm run verify`** : vert (456 tests unitaires, 132 tests de bout en bout).

**Lighthouse mobile** (accueil, site compilé avec une base joignable et 650 analyses de test, donc le bandeau complet à six éléments, 5 passages) : performance **93, 96, 96, 92, 94** ; accessibilité 100 ; bonnes pratiques 100 ; CLS 0 ; LCP 2,7 à 3,0 s (le titre) ; TBT 70 à 230 ms. Même plage que les blocs 1 et 2.

**Limites / à savoir**
- Le compteur apparaît au plus tard 5 minutes après avoir dépassé le seuil (et la première page servie après un déploiement est celle construite au `next build`, avec le compteur de ce moment-là si la base répond à la construction).
- « Version du » est la date du dernier **build**, ce qui coïncide avec le déploiement par `railway up` (le build se fait au déploiement). Dans les tests et en développement, c'est la date de démarrage du serveur.
- La médiane affichée est la moyenne de référence de Veale et al. (le site suppose une loi normale, donc médiane = moyenne) ; le commentaire de `REFERENCES` dit toujours « à vérifier sur l'article avant mise en ligne » : cette vérification reste à faire par le propriétaire.
- Dans ce contexte d'exécution, un processus détaché (`nohup`) n'arrive pas à joindre PostgreSQL (la connexion pend) : c'est ce qui a servi, par hasard, à vérifier que la page se construit et se régénère quand la base ne répond pas. Les serveurs lancés par Playwright, eux, joignent la base.
- Aucun essai sur un vrai téléphone ni lecteur d'écran.

## Bloc 4 : profils morphologiques (grille 3 × 3) : FAIT
**Ce qui est fait**
- **Module unique** `src/lib/profiles.ts` (pur, sans zod ni serveur, réutilisable par les rapports photo du bloc 6) : seuils nommés (`LOW_BELOW = 33`, `HIGH_FROM = 67`), `classOf`, les neuf `PROFILES` (identifiant stable `l<rang longueur>c<rang circonférence>`, nom, une phrase), `profileFor(percentileLongueur, percentileCirconférence)`, `profileById`. Règle unique aux deux axes : chaque classe contient sa borne basse (moins de 33 / de 33 inclus à 67 exclu / 67 ou plus) ; le percentile est d'abord arrondi à une décimale comme dans le rapport, donc le profil correspond à ce qui est affiché. Valeur non finie : erreur (jamais un profil au hasard).
- **Les neuf profils** (longueur en lignes, circonférence en colonnes) : L'Épuré, Le Compact, Le Concentré / L'Élancé, Le Centré, L'Ample / Le Longiligne, L'Étendu, Le Panoramique. Ton de laboratoire pince-sans-rire, aucune case n'est présentée comme meilleure ou moins bonne, aucun chiffre, aucune promesse, aucune fréquence annoncée. Texte complet dans `docs/DECISIONS.md` et dans le module.
- **Rapport** (`/r/[id]`) et **exemple de l'accueil** (marqué « Exemple fictif ») : carte « Profil morphologique » (`ProfileCard`) insérée dans `ReportDashboard` après la carte du score : nom, phrase, repère géométrique de la case (neuf carrés, un plein, `aria-hidden`), lien vers la méthode. Rien dans l'aperçu verrouillé de la version payante. L'exemple (13,8 cm × 11,9 cm en érection) tombe dans « Le Centré ». Pas ajouté à la simulation « Essayez » (non demandé).
- **Carte de partage** : case « Ajouter mon profil morphologique » sur la page de partage, **décochée par défaut** ; la carte ne contient le champ `profile` (identifiant seul) que si elle est cochée ; la page publique et les deux images (1200 × 630, 1080 × 1920) montrent alors une ligne « Profil : <nom> » ; jamais dans les métadonnées Open Graph/Twitter ni dans le titre. **Rétrocompatibilité** : la colonne `cards.content` est déjà du jsonb, le champ est facultatif, aucune migration (la prochaine migration reste 009) ; les cartes déjà créées et un identifiant inconnu s'affichent comme avant (rien).
- **Page méthode** : section « Profils morphologiques » (`#profils`) avec l'explication des seuils (valeurs lues dans les constantes) et la grille complète : tableau accessible (légende, en-têtes de colonne et de ligne) sur écran large, liste groupée par classe de longueur sur mobile.

**Fichiers** : `src/lib/profiles.ts`, `src/lib/share.ts`, `src/lib/cardImage.tsx`, `src/components/report/ProfileCard.tsx`, `ProfileTable.tsx`, `ReportDashboard.tsx`, `src/app/c/[id]/page.tsx`, `src/app/r/[id]/partager/page.tsx`, `src/app/r/[id]/actions.ts`, `src/app/methode/page.tsx`, `tests/profiles.test.ts` (66 tests), `tests/share.test.ts` (+1), `e2e/profils-beta.spec.ts` (11 tests), `e2e/profils.spec.ts` (2 tests).

**Tests** : unitaires (bornes exactes 32,9 / 33 / 66,9 / 67 et arrondi à une décimale, neuf cases uniques et atteignables par des percentiles possibles et par de vrais rapports au repos et en érection, monotonie, ni chiffre ni nombre en lettres ni mot de la liste de termes vulgaires, dénigrants, médicaux ou anatomiques, une seule phrase, noms uniques, test de sensibilité de la liste, indépendance vis-à-vis de la courbure, profil de l'exemple, contenu de la carte avec et sans option) ; e2e (neuf couples de valeurs donnent les neuf profils attendus ; exemple de l'accueil ; carte sans option identique d'une création à l'autre et sans trace du profil, avec option : nom visible, description et métadonnées sans profil, images à la bonne taille et différentes ; anciennes cartes et identifiant inconnu ; page méthode en tableau et en liste ; 320/375/390 px avec le détecteur de mise en page et axe-core ; axe-core sur écran large ; version payante : aucun profil avant paiement).

**`npm run verify`** : vert (523 tests unitaires, 145 tests de bout en bout).

**Constaté pendant les tests** : la liste de mots interdits a signalé « bonne » dans une première phrase (« une bonne note de synthèse ») : réécrite. axe-core a signalé un contraste insuffisant du lien « Voir les neuf profils » sur fond bleuté : couleur du lien assombrie (`--bm-blue-700`).

**Limites / à savoir**
- Les noms et phrases ont été relus pour un lecteur aux percentiles bas, mais restent un jugement éditorial à faire valider par le propriétaire.
- Les seuils 33 et 67 découpent la population en classes de taille inégale (un peu moins d'un tiers, un peu plus d'un tiers, un tiers) ; le site n'affiche aucune statistique sur la fréquence des profils.
- Un rapport de la formule photo (désactivée) afficherait aussi un profil, calculé de la même façon sur ses percentiles estimés.

## Bloc 5 : animations des anneaux, barres et courbes : FAIT
**Ce qui est fait**
- Les animations existantes (anneau et barres qui jouaient dès le chargement, même hors écran) sont remplacées par des animations **à l'apparition**, une seule fois. `src/components/RevealOnView.tsx` (client, monté une fois dans la mise en page, environ 1 Ko) : un `IntersectionObserver` (seuil 15 %) pose `data-reveal="run"` sur les éléments marqués `data-reveal-on-view` quand ils entrent à l'écran (`pending` s'ils sont encore hors écran, ce qui prépare l'état de départ sans flash visible), puis `data-animated="done"` quand toutes leurs animations sont finies (`getAnimations().finished`). Un `MutationObserver` prend en charge la simulation « Essayez », chargée au défilement. Les éléments ne sont observés qu'une fois : pas de rejeu.
- CSS (`globals.css`, variables de la section 37 déjà présentes, vérifiées par `tests/reveal-css.test.ts`) : anneau de score (arc qui se remplit, 700 ms), barres de percentile (remplissage, 700 ms ; repère en fondu en fin de course), courbes de distribution (tracé du contour via `pathLength="1"`, 700 ms ; aire en fondu 400 ms ; repère de l'utilisateur en fondu), indicateur de courbure (arc tracé, repère en fondu). Seules propriétés animées : `stroke-dashoffset`, `transform` (échelle), `opacity` : aucun décalage de mise en page. Tous les textes (valeurs, étiquettes SVG « Vous : … ») ne sont jamais masqués.
- Les animations ne sont déclarées que sous `[data-reveal="run"]` : **sans JavaScript, ou si le script échoue, aucune règle ne les déclenche ni ne masque quoi que ce soit** (valeur finale du HTML serveur). `pending` ne masque que des tracés et marqueurs hors écran.
- **Mouvement réduit** : le composant ne fait rien et la CSS force `animation: none`, `transition: none`, valeurs finales (aucune animation CSS en cours, vérifié par `getAnimations()`).
- **« Essayez »** : un changement de valeur suit une transition de `--duration-normal` (200 ms) sur l'arc, la largeur de barre et la position du repère ; l'animation d'apparition ne rejoue pas (aucune `CSSAnimation` après des mouvements de curseur, testé).
- Cartes de partage (images générées côté serveur) : inchangées, statiques.

**Fichiers** : `src/components/RevealOnView.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/report/{ScoreRing,PercentileBar,DistributionChart,CurvatureIndicator}.tsx`, `tests/reveal-css.test.ts` (4), `e2e/animations.spec.ts` (8 : lecture puis état terminé et valeurs exactes, une seule exécution, mouvement réduit, sans JavaScript, « Essayez », 320/375/390 px avec détecteur de mise en page et axe-core). Les e2e existants n'ont pas été modifiés.

**`npm run verify`** : vert (527 tests unitaires, 153 tests de bout en bout).

**Lighthouse mobile** (accueil, site compilé `next build` + `next start`, base volontairement injoignable, Chromium de Playwright, 5 passages) : performance **94, 96, 96, 96, 96** ; accessibilité 100 ; bonnes pratiques 100 ; CLS 0 ; LCP 2,7 à 2,8 s ; TBT 70 à 160 ms.

**Limites / à savoir**
- Sur un élément déjà entièrement visible au chargement, l'animation démarre après l'hydratation (le HTML serveur affiche d'abord la valeur finale, puis l'arc se redessine : bref rejeu possible, non ajouté d'état masqué pour éviter tout flash de contenu).
- Aucun essai sur un vrai téléphone.
