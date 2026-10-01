# Journal de la session de nuit n° 3

Règles : commit + push à la fin de chaque bloc ; `npm run verify` vert à chaque commit ; déploiement autorisé uniquement sur l'adresse de test Railway protégée par mot de passe ; aucun appel xAI, aucune photo réelle, aucun compte ouvert, aucun message envoyé, rien chez Cloudflare. Après une compaction du contexte : relire ce journal, docs/DECISIONS.md et docs/SPEC.md.

## Ouverture (avec le propriétaire) : FAIT
- Railway CLI 5.63.1 installé (`npm i -g @railway/cli`), connexion validée dans le navigateur : `railway whoami` = jvirybab12@gmail.com ; espace « fmanat's Projects » avec 3 projets préexistants (distinguished-emotion, alluring-integrity, adequate-contentment), non touchés.
- Informations de la Ltd (raison sociale, numéro Companies House, siège) : **laissées vides par le propriétaire**. Choix du propriétaire : marqueurs `[À COMPLÉTER : …]` visibles, avec un garde-fou qui bloque l'ouverture publique tant qu'il en reste (voir DECISIONS.md).
- Constat : le `.env` local **ne contient pas** `ADMIN_PASSWORD_HASH` (contrairement à ce qui était indiqué). Décision la plus prudente : générer un mot de passe d'administration aléatoire pour le site de test (voir Bloc 3).
- Base de départ : `npm run verify` vert (18 tests e2e).

## Bloc 1 : mode « bêta gratuite » : FAIT
- `FREE_BETA=on` : formule A seule, rapport débloqué sans paiement (mention « Bêta gratuite »), B/C/âge/captcha/paiement/CGV en 404, `/conditions` (conditions de la bêta), mentions légales au nom de la Ltd (marqueurs à compléter), confidentialité limitée à la bêta, accueil/pied de page/méthode/défi/sitemap adaptés. Code de paiement intact.
- Garde-fou : production + pas de `SITE_PASSWORD` + marqueurs `[À COMPLÉTER]` = 503 (`src/proxy.ts`, `src/lib/siteGate.ts`).
- Migration 006 (`free_beta`), purge à 90 jours des rapports bêta, `DB_POOL_MAX`, `/api/health`.
- Tests : 276 unitaires, 28 e2e (10 nouveaux, en mode bêta + mot de passe, port 3204). `verify` vert.
- Décisions : DECISIONS.md (section « Session de nuit n° 3 »). À noter : le `.env` n'avait pas d'empreinte d'administration.
- Commit : voir `git log` (« Bloc 1 (nuit 3) »).

## Bloc 2 : entonnoir de conversion : FAIT
- Événements anonymes (`funnel_events`, migration 007 ; défis dans `stat_events` ; paiements dans `payments`), route `/api/e`, composant `TrackView`, respect de DNT/GPC, robots écartés. Vue « Entonnoir de conversion » dans l'administration (7 j, 30 j, depuis le début, taux par étape et depuis l'accueil). Politique de confidentialité mise à jour (deux versions).
- Limite assumée : comptages d'événements, pas de visiteurs uniques.
- Tests : 286 unitaires, 31 e2e. `verify` vert.

## Bloc 3 : déploiement de test sur Railway : FAIT (vérification des tâches planifiées : voir la fin du journal)
- Projet `bitometre-test` (UE, Amsterdam) : `web` (0,5 vCPU / 0,5 Go), `Postgres` (18), `purge` (cron horaire), `stats` (cron quotidien, aucune URL de destination). Détails : `docs/RAILWAY.md`.
- Adresse de test : voir `RAILWAY_TEST_URL` dans `.env`. Identifiants du site : `RAILWAY_TEST_SITE_USER` / `RAILWAY_TEST_SITE_PASSWORD` ; administration : `RAILWAY_TEST_ADMIN_PASSWORD` (tous dans `.env`, jamais dans le dépôt).
- Variables : mode bêta, mot de passe, `DB_POOL_MAX=5`, secrets aléatoires. Migrations au démarrage (`preDeployCommand`). Point de santé `/api/health`.
- `npm run e2e:remote` : 6 tests passés sur le site déployé (401 sans identifiants, en-têtes de sécurité, routes masquées, parcours A, carte, défi, administration, mentions légales). Les rapports de test sont supprimés par le test lui-même.
- Incident : `railway.json` ne s'applique plus (Config as Code obsolète, refus d'un chemin de fichier par service) : la première mise en ligne n'a pas lancé les migrations (erreur « relation reports n'existe pas »), corrigé en posant les réglages dans le tableau de bord (API) et en redéployant. `railway.json` supprimé du dépôt.
- Écrits : `docs/RAILWAY.md`, `docs/OUVERTURE.md`, README, HEBERGEMENT.md (décision Railway), CLEVER-CLOUD.md (obsolète).

## Bloc 4 : adaptateur Verotel : FAIT
- `src/lib/payments/verotel.ts` : URL d'achat FlexPay signée, notifications signées (GET, réponse « OK »), événements `initial`, `credit` (remboursement), `chargeback` ; `/paiement/retour` + cookie fonctionnel ; migration 008 ; reverrouillage ; administration (remboursements). Désactivé tant que `VEROTEL_SHOP_ID` / `VEROTEL_SIGNATURE_KEY` sont vides.
- Clauses de Verotel citées dans `docs/PRESTATAIRES.md` (contrat type public lu directement). **Points bloquants possibles** : FlexPay réservé au compte Premium (6 mois de relevés exigés), art. 4 (vente de « content » soumise à accord écrit), aucune clause sur les sociétés britanniques.
- 32 tests Verotel (signature contre le jeu d'essai officiel, rejeu, signature invalide, montant incorrect, remboursement, contestation, purge à 30 jours, route GET). Total : 318 unitaires, 31 e2e. `verify` vert.
- Non vérifié : tout ce qui dépend de la documentation officielle FlexPay (voir « À CONFIRMER »).

## Bloc 5 : demandes à envoyer : FAIT (rien n'est envoyé)
- `docs/DEMANDES/` : `README.md` (récapitulatif, ordre conseillé, description commune) + un fichier par destinataire : `verotel.md`, `railway.md`, `ageverif.md` (français), `yoti.md`, `microsoft-photodna.md`, `xai.md`. Chacun : « nécessaire ou non pour le payant de la formule A » en tête (seule Verotel : OUI), canal d'envoi avec lien, objet, message prêt à copier signé au nom de la Ltd (marqueurs `[À COMPLÉTER]`), pièces à joindre, questions appelant une réponse écrite.
- Description honnête et complète du service dans chaque message (photos d'anatomie intime pour les formules photo, pas encore ouvertes, jamais stockées).
- Limites : Microsoft (PhotoDNA, accès refusé aux outils automatiques), x.ai et la console xAI : procédure et adresses non lues ; je n'ai inventé aucune adresse e-mail (un test le vérifie). Politique d'usage de Railway lue directement : « If you are unsure whether your use case is allowed, ask us before deploying. »
- Test : `tests/demandes.test.ts` (22 tests).

## Bloc 6 : feuille de route du payant : FAIT
- `docs/PASSAGE-PAYANT.md` : 15 étapes ordonnées (qui, dépendance, délai, chemin critique 6 à 10 semaines), dont l'**étape obligatoire 7 : sauvegardes quotidiennes de la base vérifiées (test de restauration) avant tout paiement** ; liste séparée pour les formules photo. Les délais sont des ordres de grandeur, non vérifiés.
- Ajout lié : `/api/payments/webhook` joignable sans mot de passe sur le site de test dès que `PAYMENT_PROVIDER=verotel` (signature vérifiée avant la base), testé.

## Bloc 7 : dossier pour le juriste : FAIT
- `docs/JURISTE.md` : 10 sujets demandés (contexte, questions, passages concernés) + section à part « bêta gratuite » (liste de contrôle B1 à B14 avant ouverture au public).
- Ajout lié : section « Cookies » dans la politique de confidentialité (bêta et payant).
- Test : `tests/docs-nuit3.test.ts`.
