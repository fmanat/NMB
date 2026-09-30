# Mise en ligne sur Clever Cloud (préparation : rien n'est déployé)

Ce guide décrit ce qu'il faudra faire **après** avoir : (1) obtenu la confirmation écrite de Clever Cloud que le service est accepté (voir [HEBERGEMENT.md](HEBERGEMENT.md)), (2) fait relire les textes juridiques, (3) choisi et configuré les vrais prestataires ([PRESTATAIRES.md](PRESTATAIRES.md)). Chaque étape qui crée un compte ou un abonnement payant doit être validée par le propriétaire.

Ce qui est déjà prêt dans le dépôt :

| Élément | Fichier |
|---|---|
| Version de Node.js demandée (22 ou plus) | `package.json` (`engines`) |
| Outil `tsx` disponible en production (tâche quotidienne) | `package.json` (dépendances) |
| Lecture automatique de l'adresse de la base fournie par Clever Cloud (`POSTGRESQL_ADDON_URI`) si `DATABASE_URL` est vide | `src/lib/db.ts`, `scripts/migrate.mjs`, `scripts/purge.mjs` |
| Tâches planifiées : purge toutes les heures, webhook tous les jours à 4 h 30 | `clevercloud/cron.json`, `clevercloud/cron-purge.sh`, `clevercloud/cron-stats.sh` |
| Fins de ligne Unix pour les scripts shell | `.gitattributes` |
| Test automatique de cette configuration | `tests/deploy-config.test.ts` |

## Étapes (à faire par le propriétaire, pas à pas)

1. **Créer l'application** dans la console Clever Cloud : type « Node.js », liée au dépôt GitHub `fmanat/NMB` (la console propose de connecter GitHub), branche `main`. Choisir une taille d'instance modeste pour commencer (à augmenter si les analyses de photo sont lentes : le calcul se fait en mémoire).
2. **Créer le module PostgreSQL** (version 17 si proposée) et le **lier à l'application** : Clever Cloud ajoute alors automatiquement des variables dont `POSTGRESQL_ADDON_URI`. Le site les lit tout seul : inutile de remplir `DATABASE_URL`.
3. **Renseigner les variables d'environnement** de l'application (onglet « Variables d'environnement ») :

   | Variable | Valeur |
   |---|---|
   | `CC_RUN_COMMAND` | `npm run start` |
   | `PORT` | `8080` |
   | `HOSTNAME` | `0.0.0.0` |
   | `CC_PRE_RUN_HOOK` | `node scripts/migrate.mjs` (applique les migrations de la base avant chaque démarrage) |
   | `SITE_URL` | l'adresse publique en https (**obligatoire avant la construction** : elle règle la politique de sécurité) |
   | `IP_HASH_SECRET`, `AGE_TOKEN_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `ADMIN_SESSION_SECRET` | quatre longues chaînes aléatoires, différentes (32 caractères ou plus) |
   | `ADMIN_PASSWORD_HASH` | fabriqué avec `npm run admin:hash -- "votre mot de passe"` sur votre ordinateur |
   | `VISION_PROVIDER` | `xai` |
   | `XAI_API_KEY` | la clé xAI |
   | `XAI_EFFORT` | `low` |
   | `PAYMENT_PROVIDER`, `AGE_PROVIDER`, `SCREENING_PROVIDER`, `CAPTCHA_PROVIDER` | les vrais prestataires choisis (voir PRESTATAIRES.md) ; **jamais** `simulation` ni `off` |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` · `AGEVERIF_CLIENT_ID`, `AGEVERIF_CLIENT_SECRET` · `ALTCHA_HMAC_KEY` | variables des adaptateurs prêts (voir `.env.example`) ; **Stripe** : déclarer l'adresse `SITE_URL/api/payments/webhook` ; **AgeVerif** : déclarer l'adresse de retour `SITE_URL/api/age/callback` |
   | `SEO_PUBLISH` | vide tant que les guides n'ont pas été relus ; `on` ensuite (puis redéployer) |
   | `STATS_WEBHOOK_URL`, `STATS_WEBHOOK_SECRET` | facultatifs |

   **Ne pas définir `NODE_ENV`** : Next.js le règle lui-même, et le définir pourrait empêcher l'installation des outils de construction.
4. **Associer le nom de domaine** (console Clever Cloud) et configurer le DNS chez le registraire. Le certificat https est fourni par Clever Cloud (à vérifier au moment de la mise en place).
5. **Déployer** : la console construit (`npm run build` est lancé automatiquement par le mode Node.js de Clever Cloud pour une application Next.js ; sinon ajouter `CC_POST_BUILD_HOOK=npm run build`), applique les migrations, puis démarre.
6. **Vérifier les tâches planifiées** : Clever Cloud lit `clevercloud/cron.json` au déploiement. Après le premier déploiement, consulter les journaux de l'application le lendemain matin (la purge écrit « Rapports non payes effaces… » chaque heure).
7. **Contrôles avant d'ouvrir au public** : paiement en mode test du prestataire, vérification d'âge, `/admin`, `npm run seo:check -- --urls` sur l'adresse publique, en-têtes de sécurité.

## Points à confirmer au premier déploiement (non vérifiés ici)

- La variable `POSTGRESQL_ADDON_URI` existe bien sous ce nom (la documentation de Clever Cloud sur les modules PostgreSQL la décrit ; à confirmer dans l'onglet « Informations » du module).
- L'étape de construction automatique pour Next.js et le nom exact des variables de hooks (`CC_PRE_RUN_HOOK`, `CC_POST_BUILD_HOOK` : documentées par Clever Cloud, voir [Deployment Hooks](https://www.clever.cloud/developers/doc/develop/build-hooks/)).
- Les tâches planifiées s'exécutent avec les variables d'environnement de l'application (documenté comme tel par Clever Cloud) et le répertoire de travail est réglé par les scripts.
- Un seul serveur est supposé : le limiteur de connexions de l'administration est en mémoire. Avec plusieurs instances il faudra le déplacer en base.
