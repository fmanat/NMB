# Journal : refonte du moteur d'analyse photo (formule B), version photo-report/2

Démarrée le 03/10/2026, session autonome, **aucune question posée**. Demande du propriétaire : reprendre fidèlement le prompt qu'il a testé dans Grok sur cinq vraies photos (estimations à quelques pour cent de la règle), en deux appels, avec les calculs faits par le code, un rapport de 600 à 800 mots mis en forme comme un compte rendu, des interdits vérifiés par le code, la calibration des estimations et un rapport partiel en cas d'échec technique.

## Règles (du propriétaire)
- Commit et push à chaque étape, **`npm run verify` vert** à chaque commit. Journal dans ce fichier.
- **PHOTO_BETA reste désactivée en production** (garde-fou inchangé : `photoBetaDecision`, `src/lib/photoBeta.ts`). Rien n'est déployé.
- Tests avec simulations d'API ; **au plus 0,30 $ d'appels réels**, sur des images neutres fabriquées par du code (aucune photo).
- Aucune remarque juridique.

## Étapes
| Étape | Sujet | État |
|---|---|---|
| 1 | Moteur photo-report/2 (deux appels, calculs, contrôles du texte, rapport partiel), rapport en compte rendu, consignes, textes du site, tests, appels réels sans photo | FAIT (verify vert : 768 tests unitaires, 171 de bout en bout) |
| 2 | Calibration : paires conservées, graphique et écart moyen par tranche dans l'administration | FAIT |
| 3 | Appels réels sans photo, exemple de rapport, `docs/TEST-PHOTO.md`, cahier des charges | FAIT (avec l'étape 1 ; journal final ci-dessous) |

## Étape 1 : moteur photo-report/2 et rapport en compte rendu : FAIT

**Architecture (deux appels, `src/lib/analyseFlow.ts`)**
1. **Appel vision** (avec la photo, JSON strict, `VISION_SCHEMA_V2` dans `src/lib/vision/schema2.ts`) : recevabilité (une seule personne, aucun visage, sujet conforme, image originale, aucun doute sur la majorité, qualité suffisante), estimations (état, carte présente et lisible, longueur du pubis à l'extrémité côté dorsal, circonférence à mi-tige, **estimations sans la carte**, courbure et direction, symétrie sur 100, rapport gland / longueur, conicité), observations factuelles (forme générale, gland et couronne, axe, symétrie, surface), points de repérage (seulement si la carte est lisible). Validation zod, **une relance** si la réponse n'est pas conforme.
2. **Calculs par le code** (`src/lib/morpho.ts`) : carte présente, lisible et points exploitables → mesure géométrique existante (`src/lib/pose.ts`) pour la longueur et la circonférence, méthode « calibrée », badge « Taille calibrée » ; sinon estimations du modèle (une carte écartée pour inclinaison > 50°, carte trop petite, confiance basse ou mesure invraisemblable n'est **plus un refus** : la taille reste estimée). Percentiles Veale 2015 (configuration) ; **au repos, aucun percentile de longueur**. Indice de typicité = moyenne de 100 − 2 × |percentile − 50| (classique ≥ 70, distinctif 40 à 69, singulier < 40). Indice de rectitude axiale (100 à 0°, 0 à 45°, même règle que le score), Coefficient de symétrie bilatérale (estimation du modèle), Index de conicité distale = 100 × (1 − |rapport − 1| / 0,5). Score global et profil morphologique inchangés (au repos : score sans la longueur, pas de profil).
3. **Appel texte** (sans la photo, JSON strict, une clé par rubrique, `src/lib/vision/reportText.ts`) : reçoit les observations et toutes les valeurs calculées ; ne recalcule rien.

**Prompts versionnés** : `src/lib/vision/prompts/photo-report-v2.ts` (`photo-report-prompts/2`) : prompt vision et prompt texte (ton, interdits, structure, valeurs citables, consignes propres au rapport : deux indicateurs les plus forts, indicateurs favorables admis pour les points remarquables, valeur basse → « gabarit compact », avis médical à 30°, note au repos). La version 1 (trois observations et un verdict) est retirée du code (historique git) ; les anciens rapports restent affichés.

**Contrôles du texte par le code** (relance unique, en transmettant au modèle la liste des règles violées) :
- règles **strictes** (violées après la relance → rapport partiel) : « court », « petit », « faible », « insuffisant », « anormal », « défaut », « malformation », variantes et dénigrement ; vulgarité ; couleurs et teintes ; prépuce, gland couvert ou découvert, circoncision ; parties du corps voisines (pubis compris) ; éclairage, cadrage, posture, pesanteur ; précautions sur la précision hors de la Note ; vocabulaire médical (sauf la phrase d'avis médical exigée dans « Axe et courbure » à partir de 30°) ; diagnostic ; Note au repos sans mention de l'érection ; « gabarit compact » plus d'une fois ou sans valeur basse ; **toute valeur chiffrée non fournie par le code** (le modèle ne recalcule ni n'arrondit) ; structure (clés, trois points remarquables distincts pris parmi les indicateurs favorables) ;
- règles **souples** (une relance ; ensuite le texte est accepté) : 600 à 800 mots, nombre de phrases par rubrique (synthèse 3, rubriques 3 à 5, points 1, conclusion 2, note 1), expression de plus de trois mots répétée plus de deux fois (noms des indicateurs exclus), « variante de la normale » plus d'une fois. **Décision** : un texte complet légèrement hors longueur vaut mieux qu'un rapport partiel (question 2 en fin de session).

**Échecs**
- Refus de recevabilité (visage, plusieurs personnes, sujet non conforme, image non originale, doute sur la majorité, refus du prestataire) : aucun rapport, message neutre (inchangé).
- Échec technique (qualité insuffisante, erreur ou délai du modèle, réponse invalide après relance, estimation invraisemblable, rédaction rejetée deux fois) : **rapport partiel** construit par le code sur les valeurs de référence de l'état déclaré (`buildPartialResults`, `src/lib/photoReport2.ts`), marqué « Analyse partielle : photo difficile à lire », conseil de reprise, aucune mesure, aucun score affiché, ni carte de partage ni défi, hors du journal des scores ; tentative journalisée `error` / `partiel_<cause>`. **Décision** : lisible sans paiement en version payante (rien de personnel à vendre ; question 1).

**Confidentialité** : les observations brutes ne sont ni stockées ni journalisées (tests : marqueur des observations simulées absent de la base et des journaux) ; seul le rapport final est conservé.

**Interface**
- Page du rapport (`src/components/report/MorphoReport.tsx`) : en-tête « Rapport d'analyse morphométrique n° » (5 chiffres, code), date, état observé, méthode, badges ; score et profil sur une ligne ; synthèse ; tableau des sept indicateurs (valeurs du code, appréciations rédigées) ; six rubriques ; points remarquables ; conclusion ; Note du laboratoire. PDF : impression de la même page (sections jamais coupées).
- Aperçu verrouillé (version payante) : Coefficient de symétrie bilatérale et Indice de rectitude axiale seulement.
- Consignes de la page photo : érection recommandée, carte facultative mais conseillée (badge « Taille calibrée »).
- Textes rendus vrais : « marge d'au moins ± 10 % » retirée pour la photo (accueil, choix du protocole, conditions, méthode) ; méthode et confidentialité décrivent les deux appels, les observations non conservées et les paires de calibration.
- Carte de partage et défi : rapport partiel exclu ; au repos, ni percentile de longueur ni profil.

**Tests** : `tests/morpho.test.ts`, `tests/report-text.test.ts` (interdits un par un, règles souples, schéma vision, prompts), `tests/analysis.test.ts` (flux complet : calibré, sans carte, carte écartée, repos, courbure, refus, partiels, relances), `tests/xai-provider.test.ts`, `tests/photo-test.test.ts`, tests de bout en bout du rapport. API simulée : `src/lib/vision/simulation.ts` (rapport type conforme à toutes les règles pour 5 cas).

**À savoir**
- `content/seo/faq.md` (texte du propriétaire, non modifié) décrit encore l'ancien moteur (marge ± 10 %, refus sans carte, extraction de la ligne médiane) : à réécrire par le propriétaire (question 4).
- La réservation de dépense par analyse reste 0,03 $ (coût mesuré ci-dessous : environ 0,02 à 0,03 $ par analyse avec une relance).

**Appels réels (sans photo) et changement de modèle pour la rédaction**
- Appel vision (`grok-4.7`, raisonnement « low ») sur une image neutre fabriquée (formes géométriques) : schéma strict accepté, réponse conforme, « non recevable, sujet_non_conforme » (attendu) ; 4 219 jetons en entrée, 214 en sortie, 11,6 s.
- Appel texte avec `grok-4.7` : **dépassement du délai de 150 s** au premier essai ; une sonde à délai long a mesuré **199 s et 16 132 jetons de raisonnement** pour 1 487 jetons de texte (≈ 0,11 $ d'après le compteur de coût de l'API). Le raisonnement ne peut pas être désactivé sur ce modèle (documentation xAI).
- **Défaut corrigé** : le site ne comptait pas les jetons de raisonnement dans le coût (plafond quotidien, administration) ; ils sont maintenant ajoutés aux jetons de sortie (`src/lib/vision/xai.ts`, test).
- **Décision** : la rédaction passe sur un modèle sans raisonnement, `grok-4.20-0309-non-reasoning` (réglable : `XAI_TEXT_MODEL`) ; l'appel vision reste sur `grok-4.7`. Mesuré : **9,3 s, ≈ 0,005 $** ; puis par le circuit du site (`npm run xai:schema-check -- --texte-seul`) : premier texte rejeté par le code (mot interdit « netteté »), relance avec la liste des violations, texte accepté (654 mots, 9,1 s + 8,3 s). Le tarif configuré (`XAI_PRICE_IN_PER_M`, `XAI_PRICE_OUT_PER_M`, 2 et 6 $) est celui de `grok-4.7` : appliqué à la rédaction, il surestime son coût (tarif public du modèle sans raisonnement : 1,25 et 2,50 $), ce qui reste prudent pour le plafond.
- Retouches du prompt d'après les textes réels : traduction entre parenthèses à la première apparition seulement (le modèle en mettait après chaque mot), noms des indicateurs sans parenthèse, Note qui rappelle la méthode réelle (le modèle mentionnait une carte absente), clés JSON jamais recopiées, longueur visée d'environ 700 mots.
- **Dépense réelle estimée de la session : environ 0,25 $** (plafond 0,30 $) : 0,01 $ (vision) + au plus 0,11 $ (rédaction interrompue par le délai, facturation inconnue, comptée au pire) + 0,107 $ (sonde à délai long) + 0,005 $ (sonde sans raisonnement) + 0,012 $ (circuit complet, deux rédactions, au tarif réel). Plus aucun appel réel après cela.


## Étape 2 : calibration dans l'administration : FAIT
- Conservation : à chaque mesure calibrée sur la carte, une ligne de `calibration_pairs` (migration 010) : longueur et circonférence mesurées par la carte, longueur et circonférence estimées par le modèle **sans la carte**. Ni clé, ni date, ni lien avec un rapport ou une tentative. Paire non conservée si l'estimation sans carte sort de la plage plausible.
- Calcul (`src/lib/admin/calibration.ts`, testé) : par dimension, écart moyen (estimation − mesure, en cm et en %) par tranche de taille selon la mesure par la carte (longueur : < 11, 11–13, 13–15, 15–17, ≥ 17 cm ; circonférence : < 10, 10–11,5, 11,5–13, 13–14,5, ≥ 14,5 cm), écart moyen et absolu moyen d'ensemble, pente des moindres carrés (1 = aucun retour vers la moyenne).
- Administration (`/admin`, section « Calibration du modèle ») : deux nuages de points (mesure en abscisse, estimation en ordonnée, diagonale « estimation = mesure », info-bulle par point), tableaux par tranche, phrase d'aide à la lecture. Motifs de refus et de rapport partiel du nouveau moteur ajoutés au tableau « Refus par motif ».
- Test de bout en bout : cinq paires factices qui ramènent vers 13 cm → +1,5 cm dans la tranche « moins de 11 cm », pente 0,50.

## RAPPORT FINAL
- **Fait** : moteur photo-report/2 complet (deux appels, calculs par le code, texte vérifié, rapport partiel), rapport en compte rendu et PDF, calibration et graphique d'administration, notice `docs/TEST-PHOTO.md` à jour. `npm run verify` vert à chaque commit (768 tests unitaires, 172 de bout en bout). PHOTO_BETA inchangée (désactivée en production), rien déployé.
- **Appels réels** : environ 0,25 $ sur 0,30 $, sans aucune photo (image neutre fabriquée pour la vision ; valeurs factices pour la rédaction).
- **Reste à faire par le propriétaire** : tester le moteur complet avec sa photo (`docs/TEST-PHOTO.md`) ; réécrire la question de `content/seo/faq.md` sur la photo (elle décrit l'ancien moteur) ; répondre aux questions de fin de session (rapport partiel en version payante, longueur souple, modèle de rédaction, FAQ).
- **Limites connues** : la durée réelle avec une photo n'est pas mesurée (attendu : 10 à 20 s pour la vision, environ 10 s par rédaction, une relance fréquente) ; la règle « chaque phrase contient une valeur » et le ton ne sont pas vérifiables par le code (prompt seulement) ; les rapports partiels comptent comme « Erreurs » dans « Analyses lancées » de l'administration (leur motif commence par « Rapport partiel »).
