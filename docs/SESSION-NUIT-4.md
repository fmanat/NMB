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
| 1 | Bandeau scanner 3D | à faire |
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
