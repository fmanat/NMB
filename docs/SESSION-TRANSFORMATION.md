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
