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
