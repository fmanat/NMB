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

## Bloc 3 : latence de l'analyse xAI (image neutre uniquement)

Méthode : `npm run latency:bench` (outil avec plafond de dépense) appelle réellement l'API avec l'image neutre fabriquée par le script d'essai (un objet cylindrique à côté d'une carte, 3 000 × 2 000 px, aucune photo personnelle). « Attente avec photo » = ce que l'utilisateur attend avant l'aperçu ; la rédaction du commentaire se fait ensuite. Modèle `grok-4.7`.

| Config | Description | Essais | Attente avec photo (médiane · min–max) | Confiance moyenne du repérage (min) | Coût par analyse |
|---|---|---|---|---|---|
| A | 1 600 px · 2 appels à la suite · raisonnement par défaut | 1 | 186,7 s | 0,93 | 0,0217 $ |
| B | 1 600 px · 2 appels à la suite · raisonnement `low` | 2 | 33,7 s · 33,6–33,7 | 0,92 (0,91) | 0,0217 $ |
| F | 1 024 px · 2 appels à la suite · `low` | 2 | 35,0 s · 34,4–35,5 | 0,93 (0,93) | 0,0177 $ |
| C | 1 600 px · 1 appel fusionné · `low` | 2 | 38,4 s · 37,4–39,4 | 0,65 (**0,40**) | 0,0154 $ |
| D | 1 024 px · 1 appel fusionné · `low` | 2 | 18,5 s · 17,1–19,8 | 0,77 (**0,64**) | 0,0134 $ |
| G | 1 024 px · 1 appel fusionné · `minimal` | 6 | 19,1 s · 15,0–**173,3** | 0,65 (**0,12**) | 0,0137 $ |
| H | 1 600 px · 1 appel fusionné · `minimal` | 2 | 12,2 s · 10,1–14,3 | 0,28 (**0,28**, un essai inexploitable) | 0,0138 $ |
| **P** | **1 600 px · 2 appels EN PARALLÈLE · `low`** | 3 | **17,7 s · 16,2–22,2** | **0,93 (0,92)** | 0,0216 $ |
| Q | 1 024 px · 2 appels en parallèle · `low` | 3 | 21,3 s · 18,6–23,3 | 0,91 (0,89) | 0,0176 $ |

Paramètre de raisonnement : l'API accepte `minimal`, `low` et `medium` ; elle refuse `none` (HTTP 400). Le raisonnement par défaut est très lent (187 s).

**Décision : configuration P** (deux appels distincts lancés en parallèle, image de 1 600 px, raisonnement `low`). Raisons :
- critère demandé (« la plus rapide qui garde une confiance moyenne ≥ 0,8 ») : seules B, F, P et Q le remplissent sur tous leurs essais ; P est la plus rapide (médiane 17,7 s, maximum 22,2 s : objectif de 30 s atteint) ;
- les appels fusionnés (C, D, G, H) sont rapides mais **instables** : un essai sur trois à six a une confiance effondrée (0,12 à 0,64), ce qui provoquerait des refus injustifiés ;
- réduire l'image à 1 024 px n'améliore pas la vitesse des appels parallèles (Q plus lent que P) et baisse légèrement la confiance ; la taille reste donc 1 600 px (`UPLOAD.maxPx`), identique côté navigateur et serveur ;
- coût : 0,0216 $ par analyse, environ 40 % de plus qu'un appel fusionné, parce que le repérage est payé même si la photo est refusée. Accepté pour la fiabilité.

Limites : mesuré sur une image dessinée, pas sur des photos réelles ; la confiance est auto-déclarée par le modèle et ne mesure pas la précision (voir `docs/CALIBRATION.md`) ; 2 à 6 essais par configuration.

Vérification de bout en bout avec le vrai moteur (image neutre dessinée, via le site, `VISION_PROVIDER=xai`) : 18,5 s, image refusée « sujet non conforme » (attendu : ce n'est pas un sujet anatomique), message neutre, aucun rapport ni paiement, tentative journalisée avec motif, durée et jetons (6 960 entrée / 620 sortie).

**Dépense xAI de la session : environ 0,46 $** (plafond 0,50 $) : essais préalables sur le raisonnement 0,031 $ ; configuration A 0,022 $ (+ un essai interrompu, compté 0,022 $) ; campagne B, C, D, F, G, H 0,191 $ ; quatre essais G supplémentaires 0,055 $ ; configurations P et Q 0,118 $ ; passage par le site avec le vrai moteur 0,018 $.

## Bloc 4 : formules B et C

| Décision | Raison |
|---|---|
| Écrans, consentements, consignes, vérification d'âge simulée, étapes réelles, aperçu, paiement simulé et rapport : déjà en place depuis l'étape 3 ; revérifiés dans le navigateur (formule C, image 3 000 × 2 000 px). | Rien à refaire ; seules des finitions ont été ajoutées (ci-dessous). |
| Module d'analyse réel : deux appels parallèles (config P), `src/lib/vision/xai.ts`. Le repérage est ignoré si la photo n'est pas recevable ; s'il échoue sur une photo recevable, l'analyse échoue (message « service momentanément indisponible »). | Résultat du Bloc 3. |
| La photo reçue est abandonnée (`input.photo = null`) à la fin de tout traitement, y compris refus, erreur ou interruption. | « Suppression de la photo » demandée ; testé dans tous les cas. |
| Captcha et filtrage d'empreintes : interfaces simulées (défaut) et mode `off` (`CAPTCHA_PROVIDER=off`, `SCREENING_PROVIDER=off`). Tous interdits en production. | « Désactivables » demandé ; un vrai prestataire reste obligatoire en ligne. |
| Tests ajoutés : fournisseur xAI réel avec `fetch` simulé (requêtes, réglages, refus, erreurs, parallélisme, rien dans les journaux) ; photo jamais écrite sur disque (dossier temporaire isolé, racine du projet), ni en base (aucune colonne binaire, aucun contenu d'image), ni dans les journaux ; suppression de la photo en mémoire. | Exigence du cahier des charges (section 5) et de la session. |
| Formule de la durée affichée : « de 15 à 45 secondes ». | Mesures : 16 à 22 s d'attente avant l'aperçu, marge pour les pics. |

## Bloc 5 : qualité

**Rendu mobile.** Méthode : 17 pages (accueil, choix du protocole, questionnaire, envoi de photo B et C, méthode, FAQ, une page de guide, confidentialité, CGV, mentions légales, contact, rapport, partage, défi, vérification d'âge, connexion à l'administration) chargées dans des cadres de 320, 375, 390 et 768 px ; contrôle automatique du débordement horizontal. Seul défaut trouvé : la rangée des trois jauges de l'accueil débordait à 320 px (+33 px) et 375 px (+5 px). Corrigé (jauges plus petites et espacement réduit sur petit écran) ; 0 débordement ensuite aux quatre largeurs. Non couvert : chevauchements de texte (aucun outil automatique fiable) et vérification sur de vrais téléphones.

**Lighthouse** (version de production, émulation mobile par défaut, Chrome local) :

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| Accueil | 98 | 100 | 100 | 100 |
| Rapport (débloqué) | 95 | 100 | 100 | 63 |

Le SEO de 63 sur le rapport est voulu : la page est en `noindex` (adresse privée). Pistes restantes, non traitées car d'effet faible et liées au framework : CSS bloquant le rendu (80 à 120 ms), 29 Kio de JavaScript inutilisé, 14 Kio de JavaScript « ancien ». LCP 2,3 s (accueil) et 2,9 s (rapport) avec la simulation de réseau lent de Lighthouse.

**En-têtes de sécurité** (`next.config.ts`), tous servis en production et vérifiés :
- `Content-Security-Policy` : défaut `'self'`, scripts `'self' 'unsafe-inline'`, cadres interdits, objets interdits, formulaires et `base` limités au site, `frame-ancestors 'none'`, mise à niveau http → https seulement si `SITE_URL` est en https ;
- `Strict-Transport-Security` (2 ans, sous-domaines, sans `preload` : engagement difficile à défaire, à décider par le propriétaire), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (les adresses privées des rapports ne fuient pas vers d'autres sites), `Permissions-Policy` (caméra, micro, géolocalisation, USB coupés ; paiement limité au site), `Cross-Origin-Opener-Policy: same-origin`, en-tête « X-Powered-By » supprimé.

| Décision | Raison |
|---|---|
| CSP **sans nonces**, donc `'unsafe-inline'` pour les scripts. | Le guide de Next.js l'indique : un nonce impose le rendu dynamique de toutes les pages et ferait perdre les pages statiques (accueil, guides), donc la vitesse mobile exigée par le cahier des charges. La CSP bloque malgré tout les scripts, cadres et formulaires d'autres sites. L'option hash (SRI) est expérimentale. À revoir si un audit l'exige. |
| Vérification en production : interface interactive, action serveur (questionnaire) et redirection, sans violation de CSP ni erreur de console. | Une CSP mal réglée casse le site sans bruit. |
| `npm audit` : 0 vulnérabilité. | — |
| Quand un prestataire de paiement ou d'âge chargera un script, un cadre ou une connexion, ajouter **son domaine seulement** dans la CSP (commentaire dans `next.config.ts`). | Sinon sa page ne s'affichera pas ; ne jamais élargir à `*`. |

## Bloc 6 : préparation de la mise en ligne (rien n'a été déployé)

| Décision | Raison |
|---|---|
| README réécrit en français simple : installation locale, tableau de tous les réglages `.env`, où changer prix/poids/marges (`src/config/site.ts`), tâches programmées, mise en ligne en 10 étapes, commandes utiles. | Le README d'origine était celui du modèle Next.js ; l'utilisateur n'est pas informaticien. |
| Étape « écrire à l'hébergeur avant de payer » placée en premier dans la mise en ligne. | Aucune condition générale ne cite ce service ; seule une confirmation écrite protège d'une suspension. |
| Recherche d'hébergeurs dans `docs/HEBERGEMENT.md` : Clever Cloud recommandé, OVHcloud en repli, Scaleway ambigu, Hetzner écarté (clause 8.2 sur le contenu pornographique ou obscène, appliquée strictement selon ses déclarations publiques). | Comparaison des textes publiés. Les points techniques ne sont vérifiés que pour Clever Cloud. Ce n'est pas un avis juridique. |
| Aucun fichier de tâches programmées (`cron.json`) ajouté au dépôt. | Son format dépend de l'hébergeur, pas encore choisi. |
| Point noté : les scripts `db:purge` et `stats:webhook` utilisent `--env-file=.env`, qui échoue si le fichier n'existe pas ; chez un hébergeur (variables d'environnement), retirer cette option au moment du déploiement. | Éviter une purge qui échoue en silence en production. |

## Session de nuit, Bloc 1 : tests de bout en bout (Playwright)

| Décision | Raison |
|---|---|
| 17 tests dans `e2e/` : formule A, formules B et C (image neutre générée à la volée, jamais enregistrée), refus, carte de partage, défi, administration, sécurité. `npm run e2e`, inclus dans `npm run verify`. | Consigne de la session. |
| Les copies du site de test tournent avec `next dev` (et non `next start`), sur les ports 3201 (vision « ok ») et 3202 (« confiance basse »). | Le garde-fou qui interdit les moteurs simulés en production est figé à la construction (NODE_ENV=production) : un site construit ne peut donc jamais les utiliser, y compris en test. Je n'ai pas affaibli ce garde-fou. |
| `distDir` de Next.js lu dans `NEXT_DIST_DIR` (défaut `.next`). | Deux `next dev` ne peuvent pas partager un dossier de travail. Sans effet en production. |
| Base des tests de bout en bout : schéma `e2e` de la base `nmb_test`. | Le rôle `nmb` n'a pas le droit de créer une base. Les tests unitaires (schéma `public`) et la base de développement restent intacts ; un test unitaire filtre désormais le schéma `public`. |
| Adresse IP fictive différente à chaque test (en-tête `x-forwarded-for`). | La limite de 5 analyses par 24 h fausserait sinon les tests. |
| Mot de passe d'administration de test : écrit dans la configuration de test uniquement, transmis sous forme d'empreinte ; aucun fichier `.env`, aucune donnée persistée. | Consigne : « créé puis supprimé ». |
| Ajout d'une phrase sur le rapport payé : accessible au moins 3 ans et téléchargeable en PDF. | Trouvé en écrivant les tests : la promesse n'y figurait pas. |

## Session de nuit, Bloc 4 : préparation Clever Cloud

| Décision | Raison |
|---|---|
| Scripts de tâches dans `clevercloud/*.sh` (et non des commandes directes dans `cron.json`), appelés par `$ROOT/...`. | Clever Cloud déconseille d'appeler `bash` directement ; un script avec shebang est la forme documentée. Fins de ligne Unix forcées par `.gitattributes`. |
| Lecture de `POSTGRESQL_ADDON_URI` quand `DATABASE_URL` est vide. | Évite de copier le mot de passe de la base à la main. Sans effet si `DATABASE_URL` est renseigné. |
| `tsx` déplacé en dépendance de production. | La tâche quotidienne est un script TypeScript. |
| `NODE_ENV` ne doit pas être défini sur l'hébergeur. | Next.js le règle lui-même ; le définir à la construction pourrait empêcher l'installation des outils de construction. |
| Le script de purge planifié efface aussi les IP hachées de `analysis_attempts`. | Défaut découvert : incohérence avec la fonction `purgeExpired` et avec la politique de confidentialité (IP effacées après 24 h). |

## Session de nuit, Blocs 2 et 3 : prestataires et adaptateurs

| Décision | Raison |
|---|---|
| Comparaison des prestataires dans `docs/PRESTATAIRES.md`, avec recommandations et questions écrites ; aucune inscription, aucun message. | Consigne. Les citations sont de seconde main (résumés d'un outil de lecture) : à relire sur les pages. |
| Adaptateurs écrits pour les trois candidats dont la documentation est publique : **Stripe** (paiement), **AgeVerif** (âge), **ALTCHA** (captcha). Aucun pour le filtrage d'empreintes. | PhotoDNA n'a pas de documentation publique (accès après approbation) : écrire un adaptateur reviendrait à inventer une API. |
| Conséquence à connaître : **tant qu'aucun adaptateur de filtrage n'existe, les formules B et C ne peuvent pas tourner en production** (les modes `simulation` et `off` y sont interdits). Le propriétaire doit trancher (question 3 de PRESTATAIRES.md). | Je n'ai pas ajouté de mode « aucun filtrage » autorisé en production : c'est une décision de conformité qui n'est pas la mienne. |
| Stripe : appels HTTP directs, sans bibliothèque ; signature `Stripe-Signature` (schéma v1, HMAC-SHA256 de « horodatage.corps », tolérance 5 min, plusieurs v1 acceptés) ; seul un événement `checkout.session.completed` **payé** (ou `async_payment_succeeded`) débloque ; événement d'un autre type : acquitté sans effet (`verifyWebhook` peut renvoyer `null`). | Documentation Stripe. Un événement inutile ne doit pas provoquer de nouvelles tentatives d'envoi par Stripe. |
| Retour de paiement : la page du rapport se recharge toute seule pendant 1 minute (`?retour=1`). | La notification signée peut arriver après le visiteur ; le rapport ne s'ouvre jamais sans elle. |
| AgeVerif : flux OAuth2, échange du code de serveur à serveur, confirmation par `/resources`, majeur = `verified` vrai **et** `age_threshold` ≥ 18. `state` signé (HMAC, 15 min) qui mémorise l'écran de retour (uniquement `/analyse/photo?f=B|C`). L'interface d'âge renvoie maintenant `returnPath`. | Documentation AgeVerif. Corrige aussi un défaut : le retour envoyait toujours vers la formule B. |
| Aucune donnée d'identité d'AgeVerif (identifiant, pays) n'est lue ni conservée. | Minimisation. |
| ALTCHA : protocole **v1** (SHA-256), auto-hébergé, sans dépendance, solveur écrit dans le dépôt ; usage unique des défis (table `captcha_used`, sans IP) ; difficulté 100000 par défaut. | La v2 utilise une dérivation de clé dont je n'ai pas pu lire la spécification ; la v1 reste prise en charge par la bibliothèque. Compatibilité avec le composant officiel non testée : à essayer avant la mise en ligne si on veut l'utiliser. |
| CSP : `form-action` élargi à `checkout.stripe.com` et `api.ageverif.com`. | Les formulaires redirigent vers ces deux pages. |
| `.env.example` : BOM supprimé ; variables des adaptateurs documentées. | Une marque d'ordre des octets ne doit jamais se retrouver dans un `.env`. |

## Session de nuit n° 3 : décisions du propriétaire (inscrites au début de la session)

| Décision | Détail |
|---|---|
| Hébergeur : **Railway** (région UE) | Remplace Clever Cloud. DNS de bitometre.com chez **Cloudflare**. Les fichiers `clevercloud/` et `docs/CLEVER-CLOUD.md` restent dans le dépôt comme solution de repli, marqués obsolètes. |
| **Stripe exclu définitivement** | Adaptateur laissé dans le code, désactivé (aucune clé), non supprimé. Prestataire visé : **Verotel** ; repli **CCBill** ou **Segpay**. |
| Vérification d'âge | Demandes envoyées **en parallèle à AgeVerif et à Yoti**, décision sur **réponses écrites** ; critère principal : **indépendance vis-à-vis des exploitants de sites pour adultes**. |
| Filtrage d'empreintes | **Demande d'éligibilité à PhotoDNA** ; la question du signalement est **tranchée par le juriste**. |
| Captcha | **ALTCHA auto-hébergé**, **Friendly Captcha** en repli. |
| Juridique | **Relecture complète par un juriste avant le passage au payant.** |
| Comptes | Claude **prépare** les demandes ; le propriétaire **les envoie**. |
| Ltd | Raison sociale, numéro Companies House et siège **non communiqués** (champs vides dans la consigne) ; l'établissement en France n'est **pas** mentionné (pas encore immatriculé). |

## Session de nuit n° 3, Bloc 1 : mode « bêta gratuite »

| Décision | Raison |
|---|---|
| **Marqueurs `[À COMPLÉTER : ...]`** pour l'identité de la Ltd (`src/config/company.ts`) + garde-fou : en production, sans `SITE_PASSWORD`, tant qu'un marqueur existe, tout le site répond 503 (sauf `/api/health`). | Choix du propriétaire (consigne laissée vide, QCM d'ouverture). Le garde-fou empêche d'ouvrir au public avec des mentions légales vides ; il n'agit pas hors production ni sur le site protégé par mot de passe. Un test vérifie que les marqueurs sont bien détectés. |
| Chemins masqués en bêta : 404 par `src/proxy.ts` (et pages gardées), liste dans `src/lib/mode.ts`. | « Routes en 404, aucune mention ailleurs ». Un test parcourt chaque chemin. |
| Rapport de la bêta : `paid = true`, `free_beta = true`, `paid_at` vide, aucune ligne dans `payments`. Exclu de la conversion ; compté à part dans l'administration. | Ne pas fausser les statistiques ni la comptabilité. |
| **Durée de conservation des rapports de la bêta : 90 jours** (purge horaire). | La consigne dit « sans garantie de conservation » ; une durée maximale limite les données sensibles conservées (RGPD, minimisation). Option la plus prudente, annoncée dans les conditions, l'accueil et le rapport. |
| **Case de consentement explicite** (art. 9) ajoutée au questionnaire, **en bêta seulement**, par un champ `consent` vérifié côté serveur. | La politique de confidentialité de la bêta affirme un consentement explicite ; il faut qu'il existe. Les valeurs déclarées de taille sont des données relatives à la vie sexuelle ou à la santé selon l'interprétation. |
| Un rapport non payé créé avant la bêta n'est pas proposé en bêta (404). | Ne jamais débloquer un rapport existant sans décision ; il est purgé après 24 h de toute façon. |
| `/cgv` : 404 en bêta ; `/conditions` : 404 hors bêta. Pied de page et sitemap suivent le mode. | « Conditions de la bêta à la place des CGV ». |
| `DB_POOL_MAX` (défaut 10) borne les connexions à la base. | « Limite le nombre de connexions simultanées… valeur prudente ». |
| Hébergeur dans les mentions légales : « Railway Corporation (États-Unis) » (nom lu sur railway.com/legal/acceptable-use) ; adresse en marqueur. | Adresse non lisible dans les pages consultées : à compléter. Je n'invente rien. |
| Le `.env` local ne contenait **pas** `ADMIN_PASSWORD_HASH` (la consigne disait « réutilise l'empreinte déjà présente »). | Voir Bloc 3 : mot de passe d'administration généré aléatoirement pour le site de test. |
| Hors périmètre (note) : les guides de `content/seo/` (rédigés par le propriétaire) peuvent citer des prix ; ils ne sont pas publiés (`SEO_PUBLISH` vide), donc absents du site de test. À relire avant publication en mode bêta. | Règle : je ne réécris pas ces textes. |

## Session de nuit n° 3, Bloc 2 : entonnoir de conversion

| Décision | Raison |
|---|---|
| Comptages d'événements, **pas de visiteurs uniques** : aucune déduplication possible sans cookie ni IP. Les taux sont annoncés comme des ordres de grandeur dans l'administration. | « Sans cookie ni adresse IP » : seule option compatible. |
| Événements de navigation envoyés par le navigateur (liste fermée de 4) ; événements d'action (questionnaire terminé, carte créée) écrits par le serveur ; défis et paiements lus dans les tables existantes. | Un événement serveur ne peut pas être falsifié par un script ; un chargement de page se mesure côté navigateur (les pages d'accueil sont statiques). |
| Le rapport n'est compté qu'une fois par onglet (`sessionStorage`, stocké sur l'appareil, jamais envoyé). | Ne pas compter les rechargements. |
| Respect de Do Not Track et Global Privacy Control ; robots écartés par le user-agent (qui n'est pas conservé). | Option la plus prudente pour la vie privée. Le filtre « headless » n'est pas appliqué, pour que les tests navigateur soient comptés. |
| Pas de limitation de débit sur `/api/e`. | Sans IP, pas de clé. Risque : gonflement des compteurs par un tiers ; aucun effet sur les données personnelles. À revoir si un abus apparaît (limite globale). |
| Un échec d'écriture d'un événement est journalisé et ignoré. | La mesure ne doit jamais casser le parcours. |
