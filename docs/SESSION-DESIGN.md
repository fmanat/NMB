# Journal de la session de refonte de l'interface

Règles : sources de vérité visuelle = `docs/design/Bitometre_Charte_Graphique_UI_UX_v1.md` et `docs/design/Bitometre_Design_System_DS01_v1.md` ; `docs/SPEC.md` l'emporte pour le produit, les prix, les formules et les textes (la bêta gratuite de la formule A reste la seule offre visible). Commit et push à chaque bloc, `npm run verify` vert. Après une compaction du contexte : relire ce journal.

## Avant de commencer
- Les deux documents ont été extraits de `docs/design/files.zip`.
- Captures « avant » (site de test déployé, 390 et 1 440 px) : `docs/design/captures/avant/` (accueil, analyse, rapport ; les PNG sont ignorés par git).

## Conflits relevés entre la charte et SPEC.md : décisions
- **Score** : la charte écrit « Au-dessus de 71 % de la population » sous le score ; SPEC.md (§5.3) interdit de présenter le score comme un percentile. Sous l'anneau : « Note de présentation, pas un percentile » ; la phrase « Au-dessus de X % de la population de référence » est portée par les **percentiles réels** de la longueur et de la circonférence.
- **Eyebrow** : « SCIENCE · IA · STATISTIQUES » devient « SCIENCE · DONNÉES · STATISTIQUES » : la bêta n'utilise aucune IA (politique de confidentialité de la bêta).
- **Choix « photo / manuel »**, paywall à 4,90 €, « 100 % confidentiel » : non repris en bêta (formule A seule, gratuite) ; en version payante, prix et formules viennent de `FORMULAS`.
- **Police** : Inter et IBM Plex Mono remplacent Sora et Geist Mono.

## Bloc 1 : fondations : FAIT
- Tokens de la charte et du DS-01 centralisés dans `src/app/globals.css` (couleurs, Inter et IBM Plex Mono via `next/font`, espacements sur grille de 4 px, rayons, ombres, durées et courbe d'animation) ; **mode clair par défaut**, mode sombre disponible seulement par `data-theme="dark"` (aucun interrupteur). Les anciens noms (`--accent`, `--border`…) sont des alias, donc toutes les pages existantes passent au clair sans être réécrites. Grille d'arrière-plan et néon supprimés.
- Composants : `ui/` (Button, Card, Badge, TrustBadge, Accordion, Icon), `navigation/` (Header, MobileMenu = MobileHeader, Footer, Logo), `report/` (ScoreRing, PercentileBar, DistributionChart, MetricCard, CurvatureIndicator, ReportDashboard), `analysis/ProgressStepper`. États : défaut, survol, actif, focus (contour de 3 px), désactivé, chargement (bouton qui garde sa largeur), erreur.
- Contrastes : le gris `#8A9AB0` de la charte (2,9:1 sur blanc) est assombri en `#6B7B92` pour le texte ; l'orange d'avertissement en texte devient `#8A5B00` ; les titres d'accroche utilisent `#0F55D1`. L'orange `#D99000` reste la couleur de fond/fonctionnelle.
- Les logiques de calcul restent hors des composants visuels (ils reçoivent des résultats déjà calculés).

## Bloc 2 : accueil : FAIT
- Hero en deux colonnes : titre « Votre profil morphologique en données. », sous-titre qui dit ce qui est mesuré (longueur, circonférence, courbure), bouton « Démarrer mon analyse », lien « Voir un exemple de rapport » ; à droite un **rapport d'exemple rempli** (anneau de score, percentiles de longueur et de circonférence, courbe de distribution) marqué « Exemple · valeurs fictives ».
- L'exemple utilise des mesures inventées passées dans les **vraies fonctions de calcul** du site (`src/lib/exampleReport.ts`) : cohérent avec ce qu'un visiteur obtiendra, aucune statistique inventée.
- Sections : preuves de confiance (4, vraies : aucun compte, connexion chiffrée, méthode publique, gratuit pendant la bêta), comment ça marche (3 étapes), exemple de rapport complet (avec repères d'objets et de monuments), ce que mesure le rapport, FAQ en accordéon, appel final, pied de page sobre. Hors bêta : une section « Protocoles » avec les prix de `FORMULAS`.
- Plus aucune valeur vide (« -- », « ---- ») : la jauge vide et le numéro de dossier factice sont supprimés. Le bandeau de statistiques reste masqué sous 500 analyses réelles (inchangé).
- Le questionnaire a quitté l'accueil : en bêta, **`/analyse` est le questionnaire** (précédé d'un indicateur d'étapes Mesures / Calcul / Rapport) et `/analyse/questionnaire` y renvoie ; hors bêta, `/analyse` est le choix du protocole (restylé).

## Bloc 3 : rapport et questionnaire : FAIT
- Questionnaire : champs avec unité séparée (`[ 14,2 cm ]`), étiquettes toujours visibles, aide sous chaque champ, état en cartes sélectionnables, erreurs avec icône, bouton à l'état de chargement.
- Rapport : ordre de la charte (score, position statistique, indicateurs, visualisations, synthèse, méthodologie). Score dominant (anneau de 160 à 200 px) ; sous l'anneau la mention « note de présentation, pas un percentile » et, **par indicateur, « Au-dessus de X % de la population de référence »** (partie entière, jamais flatté) ; cartes Longueur, Circonférence, Courbure (et Symétrie pour les formules photo) avec valeur et unité d'abord, percentile, courbe de la population avec la position « Vous », axe gradué avec unités ; repères de taille ; tableau « Détail des valeurs » conservé (lignes de 48 px) ; synthèse en carte bleutée **après** les données ; méthodologie en accordéon ; actions en boutons pleine largeur sur mobile.
- Tests du navigateur adaptés (libellés, URL, composants) ; détecteur de mise en page amélioré (accordéons fermés et éléments épinglés ignorés, car non affichés ou non superposés).

Note : `npm run verify` a été lancé une fois pour l'ensemble des blocs 1 à 3 (62 tests navigateur, 359 unitaires : vert), puis un seul commit les regroupe, car l'accueil, le rapport et les composants partagés ne sont pas séparables sans casser les tests du navigateur.

## Bloc 4 : reste du site : FAIT (par les composants et les tokens)
- Boutons, champs, cartes, accordéons, tableaux et titres des pages restantes (carte de partage, défi, vérification d'âge, paiement, connexion d'administration, pages de textes, méthode, guides, FAQ) passent par les mêmes classes et tokens : `btn`, `btn-primary / secondary / destructive`, `card`, `accordion`, `data-table`, `prose-lab`, `Doc`. Erreurs en rouge de la charte (texte `#B42F2F`), avertissements en orange foncé.
- **Image de partage** (OG 1200 × 630 et story) : fond blanc, navy et bleu Bitomètre, sans grille ; texte « Rapport clinique n° … » conservé (SPEC §9) ; aucune image ni silhouette.
- Rapport : sur mobile, le tableau « Détail des valeurs » devient une liste de cartes (charte, section 34) ; le tableau reste sur ordinateur.
- Non refait en profondeur : écran d'envoi de photo (`PhotoFlow`, formules photo masquées en bêta) et administration : restylés par les tokens seulement.

## Bloc 5 : contrôle et mise en ligne de test
- Captures : `docs/design/captures/avant/` (site de test avant la refonte) et `docs/design/captures/apres/` (accueil, analyse, rapport à 390 et 1 440 px, plus partage, carte, défi, méthode et pli de l'accueil mobile) ; PNG ignorés par git.
- Check-list de la section 47 du DS-01 : Inter chargée (next/font) ; palette, rayons et ombres par variables ; espacement de la grille de 4 px ; une action principale par écran (CTA du hero, « Calculer mon rapport », boutons du rapport) ; CTA visible sans défilement sur mobile (390 px) ; états chargement/erreur/succès ; formulaires à 52 px sur mobile ; score dominant ; percentiles lisibles ; **unités toujours visibles** (cm, °, axes des courbes) ; partage sans donnée privée ; composants et tokens centralisés ; calculs hors des composants ; responsive contrôlé à 320, 375 et 390 px (détecteur automatique) et à 1 440 px (captures) ; mouvement réduit ; clavier ; contrastes (axe-core sans violation). Écarts connus : voir « perfectible » dans le rapport final.

## Suite : rapport d'exemple compact en tête de l'accueil mobile
- Sous 1 024 px, l'ordre est celui du DS-01 : titre et sous-titre, **rapport d'exemple compact** (anneau de score et deux percentiles, marqué « Exemple · valeurs fictives »), puis les boutons. Sur ordinateur : texte et boutons à gauche, exemple complet à droite (inchangé). La version complète de l'exemple reste plus bas (`#exemple`).
- Pour tenir sur le premier écran, la phrase « Gratuit pendant la bêta… » du sous-titre n'apparaît qu'à partir de 640 px (elle reste dans les preuves de confiance, juste dessous).
- Mesure : à 390 × 844 px le bas du bouton principal est à 604 px ; à 360 × 740 px il reste dans l'écran. Capture : `docs/design/captures/apres/accueil-390-pliage.png`. Test : `e2e/mobile.spec.ts` (390 × 844, 375 × 700, 360 × 740).
- Décisions du propriétaire : exemple conservé tel quel (1A), choix de protocole hors bêta conservé (2A), pas de mode sombre (3A).
