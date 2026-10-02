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

## Bloc 8 : accessibilité puis petits écrans : FAIT
- Accessibilité : axe-core (WCAG 2.0 à 2.2 A et AA + bonnes pratiques) sur toutes les pages des deux modes, plus tests clavier (lien d'évitement, fenêtre d'âge, focus visible de 3 px, noms accessibles), structure (repères, titres, navigations nommées, tableaux), mouvement réduit. Corrections : voir `docs/DECISIONS.md` (section « Bloc 8 »). **Limite : pas d'essai avec un vrai lecteur d'écran.**
- Petits écrans 320 / 375 / 390 px : détecteur de recouvrement, de texte coupé et de débordement (`e2e/layout.ts`, validé par un test de sensibilité) sur toutes les pages et plusieurs états, bêta et payant : **aucun défaut réel trouvé** ; deux fausses alertes corrigées dans le détecteur.
- Un test instable corrigé (titre de page diffusé en flux par Next.js : le test attend désormais le titre).
- Tests : 350 unitaires, 62 e2e. `verify` vert (7,4 minutes).

---

# RAPPORT FINAL de la session de nuit n° 3 (01-02/10/2026)

## Site de test
- **Adresse** : https://web-production-a03fb.up.railway.app (adresse fournie par Railway, région UE Amsterdam). Aucun nom de domaine relié, rien chez Cloudflare.
- **Identifiants** : dans votre fichier `.env` local (ignoré par git) : `RAILWAY_TEST_URL`, `RAILWAY_TEST_SITE_USER` / `RAILWAY_TEST_SITE_PASSWORD` (fenêtre « identifiants requis » du navigateur), `RAILWAY_TEST_ADMIN_PASSWORD` (page `/admin`). Le `.env` ne contenait **pas** d'empreinte d'administration à réutiliser : mot de passe d'administration généré aléatoirement.
- État : en ligne, 4 services (web, Postgres, purge, stats), bêta gratuite, protégé par mot de passe. Dernier déploiement du code : `a7d5598` (le script de remise à zéro, ajouté ensuite, n'est pas déployé).

## Commits (tous poussés sur GitHub, `verify` vert à chacun)
| Bloc | Commit |
|---|---|
| 1 Bêta gratuite | `f580410` (+ journal `92c2825`) |
| 2 Entonnoir | `952f34a` |
| 3 Déploiement Railway | `ee50208` |
| 4 Adaptateur Verotel | `ac0e8ac` |
| 5, 6, 7 Demandes, feuille de route, dossier juriste | `9b05554` |
| 8 Accessibilité et petits écrans | `a7d5598` |
| Remise à zéro (script gardé), docs finales, rapport | dernier commit |

État final de `verify` : **353 tests unitaires et 62 tests de navigateur passés**, 0 erreur de code. Test de fumée sur le site déployé : 7 tests passés (`npm run e2e:remote`).

## Ce qui est fait
1. **Bêta gratuite** (`FREE_BETA=on`) : formule A seule, rapport sans paiement avec mention « Bêta gratuite », B/C/âge/captcha/paiement/CGV en 404, conditions de la bêta, mentions légales au nom de la Ltd, confidentialité limitée à la bêta, carte et défi fonctionnels, code de paiement intact. Garde-fou : sans mot de passe, le site répond 503 tant qu'il reste un `[À COMPLÉTER]`.
2. **Entonnoir** anonyme (sans cookie ni IP), vue dans l'administration, politique de confidentialité mise à jour.
3. **Railway** : projet, base, site, 2 tâches planifiées, point de santé, mot de passe, limite de 5 connexions à la base, variables, migrations au démarrage ; **tâche horaire vérifiée à l'exécution (00 h 00), tâche quotidienne vérifiée par un déclenchement temporaire** (« STATS_WEBHOOK_URL n'est pas renseigné : rien à envoyer »), horaires remis en place. `docs/RAILWAY.md`, `docs/OUVERTURE.md` (Cloudflare pas à pas, deux cas de domaine).
4. **Verotel** : adaptateur complet et testé (32 tests, signature vérifiée contre le jeu d'essai public de Verotel), remboursement et contestation reverrouillent le rapport ; clauses citées dans `docs/PRESTATAIRES.md` (contrat type lu directement).
5. **Demandes** : `docs/DEMANDES/` (6 destinataires + récapitulatif), rien n'est envoyé.
6. **Feuille de route** : `docs/PASSAGE-PAYANT.md` (15 étapes ; sauvegardes vérifiées obligatoires avant tout paiement).
7. **Dossier juriste** : `docs/JURISTE.md` (10 sujets + liste de contrôle B1-B14 de la bêta).
8. **Accessibilité** (axe-core, clavier, focus, mouvement réduit) et **petits écrans** (320/375/390 px) : corrections faites, aucun recouvrement de texte réel trouvé.

## Ce qui n'est pas fait, ou pas vérifié
- **Informations de la Ltd** : vides dans votre consigne → marqueurs visibles `[À COMPLÉTER]` partout (mentions légales, confidentialité, demandes à envoyer) ; adresse de Railway Corporation à relever.
- **Aucune sauvegarde de la base n'est active** (obligatoire avant tout paiement : étape 7 de `docs/PASSAGE-PAYANT.md`).
- **Verotel** : l'adaptateur n'a jamais parlé à un vrai Verotel. La documentation officielle FlexPay est derrière une connexion : cinq points restent « À CONFIRMER en mode test » (événement d'une vente unique, noms des paramètres de montant, `referenceID` dans les remboursements, format de signature, adresse de retour). **Obstacles possibles lus dans leur contrat type** : FlexPay réservé au compte Premium (6 mois de relevés exigés), vente de « contenu » soumise à accord écrit, aucune clause sur les sociétés britanniques.
- **CCBill et Segpay** : leurs conditions n'ont pas été lues (repli).
- **Remise à zéro des données de test distantes** : non faite. Mon environnement a refusé l'effacement de données sur le service distant ; je ne l'ai pas contourné. Les rapports de test ont été supprimés par les tests, mais des **compteurs anonymes de test** (journal, événements de l'entonnoir) restent. Script prêt et gardé : `scripts/reset-test-data.mjs`.
- **Adresses des demandes** : Microsoft (PhotoDNA), x.ai/console xAI : procédure non lue (accès refusé aux outils automatiques) ; aucune adresse e-mail inventée.
- **Accessibilité** : pas d'essai avec un vrai lecteur d'écran ni sur de vrais téléphones.
- **Tests de navigateur** : Chromium seulement.
- **Non lu** : politique de contenu de Verotel, documentation FlexPay, Légifrance (références de lois « à vérifier » dans `docs/JURISTE.md`).
- Aucun appel xAI, aucune photo réelle, aucun compte ouvert, aucun message envoyé, `SEO_PUBLISH` inchangé (vide), mot de passe de protection en place.

## Décisions prises (détail : `docs/DECISIONS.md`)
Rapports de la bêta conservés **90 jours** au plus ; case de **consentement explicite art. 9** ajoutée en bêta ; **aucun identifiant de rapport envoyé à Verotel** (retour par `/paiement/retour` et cookie fonctionnel) ; signatures SHA-1 **refusées** par défaut ; rapport reverrouillé conservé **30 jours** et non repayable ; Stripe retiré de la politique de sécurité (adaptateur laissé) ; commission provisoire de 12 % **inchangée** (le compte Basic Verotel affiche 15,5 %) ; réglages Railway posés dans le tableau de bord (le fichier `railway.json` n'est plus pris en compte) ; ressources **0,5 vCPU / 0,5 Go** par service (plus petit réglage viable pour Next.js ; le plus petit réglage possible, 0,1/0,1, est trop petit) ; `/api/payments/webhook` joignable sans mot de passe dès que Verotel est configuré ; aucune limite de dépense Railway posée (réglage de compte : à vous).

## Incident de la nuit
La première mise en ligne n'a pas lancé les migrations (`railway.json` ignoré) : erreurs « relation reports n'existe pas » sur le site de test, corrigé (réglages dans le tableau de bord, redéploiement). Aucune donnée perdue (base vide à ce moment).

## Coût Railway engagé
`bitometre-test` : **0,0042 $** mesuré à 00 h 33 (environ 1 h 25 après la création ; compteurs en léger retard). Espace : 4,32 $ (4,29 $ au début), facture estimée 8,47 $, **aucune limite d'usage**. Détail et estimation : fin de `docs/RAILWAY.md`.

## Vos questions (QCM, recommandation en premier)

**1. Informations de la Ltd** : comment me les transmettre ?
- A. **Me donner raison sociale, numéro Companies House, siège, directeur de la publication, numéro ICO, e-mail de contact et adresse de Railway ; je les inscris, je redéploie.** (recommandé : sans cela le site ne peut pas s'ouvrir et les demandes ne peuvent pas partir)
- B. Les remplir vous-même dans `src/config/company.ts`.

**2. Prestataire de paiement : que faire du risque Premium/FlexPay (6 mois de relevés) ?**
- A. **Envoyer la demande Verotel telle quelle (elle pose la question) et, en parallèle, me faire lire les conditions de CCBill et Segpay.** (recommandé)
- B. Passer directement à CCBill ou Segpay.
- C. Attendre la réponse de Verotel avant tout autre travail.

**3. Sauvegardes de la base (obligatoires avant tout paiement)** : quand ?
- A. **Les activer et tester une restauration dès la prochaine session, avant même l'ouverture de la bêta (coût : quelques centimes à quelques dollars par mois).** (recommandé)
- B. Seulement juste avant le passage au payant.

**4. Limite de dépense Railway** :
- A. **La définir vous-même (Settings → Usage, limite dure à 20 $ environ) avant l'ouverture au public.** (recommandé : aucune limite aujourd'hui)
- B. Me laisser la poser (réglage de compte : j'ai besoin de votre accord écrit).

**5. Données de test distantes** (compteurs anonymes de mes essais) :
- A. **Les remettre à zéro avant de montrer l'administration : confirmez-moi par écrit que la base du site de test peut être vidée et je lance le script gardé.** (recommandé)
- B. Les laisser.

**6. Commission du paiement dans l'administration (12 % provisoire)** :
- A. **La passer à 15,5 % (tarif public du compte Basic de Verotel) en attendant la réponse écrite.** (recommandé : plus prudent pour les chiffres de revenu net)
- B. La garder à 12 %.

**7. Ouverture publique de la bêta (bitometre.com)** :
- A. **Attendre la validation écrite du juriste sur B1-B5 et B13 de `docs/JURISTE.md`, puis suivre `docs/OUVERTURE.md`.** (recommandé)
- B. Ouvrir plus tôt avec les textes actuels (non recommandé : données sur la vie sexuelle, aucun avis juridique).

**8. Ordre des demandes à envoyer** :
- A. **Verotel et Railway d'abord ; AgeVerif, Yoti, PhotoDNA et xAI quand les formules photo reviennent à l'ordre du jour.** (recommandé)
- B. Tout envoyer en même temps.

---

# Suite du 02/10/2026 (réponses du propriétaire)
- 1A : champs de la Ltd toujours vides (ICO = « enregistrement en cours ») ; adresse et raison sociale de Railway ajoutées avec sources. 2A : CCBill et Segpay lus, recommandation, demandes `ccbill.md` et `segpay.md`. 3A : sauvegardes activées, restauration testée. 5A : base de test vidée. 6A : commission 15,5 %. 7 : `docs/JURISTE-COURT.md`. Détail : `docs/DECISIONS.md` (fin) et `docs/RAILWAY.md`.
