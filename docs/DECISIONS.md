# Décisions prises pendant la session autonome du 01/10/2026

Règle suivie : pour toute décision non couverte par SPEC.md, l'option la plus prudente est retenue et notée ici avec sa raison.

**Budget xAI de la session : 0,50 $ maximum.** Dépense cumulée : voir la fin du document.

## Bloc 1 : finitions et textes juridiques

| Décision | Raison |
|---|---|
| Raison sociale du prestataire d'analyse : **SpaceXAI LLC** (société du Nevada, siège 800 W Cesar Chavez St., Austin, TX 78701), connue sous le nom xAI, anciennement X.AI Corp. | Lue dans les conditions officielles (consommateur et « Enterprise », qui régissent l'API) via une archive publique du 30/09/2026 : « SpaceXAI LLC is a Nevada company, with its registered offices at… ». Le site x.ai bloque les robots ; la source est donc l'archive web.archive.org de ses pages. À revérifier à la signature du contrat. |
| Le site x.ai propose un accord de traitement des données (lien « DPA » dans son pied de page). | À signer avant la mise en ligne (RGPD art. 28). Non signé, non référencé. |
| Libellé de la case de renonciation : « Je demande l'accès immédiat à mon rapport, je renonce à mon droit de rétractation et je reconnais le perdre dès que l'accès commence. » | Le règlement 37 des CCR 2013 exige le consentement exprès ET la reconnaissance de la perte du droit. Vérifié sur legislation.gov.uk : « (a) the consumer has given express consent, and (b) the consumer has acknowledged that the right to cancel… will be lost ». |
| **Article L221-28, 13° du Code de la consommation : texte non relu sur Légifrance** (le site bloque les robots ; archive aussi). | La référence est reprise telle que demandée ; le contenu du 13° (contenu numérique non fourni sur un support matériel, exécution commencée après accord préalable exprès et renoncement exprès) est confirmé par des résumés de recherche web, pas par le texte officiel. **À faire relire par un juriste.** |
| « Accès à vie » retiré du formulaire de paiement et de l'accueil ; remplacé par « sans abonnement » / « accès à votre rapport par son lien privé ». | Promesse de durée illimitée risquée pour un petit service ; SPEC.md (section 3) la conserve comme intention commerciale, à arbitrer par le propriétaire. |
| Pages juridiques : structure fournie, tous les champs inconnus en `________`, bandeau « à relire ». | Aucune donnée inventée. Pas de médiateur ni de juridiction nommés faute d'information. |
| CGV : droit anglais avec préservation des dispositions impératives de la loi du pays de résidence habituelle du consommateur. | Formulation demandée ; conforme au principe du règlement Rome I (art. 6, § 2) pour les consommateurs de l'UE, à valider juridiquement (le Royaume-Uni applique sa version conservée de ce règlement). |

## Bloc 2 : géométrie et calibration sans photo

**Constat.** Le calcul d'origine (homographie de la carte appliquée à tous les points) se trompait beaucoup sur des scènes simulées réalistes : longueur surestimée d'environ 6 % même en vue de dessus (l'objet posé est plus près de l'appareil que la carte), et circonférence surestimée de 6 % à 0° jusqu'à 72 % à 45° (médiane), avec une erreur maximale de 207 % et 0 % des cas dans la marge au-delà de 15°.

| Décision | Raison |
|---|---|
| Nouveau calcul avec pose de l'appareil (`src/lib/pose.ts`) : pose déduite de la carte avec une focale supposée de 0,9 × le grand côté de l'image (objectif principal d'un smartphone) ; points de la ligne médiane placés à la hauteur du rayon au-dessus de la carte ; rayon déduit de l'écart angulaire des deux bords tangents. | Avec repérage parfait : erreur maximale 6,1 % (contre 207 %), 100 % des cas dans la marge. Très peu sensible à la focale réelle : ±20 % donne 6 % au maximum ; ultra grand-angle (×0,5) 16,5 %. |
| Hypothèse retenue : sujet posé sur la même surface que la carte, section circulaire. | Consigne de prise de vue du site. Un sujet tenu en l'air n'est pas couvert ; à vérifier à la calibration. |
| **Refus si inclinaison > 50°** (`PHOTO_LIMITS.maxTiltDeg`). | Stable jusqu'à 50° ; à 55° et plus, des erreurs de 17 à 21 % apparaissent (confusion long/court côté de la carte). |
| **Refus si la carte occupe moins de 15 % du grand côté de l'image** (`PHOTO_LIMITS.minCardFraction`). | Avec 2 px de bruit par point : erreur au 90e percentile de 18 % pour une carte de 150 px, 9 % à 250 px, 6 % à 400 px, 3,5 % à 600 px. Sous 240 px (sur 1 600), la marge affichée serait trop grande pour être utile. |
| Marge = max(10 %, racine de la somme des carrés de trois termes : confiance, taille de la carte, inclinaison). Bruit supposé de repérage : 2 px par point. | La taille de la carte domine l'erreur due au bruit (erreur ≈ 2 700 / largeur de la carte en px, en %). Résultat en simulation bruitée : 94 % des cas dans la marge, 98 à 100 % pour une carte de 400 px ou plus. **Le bruit réel du modèle est inconnu : à régler par la calibration (`MARGIN.markerNoisePx`).** |
| Le simulateur de prise de vue est placé dans `src/` (`src/lib/vision/camera-sim.ts`) et sert aussi au fournisseur de vision simulé. | Les scènes simulées du site en développement sont désormais cohérentes avec le calcul ; interdit en production comme les autres fournisseurs simulés. |
| Ancien calcul conservé dans le code (`estimateMeasures`) uniquement pour le mode règle du script d'essai xAI et pour les tests qui documentent pourquoi il a été abandonné. | Le mode règle n'a pas de carte, donc pas de pose. |

Commandes : `npm run geometry:report` (tableaux complets), `npm run verify` (tout : lint, types, tests, SEO, build).
