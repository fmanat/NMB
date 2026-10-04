# Session « transformation » du 04/10/2026

Mission : rendre Bitomètre plus clair, plus désirable et plus vendeur sur toute la chaîne
curiosité → test → résultat → analyse photo → achat → partage → nouvel utilisateur, sans toucher au paiement (Plisio) ni au moteur xAI,
et sans rien afficher de faux. Règles du dépôt respectées : textes SEO du propriétaire non réécrits, aucun chiffre écrit à la main,
mots interdits, vouvoiement, aucune image explicite. Détail produit : `docs/SPEC.md`, section 29.

## Audit (résumé)

Points forts conservés : calculs (loi normale, Veale 2015) et leurs tests, rapport photo v2, carte de partage, défi, 30 pages de contenu
avec contrôles automatiques, données structurées, sitemap, robots, canoniques, mesure anonyme, design system clair.

Frictions relevées, par impact sur le revenu :
1. Aucune vente de l'analyse photo sur le résultat gratuit : le moment de curiosité maximale était perdu.
2. Choix « questionnaire gratuit / photo 4,99 € » imposé avant tout résultat.
3. Paiement en cryptomonnaie découvert en fin de parcours.
4. Vérification d'âge présentée sans contexte (première chose vue après le clic photo).
5. Résultat ouvert sur le score (note indulgente) plutôt que sur le percentile.
6. Partage et défi en formulaires austères ; carte publique sans appel pour qui la reçoit.
7. Questionnaire en une longue page, d'allure administrative.
8. Simulation à curseurs de l'accueil : donnait le percentile sans entrer dans le parcours (ni rapport, ni profil, ni partage, ni offre).

Benchmark (mécaniques retenues, sans reprise de textes ni de marque) : percentile en héros, aperçu d'un résultat avant le test,
une question par écran, révélation du chiffre, profil nommé, offre payante juste après le résultat, partage et défi en un geste.

## Ce qui a été fait

Voir `docs/SPEC.md` §29 pour le détail. Fichiers principaux :
- Accueil : `src/app/page.tsx`, `src/components/report/ResultHero.tsx`, `src/components/report/PercentileCurve.tsx`.
- Test : `src/app/analyse/QuestionnaireForm.tsx`, `src/app/analyse/QuestionnairePage.tsx`, `src/app/analyse/page.tsx`, `src/app/analyse/questionnaire/page.tsx`.
- Résultat : `src/app/r/[id]/page.tsx`, `src/components/report/CountUp.tsx`, `src/components/PhotoOffer.tsx`, `src/components/StickyCta.tsx`.
- Paiement (présentation seulement) : `src/app/paiement/[id]/PayForm.tsx`, aperçu verrouillé dans `src/app/r/[id]/page.tsx`, étapes sur `src/app/verification-age/page.tsx`.
- Partage et défi : `src/components/ShareToolbar.tsx`, `src/app/c/[id]/page.tsx`, `src/app/r/[id]/partager/page.tsx`, `src/app/r/[id]/defi/page.tsx`, `src/app/defi/[id]/page.tsx`, `src/lib/cardImage.tsx`.
- Contenu : `src/components/content/ContentBlocks.tsx`, `src/app/[slug]/page.tsx`.
- Mesure : `src/lib/track.ts`, `src/components/Tracked.tsx`, `src/lib/funnel.ts`, `db/migrations/011_funnel_growth.sql`, `src/app/confidentialite/page.tsx`.

## Bugs corrigés
- Page du test sans titre de niveau 1 après la refonte (signalé par axe) : titre masqué ajouté.
- Pages de contenu avec tableau (ex. /percentile-penis) : défilement horizontal de toute la page sous 385 px ; les tableaux défilent
  désormais dans leur cadre sur mobile.
- Liens dans les en-têtes de tableau : contraste 4,25:1 (AA non atteint) ; bleu foncé, environ 6,6:1.
- Synthèse du rapport du questionnaire : le percentile y était arrondi à l'entier le plus proche (« percentile 66 ») alors que tout le
  reste du site affiche la partie entière (« 65e percentile »), règle du propriétaire. Corrigé (`src/lib/reportCore.ts`).

## International (préparation, rien de publié)
Le cahier des charges limite le site au français (§1). Plan proposé pour l'anglais puis l'allemand, l'espagnol, l'italien, le néerlandais :
1. Libellés d'interface extraits dans un dictionnaire par langue (`src/i18n/fr.ts`, `en.ts`…), les composants recevant la langue.
2. Contenus : `content/seo/<langue>/<slug>.md`, slugs traduits, mêmes jetons de chiffres (les calculs ne changent pas).
3. Adresses : français à la racine (aucune redirection des adresses actuelles), autres langues sous `/en/`, `/de/`… ; balises
   `hreflang` réciproques + `x-default` vers le français ; un sitemap par langue.
4. Prix en euros partout ; textes juridiques traduits et relus avant toute ouverture d'une langue.
Décision du propriétaire nécessaire avant de commencer (cahier des charges §1).

## Ce qui reste à faire

P0 (avant de pousser du trafic)
- Déployer (`railway up --service web`, sur votre accord) : la migration 011 s'applique au démarrage.
- Relire la politique de confidentialité complétée (événements) avec le juriste.
- Vérifier dans Umami que les événements arrivent (onglet « Events ») et créer l'entonnoir test_start → test_complete → result_view →
  analysis_cta_click → purchase_start → purchase_success.

P1
- Paiement par carte (Verotel ou autre) : la cryptomonnaie seule reste le premier plafond de conversion de l'analyse photo.
- Préremplir l'analyse photo avec les valeurs déclarées du test et afficher l'écart déclaré / estimé (les composants existent, formule C).
- Carte de partage par défaut avec percentile et profil (aujourd'hui score seul, choix du cahier des charges §9 : décision du propriétaire).
- Titres et méta-descriptions des pages de contenu plus orientés clic (textes du propriétaire : à réécrire par lui ou sur sa demande).
- Version anglaise (plan ci-dessus).

P2
- Supprimer la double case d'âge (fenêtre d'année + case du test) si le juriste l'accepte.
- Lighthouse mobile de l'accueil à remesurer sur le site déployé (le bandeau 3D est désormais plus bas dans la page).

## Dix expériences à tester (par priorité)
1. Offre photo sur le résultat : bloc seul / bloc + barre collante (mesure : clics vers l'analyse photo, puis paiements, par résultat affiché).
2. Titre de l'offre : « Votre analyse complète vous attend » / « Une seconde lecture, indépendante de votre règle » / « Quatre indicateurs qu'aucun questionnaire ne mesure ».
3. Annonce de la cryptomonnaie : sur l'offre (actuel) / seulement au paiement (mesure : paiements réussis par offre vue, pas seulement clics).
4. Hero de l'accueil : « À quel percentile êtes-vous ? » / « Votre pénis est-il vraiment dans la moyenne ? » (mesure : test_start par visite).
5. Exemple de résultat dans le hero : présent / absent sur mobile (le bouton remonte).
6. Test : 4 écrans / page unique (mesure : test_complete par test_start).
7. Carte par défaut : score seul / percentile + profil (mesure : visites de /c/ par carte, puis tests commencés).
8. Défi : bouton à côté du résultat / après l'offre photo (mesure : défis créés, puis relevés).
9. Barre collante des pages de contenu : présente / absente (mesure : test_start depuis les pages de contenu).
10. Prix affiché dans le bouton de l'offre / sous le bouton (mesure : clics et paiements).
Sans cookie ni identifiant, une variante peut être attribuée par la parité de l'identifiant du rapport ou par période.
