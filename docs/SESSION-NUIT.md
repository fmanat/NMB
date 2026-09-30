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
