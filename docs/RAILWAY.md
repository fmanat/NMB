# Hébergement sur Railway (site de test, bêta gratuite)

Mis en place pendant la session de nuit n° 3 (01/10/2026). Remplace Clever Cloud (voir `docs/HEBERGEMENT.md`). Rien ici n'est public : le site de test est protégé par mot de passe et n'est relié à aucun nom de domaine.

## Ce qui existe sur Railway

Projet **bitometre-test** (espace « fmanat's Projects », environnement `production`). Les trois autres projets de l'espace (distinguished-emotion, alluring-integrity, adequate-contentment) n'ont pas été touchés.

| Service | Rôle | Réglages |
|---|---|---|
| `web` | Le site Next.js (construction par Railpack, `npm run start`) | région **europe-west4 (Amsterdam)**, **0,5 vCPU / 0,5 Go** (limites posées à la main), point de contrôle `/api/health` (délai 120 s), redémarrage en cas d'échec (5 essais), migrations avant chaque démarrage (`node scripts/migrate.mjs`) |
| `Postgres` | Base PostgreSQL 18 de Railway | région Amsterdam, volume Railway ; connexion par le réseau privé (`postgres.railway.internal`) |
| `purge` | Tâche planifiée : `node scripts/purge.mjs`, **toutes les heures** (`0 * * * *`, UTC) | 0,5 vCPU / 0,5 Go, ne construit pas le site |
| `stats` | Tâche planifiée : `npx tsx scripts/stats-webhook.mts`, **une fois par jour** à 04 h 30 UTC | idem ; **aucune adresse de destination** (`STATS_WEBHOOK_URL` non défini) : le script n'envoie rien |

Adresse de test fournie par Railway : voir `RAILWAY_TEST_URL` dans votre `.env` local. Identifiants : `RAILWAY_TEST_SITE_USER` / `RAILWAY_TEST_SITE_PASSWORD` (protection du site) et `RAILWAY_TEST_ADMIN_PASSWORD` (page `/admin`), également dans `.env` (jamais dans le dépôt).

## Variables du service `web`

| Variable | Valeur | Remarque |
|---|---|---|
| `FREE_BETA` | `on` | mode bêta gratuite (formule A seule) |
| `SITE_PASSWORD`, `SITE_USER` | aléatoire (32 caractères), `bitometre` | protection de tout le site (authentification HTTP gérée par l'application). **Ne pas supprimer avant l'ouverture** (voir `docs/OUVERTURE.md`) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | référence vers le service Postgres (réseau privé) |
| `DB_POOL_MAX` | `5` | connexions simultanées de l'application à la base : prudent pour une base et un service de petite taille (la base de Railway accepte 100 connexions ; ce site n'a qu'une instance) |
| `SITE_URL` | l'adresse de test | à remplacer par `https://bitometre.com` à l'ouverture |
| `IP_HASH_SECRET`, `AGE_TOKEN_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `ADMIN_SESSION_SECRET` | aléatoires | |
| `ADMIN_PASSWORD_HASH` | empreinte scrypt du mot de passe d'administration | le `.env` local ne contenait pas d'empreinte à réutiliser : un mot de passe aléatoire a été généré (en clair dans `.env`, variable `RAILWAY_TEST_ADMIN_PASSWORD`) ; à remplacer par le vôtre avec `npm run admin:hash` |

Volontairement **absents** : `XAI_API_KEY` (aucun appel xAI), `STATS_WEBHOOK_URL`, `SEO_PUBLISH`, toute clé de paiement ou de vérification d'âge, `NODE_ENV` (Next.js le règle lui-même).

Les services `purge` et `stats` n'ont que `DATABASE_URL`.

## Pourquoi pas de `railway.json`

Railway a déclaré ce format « Config as Code » obsolète (fonctionne jusqu'au 01/12/2026) et refuse désormais de faire pointer un service vers un fichier particulier. Comme trois services partagent le même dépôt, un `railway.json` à la racine s'appliquerait aux trois. Les réglages ci-dessus sont donc posés dans le tableau de bord (API `serviceInstanceUpdate`). Pour les reproduire : le résumé des commandes est dans `docs/RAILWAY.md` (section suivante).

## Reproduire ou modifier l'installation (ligne de commande)

```bash
railway init -n bitometre-test -w "fmanat's Projects"
railway add --database postgres
railway add --service web          # idem pour purge et stats
railway domain -s web              # adresse de test fournie par Railway
railway up --service web           # déploie le dossier courant
```

Réglages d'un service (identifiants dans `railway status --json`) : `railway api 'mutation($e:String!,$s:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(environmentId:$e, serviceId:$s, input:$i) }' --var e=… --var s=… --var 'i={"cronSchedule":"0 * * * *", …}'` ; limites : `serviceInstanceLimitsUpdate` (`memoryGB`, `vCPUs`).

## Vérifications faites (voir le journal SESSION-NUIT-3.md)

Test de fumée : `npm run e2e:remote` (lit `.env`) joue : protection par mot de passe, en-têtes de sécurité, routes masquées, parcours A, carte de partage, défi, administration, mentions légales. Il supprime les rapports qu'il crée.

## Coûts (à surveiller)

Railway facture à l'usage (CPU, mémoire, volume, trafic sortant). Le plan de l'espace affichait au 01/10/2026 : consommation 4,29 $ sur la période, facture estimée 8,46 $, **aucune limite d'usage définie** (ni souple ni dure). Je n'ai pas modifié ce réglage de compte. Recommandation : définir une limite dure dans Railway (Settings → Usage) avant l'ouverture. Le site de test (3 services + base, 0,5 vCPU / 0,5 Go chacun, faible trafic) ajoute quelques dollars par mois ; voir le chiffre mesuré dans `docs/SESSION-NUIT-3.md`.

## Sauvegardes

**Aucune sauvegarde n'est activée** sur la base de test (restauration à un instant donné désactivée : elle exige un stockage objet supplémentaire). Étape **obligatoire avant tout paiement** : voir `docs/PASSAGE-PAYANT.md`.
