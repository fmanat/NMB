# Journal de la session de nuit

Règles : commit + push à la fin de chaque bloc ; `npm run verify` vert à chaque commit ; budget xAI : 0 $ ; aucun déploiement, compte, message envoyé, photo réelle. Après une compaction du contexte : relire ce journal et docs/SPEC.md.

## Réponses du propriétaire appliquées (avant la nuit)
- 1A Clever Cloud (sous réserve de confirmation écrite), 2A relecture juridique avant mise en ligne, 3A refus si confiance basse, 5A relire les guides puis `SEO_PUBLISH`, 8A commission 12 % provisoire.
- 4A : demander la non-conservation (ZDR) à xAI ; sinon 30 jours, sans bloquer la mise en ligne. **Action du propriétaire.**
- 6A : calibration avec objets puis test avec sa propre photo (aussi test décisif d'acceptation d'une vraie photo par xAI). Matériel et prises de vue : `docs/CALIBRATION.md`. **Action du propriétaire.**
- 9A : « accès à vie » remplacé (voir Bloc 0).

## Bloc 0 : durée d'accès au rapport : FAIT
- `REPORT_ACCESS.minYears = 3` dans `src/config/site.ts` ; reporté dans CGV (nouvelle section), page de paiement, accueil, FAQ (`content/seo/faq.md`, littéral vérifié par un test) et SPEC.md (décision du propriétaire). Test : `tests/report-access.test.ts`.
- Constat : les rapports payés ne sont jamais purgés (seuls les non payés le sont) : la promesse est tenue par le code.

## Prochain bloc : Bloc 1, tests de bout en bout

## Bloc 1 : tests de bout en bout : FAIT
- 17 tests Playwright (`e2e/*.spec.ts`), `npm run e2e`, intégrés à `npm run verify` (verify vert : 214 tests unitaires + 17 e2e).
- Couvert : A complète ; B et C avec image neutre (réencodage vérifié : JPEG, ≤ 1 600 px, métadonnées effacées ; aucune trace en base) ; refus (18 ans, plafond, valeurs absurdes, consentement manquant, pas de jeton d'âge, confiance basse, message sans « âge ») ; carte de partage (images 1200×630 et 1080×1920, suppression, suppression en cascade) ; défi (invitation, ami, comparaison sans cm, retrait) ; administration (refus, accès, déconnexion, cookie forgé, blocage après 5 échecs) ; sécurité (HTML verrouillé sans résultat, image OG neutre, ids aléatoires, notification signée rejouée sans double effet, retour sur le site sans déblocage).
- Décisions : voir DECISIONS.md (next dev pour e2e, schéma e2e, NEXT_DIST_DIR).
- Pas fait : tests sur mobile/autres navigateurs (Chromium seulement).

## Prochain bloc : Bloc 2, comparaison des prestataires (docs/PRESTATAIRES.md)

## Bloc 4 (fait en avance, pendant que les recherches du Bloc 2 tournaient) : préparation Clever Cloud : FAIT
- `clevercloud/cron.json` + 2 scripts (purge horaire, webhook quotidien 4 h 30), `docs/CLEVER-CLOUD.md` (pas à pas, variables), lecture de `POSTGRESQL_ADDON_URI`, `engines`, `tsx` en dépendance, `.gitattributes`, test `tests/deploy-config.test.ts`.
- **Défaut corrigé** : le script de purge planifié `scripts/purge.mjs` n'effaçait pas les empreintes d'IP de `analysis_attempts` (seule la fonction interne le faisait) : les IP hachées des tentatives restaient donc indéfiniment. Corrigé et testé.
- Non vérifié : noms exacts des variables Clever Cloud (listés dans CLEVER-CLOUD.md, « à confirmer au premier déploiement »). Rien n'est déployé.

## Bloc 2 : comparaison des prestataires : FAIT
- `docs/PRESTATAIRES.md` : 4 rôles, tableaux, clauses citées avec liens (de seconde main : résumés d'un outil de lecture, à relire sur les pages), recommandations, risques, questions écrites à poser, et 4 QCM.
- Recommandations : paiement Stripe (validation écrite d'abord ; repli Mollie), âge AgeVerif sous conditions (repli Yoti ; AgeGO écarté), filtrage PhotoDNA (éligibilité et signalement à faire trancher par un juriste ; repli IWF), captcha ALTCHA auto-hébergé (repli Friendly Captcha).
- Limites : pages en 403/404, archive.org bloqué ; aucune vérification à la source des citations.
- Découverte importante : aucune certification Arcom n'existe (auto-déclaration) ; ne jamais écrire « certifié Arcom » ni « anonyme ».

## Prochain bloc : Bloc 3, adaptateurs (Stripe, ALTCHA, AgeVerif ; PhotoDNA impossible sans accès)

## Bloc 3 : adaptateurs : FAIT (sauf filtrage d'empreintes)
- Stripe : `src/lib/payments/stripe.ts` (13 tests : création, signature, rejeu, tolérance, rotation, paiement différé, montant faux, session inconnue). Retour de paiement avec rechargement automatique (`AwaitPayment`).
- AgeVerif : `src/lib/providers/ageverif.ts` (13 tests : état signé, échange de code, seuil 18, erreurs, panne réseau, route de retour).
- ALTCHA : `src/lib/captcha/altcha.ts`, `altchaClient.ts`, route `/api/captcha/challenge`, migration 005 (10 tests + 1 test de bout en bout navigateur sur un troisième site de test).
- `.env.example` et README documentés ; `docs/CLEVER-CLOUD.md` mis à jour.
- **PAS FAIT : filtrage d'empreintes** (aucune API publique). Bloque B et C en production tant que non tranché.
- Non vérifié : comportement réel de chaque API (aucune clé) ; compatibilité ALTCHA avec le composant officiel ; Apple Pay/Google Pay chez Stripe.

## Prochain : relecture finale, `verify`, rapport de fin de nuit
