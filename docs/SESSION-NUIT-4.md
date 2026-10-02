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
| 2 | Curseur interactif « Essayez » | à faire |
| 3 | Bandeau défilant d'informations vraies | à faire |
| 4 | Profils morphologiques (grille 3 × 3) | à faire |
| 5 | Animations | à faire |
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
