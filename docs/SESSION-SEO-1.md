# Session SEO 1 : phase 1 du plan de référencement (nuit du 03/10/2026)

Session autonome, sans question. Journal mis à jour à la fin de chaque bloc. À relire en cas de reprise.

## Règles suivies
- Aucun compte ouvert, aucun message envoyé, aucune variable Railway modifiée, aucun appel xAI.
- Tous les chiffres des pages viennent des fonctions du site (`src/lib/seoFigures.ts`, `src/lib/stats.ts`) : dans les fichiers Markdown ils sont écrits sous forme de jetons `{{…}}`, remplacés au chargement ; un jeton invalide fait échouer la construction.
- Sources vérifiées sur les résumés PubMed (service eutils du NCBI) le 03/10/2026 : Veale 2015 (PMID 25487360), Wessells 1996 (8709382), Sengezer 2002 (12068220), Yafi 2018 (30068977), Bondil 1992 (1459150), Belladelli 2023 (36792094), Mostafaei 2025 (40248849).
- Écriture : jamais « court », « petit », « insuffisant », « anormal », « défaut », aucun dénigrement (contrôle automatique, voir bloc 5).

## Décisions prises seul (à valider)
- **Publication par défaut** : je ne peux pas modifier les variables Railway. `SEO_PUBLISH` devient « publié sauf `off` » (au lieu de « caché sauf `on` »). Le site de test reste protégé par mot de passe : rien n'est indexé tant qu'il n'est pas ouvert.
- **Rang en percentile** : partie entière, jamais arrondie à la hausse, comme « Au-dessus de X % » du rapport. Le rapport d'exemple (13,8 cm) affiche donc « 65e percentile : au-dessus d'environ 65 % » (percentile exact 65,9) et non « 66e ».
- **20 cm** : au-delà de 4 écarts-types, le questionnaire et le calculateur refusent la valeur (règle existante, `MAX_SIGMA`). La page 20 cm le dit et affiche « au-delà du 99e percentile ».
- **Textes du propriétaire** : la règle « je ne réécris pas leur texte » (CLAUDE.md) est levée pour cette session par la demande explicite (élargir la page France, retitrer les guides). Les passages d'origine sont conservés autant que possible ; les ajouts sont signalés ci-dessous.

## Bloc 1 : technique — terminé
- Publication activée par défaut (`src/lib/seo.ts`, `isPublished`), documentation mise à jour (`.env.example`, README, SPEC §19).
- Chargeur de contenu étendu : champs `h1`, `breadcrumb`, `verified`, `ogFigure`, `ogLabel` ; blocs `[[calculateur]]`, `[[distribution]]`, `[[tableau-percentiles]]`, `[[tailles]]`, `[[mesure]]` ; jetons de chiffres ; nouveaux slugs (piliers, à propos, 11 pages par centimètre) ; liens vers `/` et `/presse` autorisés.
- Page `taille-moyenne-penis-france` renommée `taille-moyenne-penis`, redirection permanente (308) de l'ancienne adresse (`src/lib/seoRenamed.ts`, `next.config.ts`).
- Sitemap : pages publiques fixes + pages de contenu publiées, date = date de vérification. robots.txt inchangé (déjà correct).
- Balises canoniques : accueil, pages de contenu, méthode, contact, pages légales.
- Fil d'Ariane visible + BreadcrumbList ; WebSite + Organization (nom Bitomètre seulement) sur toutes les pages ; WebApplication sur l'accueil ; Article (auteur « Rédaction Bitomètre ») sur chaque page de contenu ; FAQPage conservé.
- Image de partage par page : `/og/page/<slug>` (titre + chiffre clé calculé), `/og/page/accueil` ; image neutre par défaut pour les pages légales.
- Mini-calculateur « Essayez » réutilisable (valeurs préremplies, version compacte).
- Parcours automatique des liens : `e2e/liens.spec.ts` (aucun lien interne cassé ; sitemap = exactement les pages indexables ; canonique = soi-même ; image de partage servie). Les liens vers une page de contenu absente ne sont pas affichés.
- `docs/SEARCH-CONSOLE.md` : Google Search Console et Bing par DNS chez Cloudflare, sitemap, planificateur de mots-clés.
- Tests : `tests/seo-figures.test.ts` (quantile, jetons, cohérence avec le rapport).

## Bloc 2 : page d'accueil — terminé
- Titre de page « Calculateur taille pénis : percentile et moyenne | Bitomètre » ; H1 « Calculateur de taille du pénis » ; sous-titre au ton laboratoire qui dit ce qu'on obtient en une minute.
- Méta-description orientée clic (deux variantes : bêta gratuite / payant), sans chiffre trompeur (l'effectif de 15 521 hommes ne concerne pas la longueur en érection : il n'est pas mis en avant).
- Rapport d'exemple : le percentile est l'information principale (« 65e percentile : au-dessus d'environ 65 % de la population de référence »), le score passe au second plan dans un encadré (option `lead="percentile"` de `ReportDashboard`, utilisée seulement sur l'accueil ; le rapport réel est inchangé).
- Bandeau « scanner » de l'accueil : « Percentile 66 » (arrondi) remplacé par « 65e percentile » (partie entière), pour être cohérent avec « Au-dessus de 65 % » affiché plus bas. Fonction commune `rankLabel` (`src/lib/format.ts`).
- Section « Où vous situez-vous ? » (11 tailles) et « Comprendre les chiffres » (pages piliers) : `src/components/content/HomeGuides.tsx`. Chaque lien n'apparaît que si sa page existe et est publiée.
- Bandeau défilant : « Indicateurs dans chaque rapport : 4 » au lieu de « Mesures ».
- Pied de page : libellés courts des guides (champ `breadcrumb`), sans les pages par centimètre.
