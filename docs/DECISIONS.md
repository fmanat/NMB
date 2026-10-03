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

## Session de nuit n° 3, Bloc 4 : adaptateur Verotel

| Décision | Raison |
|---|---|
| Adaptateur FlexPay écrit d'après le **client officiel** de Verotel (signature, URL d'achat) et la bibliothèque tierce `pipisco/laravel-verotel-flexpay` (événements et paramètres de notification). La documentation officielle FlexPay est derrière une connexion : **non lue**. | Seule source publique complète. Les points non couverts sont listés « À CONFIRMER en mode test » dans `src/lib/payments/verotel.ts` et `docs/PRESTATAIRES.md`. |
| La signature SHA-256 est vérifiée contre le **jeu d'essai public** du client officiel (la signature SHA-1 de son test est reproduite à l'identique par la même construction). | Seul vecteur de test indépendant disponible. |
| Notifications signées en **SHA-1 refusées par défaut** (`VEROTEL_ACCEPT_SHA1=on` pour les accepter). | Le client officiel les accepte « pour l'ancien format » ; plus prudent de ne pas affaiblir la signature sans confirmation de Verotel. |
| Notification de succès acceptée si `event=initial`, ou sans `event` avec `type=purchase` et un `saleID` (À CONFIRMER). Tout autre événement : acquitté sans effet. | Je ne sais pas lequel des deux Verotel envoie pour un achat unique ; refuser les deux bloquerait tout déblocage. |
| **Aucun identifiant de rapport n'est envoyé à Verotel** : référence aléatoire `nmb_…`, retour par `/paiement/retour` (sans paramètre) et cookie fonctionnel `nmb_pay` (httpOnly, 2 h, chemin `/paiement`). | L'adresse privée du rapport donne accès au rapport : elle ne doit pas figurer dans une adresse de retour vue par un tiers (l'adaptateur Stripe, désactivé, le faisait). Ce cookie est à mentionner dans la politique de confidentialité de la version payante (juriste). |
| Réponse à Verotel : texte « OK » (200) quand la signature est valide, même si la notification est sans effet ; 500 si la signature est invalide ou en cas d'erreur technique. | Exemple officiel (`examples/postback.php`) ; évite le renvoi en boucle d'une notification inutile, et provoque le renvoi quand la base est indisponible. |
| Remboursement (`credit`) et contestation (`chargeback`) : statut `refunded` / `disputed`, `paid=false`, rapport reverrouillé, `paid_at` du journal effacé (bandeau et conversion), **rapport conservé 30 jours** puis purgé (au lieu de 24 h). Une contestation reste « disputed » même si un remboursement suit. Un succès rejoué après remboursement ne redébloque jamais. Un rapport reverrouillé **ne peut pas être repayé**. | « Le rapport se reverrouille ». Garder 30 jours laisse au client le temps de contacter le support ; interdire le repaiement évite un contournement après contestation (Verotel « blacklists the buyer » selon la bibliothèque tierce). |
| Migration 008 : statuts `refunded` / `disputed`, `provider_sale_id`, `refunded_at`, `relocked_at`. L'administration affiche les remboursements et contestations de la période (exclus du revenu). | |
| CSP `form-action` : `secure.verotel.com` ajouté, **`checkout.stripe.com` retiré**. | Stripe est exclu ; l'origine Verotel est nécessaire à la redirection depuis le formulaire de paiement. À réintroduire si Stripe était un jour réactivé. |
| La commission provisoire de 12 % (`FINANCE.paymentFeeRate`) n'a **pas** été modifiée. | Le compte Basic de Verotel affiche 15,5 % (tarif public) : décision de chiffrage laissée au propriétaire (question dans le rapport final). |

## Session de nuit n° 3, Bloc 8 : accessibilité et petits écrans

**Méthode.** Contrôle automatique avec **axe-core** (`@axe-core/playwright`, ajouté en dépendance de développement) : règles WCAG 2.0, 2.1 et 2.2 niveaux A et AA plus bonnes pratiques, sur toutes les pages des deux modes (bêta : `e2e/accessibilite.spec.ts` ; version payante : `e2e/accessibilite-payant.spec.ts`), y compris les états d'erreur et la fenêtre d'âge ouverte. Tests clavier et structure écrits à la main. **Limite : aucun essai avec un vrai lecteur d'écran (NVDA, VoiceOver, TalkBack) ni sur de vrais téléphones n'a été fait ; axe-core ne détecte qu'une partie des défauts d'accessibilité.**

| Constat (avant) | Correction |
|---|---|
| Deux zones de navigation sans nom (axe : `landmark-unique`) | « Principale » (en-tête), « Informations légales » (pied de page) |
| Aucun lien d'évitement | « Aller au contenu » (premier élément atteint par Tab, visible au focus), contenu principal `id="contenu"` |
| Pas de style de focus global ; champs avec `outline-none` : seul un changement de bordure | Contour de 3 px orange sur tout `:focus-visible` (`!important` pour passer devant `outline-none`) ; cibles de la navigation d'en-tête agrandies |
| Menu déroulant de la carte sans nom accessible (axe : `select-name`, critique) | `aria-label` |
| Page de carte publique sans titre de niveau 1 | Le numéro de rapport est un `h1` |
| Jauges décoratives annoncées comme images | Masquées aux lecteurs d'écran quand elles n'ont pas de valeur |
| Champ du lien de défi sans étiquette ; « Copié » non annoncé | `aria-label` + zone `role="status"` |
| En-têtes de colonnes sans `scope` ; première colonne en cellules ordinaires ; en-tête vide | `scope="col"` / `scope="row"`, en-tête vide nommé pour les lecteurs d'écran |
| Fenêtre d'âge : titre non relié, erreur non annoncée | `aria-labelledby`, `role="alert"` |
| Mouvement réduit : seule une transition de survol existait | Règle `prefers-reduced-motion` globale (aucune animation ni transition) ; test qui vérifie que rien ne bouge |

Constat sans correction nécessaire : contrastes (axe : aucune violation), langue de la page, repères, hiérarchie des titres, étiquettes des champs, `role="alert"` des erreurs du questionnaire, fenêtre modale native (focus piégé, Échap, retour du focus).

**Petits écrans (320, 375, 390 px).** Nouveau détecteur (`e2e/layout.ts`) fondé sur les rectangles réels de chaque morceau de texte : défilement horizontal, texte coupé à droite ou à gauche, contenu masqué par `overflow`, **textes qui se recouvrent**. Appliqué à toutes les pages et à plusieurs états (fenêtre d'âge ouverte, erreurs) dans les deux modes. **Aucun défaut réel trouvé.** Deux fausses alertes du détecteur ont été corrigées dans le détecteur lui-même (et non « résolues » dans le site) : l'interligne serré du score (le rectangle de la police dépasse l'interligne sans que les caractères se touchent) et le texte réservé aux lecteurs d'écran ; la page masquée derrière une fenêtre modale est ignorée. Un test de sensibilité vérifie que le détecteur signale bien un vrai recouvrement, un texte qui sort de l'écran et un défilement horizontal (sinon un test vert ne prouverait rien).

## Session du 02/10/2026 : réponses du propriétaire au rapport de la nuit 3

| Décision | Détail |
|---|---|
| Ltd | Les six champs sont **restés vides** dans la réponse (1A). Seul le numéro ICO a une valeur de repli décidée : « enregistrement en cours ». Les autres restent des marqueurs `[À COMPLÉTER]` : le site reste fermé au public sans mot de passe. |
| Hébergeur dans les mentions légales | Railway Corporation, 548 Market St, PMB 68956, San Francisco, California 94104, États-Unis. Sources : https://railway.com/legal/terms (« Address: 548 Market St Suite 68956 ») et https://railway.com/legal/dpa (« 548 Market St PMB 68956 »), lues le 02/10/2026. L'écart « Suite » / « PMB » vient de ces deux pages ; « PMB » (celui du DPA et de l'agent DMCA) a été retenu. |
| CCBill et Segpay | Lus ; recommandation dans `docs/PRESTATAIRES.md` : Verotel et CCBill en parallèle, Segpay en 3e (son site bloque les outils automatiques : seconde main seulement). Demandes préparées. |
| Sauvegardes | Activées (quotidienne, 6 jours de conservation) et restauration testée sur un service séparé, avant l'ouverture de la bêta. Reste : constat de deux sauvegardes successives, copie hors Railway. |
| Limite de dépense Railway | Posée par le propriétaire. |
| Remise à zéro | Faite sur confirmation écrite (base de test vidée, vérifiée vide). |
| Commission provisoire | 15,5 % (`FINANCE.paymentFeeRate`). |
| Ouverture de la bêta | Après une consultation juridique d'une heure limitée à B1-B5 et B13 : `docs/JURISTE-COURT.md`. |

## Session de nuit 4, bloc 1 : bandeau « scanner » (décisions prises seul, option la plus prudente)

| Question | Décision |
|---|---|
| Où placer le bandeau sans repousser le bouton hors du premier écran ? | Dans le hero, à la place de l'aperçu de rapport (mobile : entre le texte et les boutons, ordre du DS-01 section 31 ; ordinateur : colonne de droite). Le rapport complet reste dans `#exemple`. |
| Forme de l'objet | Cylindre court à bases plates (diamètre supérieur à la hauteur), aucune forme allongée ni arrondie : rien qui puisse évoquer une anatomie. |
| Technologie | Canvas 2D et projection maison, aucune dépendance (WebGL et bibliothèques écartés : poids et risque pour la note de performance). |
| Mouvement réduit | Image fixe ; le glissement redessine seulement pendant le geste (pas d'inertie, pas de boucle). |
| Tactile | `touch-action: pan-y` : le glissement vertical fait défiler la page, seul le glissement horizontal fait tourner. |
| Couleurs du bandeau | Jetons sombres existants (`--bm-dark-*`, `--bm-blue-400`) ; badge « Exemple » en ambre sur fond sombre (contraste vérifié par axe-core). |

## Session de nuit 4, bloc 2 : section « Essayez » (décisions prises seul, option la plus prudente)

| Question | Décision |
|---|---|
| Où placer la section ? | Juste après le hero (donc sous le bandeau scanner), avant les garanties. Le hero et son bouton principal ne sont pas modifiés. |
| Comment réutiliser les calculs sans embarquer zod dans le navigateur ? | `src/lib/reportCore.ts` (pur, sans zod) reçoit les calculs du rapport sans en changer une ligne ; `report.ts` garde le schéma de validation et ré-exporte tout (les imports existants ne changent pas). Un type de garde fait échouer la compilation si le schéma et le type partagé divergent. Vérifié : HTML du tableau de bord et résultats identiques avant et après (36 rapports). |
| Comment réutiliser l'affichage ? | Les cartes de longueur et de circonférence, les encadrés « Au-dessus de X % » et les repères de taille sont extraits de `ReportDashboard` dans `ReportParts.tsx` (sortie identique) ; la simulation les appelle telles quelles : aucun libellé nouveau pour les chiffres. |
| Bornes des curseurs | Celles du questionnaire (`LIMITS` : 2 à 30 cm et 3 à 25 cm), pas de 0,1 cm. |
| Valeur hors plage plausible (au-delà de 4 écarts-types) | Comme le questionnaire : aucun résultat, même message (`OUT_OF_RANGE_MESSAGE`, désormais partagé avec l'action serveur). On n'affiche jamais un chiffre que le vrai flux refuserait. |
| Courbure | Non proposée (non demandée) ; la courbure de l'exemple sert seulement à construire l'objet rapport, sans influence sur ce qui est affiché. |
| Chargement | La section est rendue par le serveur (titre, mention, bouton) ; la simulation est un import dynamique déclenché quand 15 % de la zone entrent à l'écran (jamais au premier affichage d'un téléphone). Zone à hauteur réservée. |
| Cartes en double sur la page | Les cartes sont déjà présentes dans le rapport d'exemple plus bas : la simulation les rend sans repère de région (`landmark={false}`) pour éviter deux régions de même nom (axe-core `landmark-unique`). |
| Lien vers le questionnaire | Le bouton `ScanButton` habituel (contrôle d'âge puis `/analyse`), libellé « Remplir le vrai questionnaire ». |

## Session de nuit 4, bloc 3 : bandeau défilant d'informations vraies (décisions prises seul, option la plus prudente)

| Question | Décision |
|---|---|
| Que devient l'ancien bandeau de statistiques de l'en-tête ? | Supprimé (composant, route `/api/stats`, `publicStats`, `globalStats`) : il interrogeait le serveur depuis le navigateur sur chaque page et son compteur ne pouvait pas s'afficher en bêta. Remplacé par le bandeau de l'accueil, rendu côté serveur. |
| Définition de « analyses terminées » | Lignes du journal anonyme dont le rapport est **débloqué** (bêta gratuite, ou payé non remboursé), tous protocoles ; jamais un rapport simplement créé. Le journal survit aux suppressions : le compteur ne baisse pas quand un visiteur efface son rapport (une analyse réalisée reste réalisée). Libellé « Analyses réalisées », sans promesse sur la qualité des valeurs (déclarées ou estimées). |
| Seuil | `TICKER.analysesThreshold = 500`, **strictement au-delà** (500 n'affiche rien, 501 affiche). Compteur et score moyen vont toujours ensemble, calculés sur la même requête. |
| Fraîcheur du compteur | Accueil statique régénéré toutes les 5 minutes (`revalidate = 300`), plutôt qu'une page dynamique à chaque visite (performance) ou un appel du navigateur (interdit par la consigne). Lecture de la base avec mémoire courte, délai maximal 1,5 s, jamais bloquante. |
| « Médiane de référence » | Longueur en érection (13,12 cm), lue dans les constantes ; c'est la moyenne de Veale et al. parce que le site suppose une loi normale (médiane = moyenne), ce qu'un test vérifie. Un seul élément (longueur), pour ne pas allonger le bandeau. |
| « Nombre de mesures » | Compté sur les clés de `REPORT_MEASURES` présentes dans le rapport de formule A (longueur, circonférence, courbure, score) : celles que la page présente déjà sous « Quatre indicateurs ». La symétrie des formules photo n'est pas comptée (désactivées, absente du rapport du questionnaire). |
| Date de version | Date de construction (pas de déploiement : le build a lieu au déploiement par `railway up`). Libellé « Version du <date> ». Absente ou invalide : l'élément disparaît, jamais une fausse date. |
| Accessibilité du défilement | Une seule liste réelle pour les lecteurs d'écran ; le défilement (deux copies) en `aria-hidden` ; mouvement réduit : liste statique visible, sans copie ni case. Case « Pause » en plus du survol et du focus (critère WCAG 2.2.2, sans JavaScript). |
| Détecteur `e2e/layout.ts` | Étendu aux contenus « sr-only » imbriqués (une boîte rognée à 1 px contient la liste), avec un test de sensibilité : on ne cache pas un défaut, on corrige une fausse alerte du détecteur, et le même texte rendu visible reste signalé. |
| Réglage de test | `TICKER_STATS_TTL_MS` (0 pour les sites de test e2e) : sans mémoire, un test qui remplit la base voit le compteur tout de suite. Valeur par défaut inchangée (60 s) en production. |


## Session de nuit 4, bloc 4 : profils morphologiques (décisions prises seul, option la plus prudente)

| Question | Décision |
|---|---|
| Seuils | Trois classes par axe : percentile **inférieur à 33**, **de 33 (inclus) à 67 (exclu)**, **67 ou plus** (`LOW_BELOW`, `HIGH_FROM` dans `src/lib/profiles.ts`). Même règle aux deux axes et aux deux bornes : chaque classe contient sa borne basse, donc 33 est « moyen » et 67 est « haut ». Le percentile est arrondi à une décimale avant la comparaison, comme le rapport l'affiche (32,96 s'affiche 33,0 : classe moyenne). Seuils simples et lisibles ; la classe centrale (34 points) est un peu plus large que les deux autres (33), choix assumé plutôt que des tiers exacts à décimales. |
| Ce dont le profil dépend | Uniquement des deux percentiles réellement calculés (longueur, circonférence). Ni le score, ni la courbure, ni la formule. Aucune statistique sur la fréquence des profils n'est affichée ni inventée. |
| Identifiants | `l<1-3>c<1-3>` (rang de la classe de longueur, puis de circonférence), figés par un test : ils sont enregistrés dans les cartes de partage et ne doivent jamais changer ; les noms et phrases, eux, peuvent évoluer. |
| Noms (longueur en lignes, circonférence en colonnes) | l1c1 **L'Épuré**, l1c2 **Le Compact**, l1c3 **Le Concentré** ; l2c1 **L'Élancé**, l2c2 **Le Centré**, l2c3 **L'Ample** ; l3c1 **Le Longiligne**, l3c2 **L'Étendu**, l3c3 **Le Panoramique**. Mots du registre de la forme et du format, choisis pour ne désigner aucune anatomie, ne pas évoquer « petit » ou « grand » et ne placer aucune case au-dessus d'une autre ; les cases extrêmes (l1c1 et l3c3) ont le même ton bienveillant. |
| Phrases | l1c1 « Un profil dépouillé, qui se lit d'un coup d'œil et que le laboratoire consigne avec plaisir. » ; l1c2 « Un profil ramassé et cohérent, que le laboratoire classe volontiers dans la catégorie « se retient facilement ». » ; l1c3 « Un profil concentré, qui fait tenir l'essentiel dans un format resserré : l'équivalent d'une note de synthèse. » ; l2c1 « Un profil élancé, dont le laboratoire apprécie la ligne nette, comme sur un graphique bien tracé. » ; l2c2 « Un profil centré, qui se tient dans la partie médiane du graphique, là où le laboratoire n'a jamais besoin de modifier l'échelle. » ; l2c3 « Un profil ample, qui occupe volontiers la largeur de la page : le laboratoire prévoit simplement une marge confortable. » ; l3c1 « Un profil longiligne, qui s'étire sur toute la hauteur du tableau et que le laboratoire reproduit en pleine page. » ; l3c2 « Un profil étendu, qui prend ses aises sur l'axe des longueurs, ce que le laboratoire note avec la plus grande neutralité. » ; l3c3 « Un profil panoramique, à grand angle sur tous les axes : le laboratoire recommande simplement un peu de recul pour en apprécier l'ensemble. » Une seule phrase chacune, ni chiffre ni nombre en lettres, aucun comparatif à une norme ni promesse (vérifié par test avec une liste de termes interdits). |
| Représentation visuelle | Mots, une phrase et un repère géométrique : une grille de neuf carrés dont un est plein (`aria-hidden`). Aucune illustration de forme corporelle. |
| Où le profil s'affiche | Rapport débloqué, exemple de l'accueil (badge « Exemple fictif »), option de la carte de partage, grille complète sur la page méthode. Pas dans l'aperçu verrouillé de la version payante (aucun résultat avant paiement), pas dans « Essayez » (non demandé). |
| Carte de partage | Case à cocher « Ajouter mon profil morphologique », désactivée par défaut, indépendante du mode choisi (score, percentiles, mesure de référence). Seule la valeur `true` active l'option côté serveur. Le contenu enregistré ne reçoit le champ `profile` (identifiant seul, jamais le nom ni les percentiles) que si la case est cochée ; le nom apparaît sur la page publique et sur les deux images, jamais dans le titre ni dans les métadonnées de partage (Open Graph, Twitter). |
| Rétrocompatibilité | `cards.content` est du jsonb et le champ est facultatif : aucune migration (la suivante reste 009). Les cartes déjà créées n'ont pas la clé et s'affichent comme avant ; un identifiant de profil inconnu est ignoré (rien n'est affiché). Les liens privés, les cartes et les défis ne changent pas. |
| Page méthode | Tableau (légende, en-têtes de colonne et de ligne) sur écran large, liste groupée par classe de longueur sur mobile (un seul des deux est affiché). Les libellés de classe et l'explication des seuils sont lus dans les constantes : changer un seuil change la page. |

## Nuit 4, bloc 5 : animations à l'apparition

| Question | Décision |
|---|---|
| Déclencheur | `IntersectionObserver` minimal (un composant client dans la mise en page) posant un attribut `data-reveal`, plutôt que `animation-timeline: view()` : ce dernier lie l'animation au défilement (elle suivrait le doigt) et non à une durée, et n'existe pas partout. |
| Sans JavaScript / échec | Les animations ne sont déclarées que sous `[data-reveal="run"]`, posé par le script : sans lui, valeur finale visible. Aucune règle ne masque un texte. |
| Mouvement réduit | Le script ne s'active pas ; la CSS neutralise toute animation et transition de ces éléments. |
| Une seule fois | L'élément n'est plus observé après son déclenchement. Pas de rejeu au retour dans l'écran ni quand un curseur bouge ; le changement de valeur utilise une transition de 200 ms. |
| Éléments déjà visibles au chargement | Rejeu bref après hydratation accepté, plutôt que de masquer du contenu avant le script (plus prudent pour la lisibilité et le LCP). |
| Valeurs | Aucune valeur ni durée inventée : durées = variables de la section 37 ; les animations ne révèlent que les valeurs calculées. |

## Nuit 4, bloc 6 : formule photo en bêta, réponse standardisée (décisions prises seul, option la plus prudente)

| Question | Décision | Alternative écartée |
|---|---|---|
| Un seul JSON du modèle (recevabilité + repérage + commentaire) ou plusieurs ? | **Trois réponses JSON strictes** marquées de la même version `photo-report/1` : recevabilité ‖ repérage (configuration P mesurée au bloc 3 de la nuit 3, inchangée) puis commentaire en texte seul. | Un appel unique fusionné : mesuré instable (confiance de 0,12 à 0,89) ; de plus la « position statistique générale » exige les percentiles calculés par le code, inconnus au moment où le modèle voit l'image. |
| Que reçoit le modèle pour rédiger ? | Des **indicateurs traduits en mots** (qualité du repérage, taille de la carte, inclinaison, marge, symétrie, courbure, position en tiers, cohérence), jamais une mesure en centimètres. | Lui donner les chiffres (ancien prompt) : risque de les voir recopiés ; la règle « aucun chiffre » devient facile à tenir. |
| Où vit la relance unique ? | Dans le flux d'analyse (`withOneRetry`), autour de l'appel complet (`analyse` ou `writeComment`) : testable avec le fournisseur simulé (scénarios `garbage_once`, `comment_invalid_once`). Coût d'une relance du repérage : deux appels de vision (recevabilité comprise), rare. | Relance par appel dans l'adaptateur xAI : moins cher d'un appel, mais invisible aux tests du flux. |
| Commentaire invalide deux fois : rapport sans commentaire, commentaire de repli, ou refus ? | **Refus** avec message neutre, motif `commentaire_invalide`, aucun rapport : le modèle de rapport est fixe. Le commentaire est donc produit **avant** la création du rapport (une étape « Rédaction des observations » de plus, réellement exécutée). | Repli déterministe : contredit « un modèle fixe, identique pour chaque analyse » et la consigne de message neutre. Commentaire après l'aperçu (ancien flux) : un rapport sans commentaire aurait existé. |
| Phrase d'avis médical à 30° | Affichée par le **code** (déjà le cas dans le tableau de bord du rapport) ; le commentaire du modèle ne contient jamais de conseil ni de vocabulaire médical (terme interdit). | Laisser le modèle l'écrire : incompatible avec la liste interdite. |
| Liste de termes interdits | Dans le code (`FORBIDDEN_TERMS`) : vulgarité et anatomie, dénigrement ou éloge, médical, unités. Le prompt évite ces mots dans ses propres qualificatifs (« faible » a été remplacé par « réduit » / « légère » après un essai réel où le modèle l'avait recopié). | Liste dans les tests seulement (comme pour les profils) : la validation à l'exécution en a besoin. |
| Schéma JSON envoyé à l'API | Sans `minItems`/`maxItems`/`maxLength` (prise en charge incertaine en mode strict) ; le nombre et les longueurs sont imposés par le prompt et **vérifiés par zod**. Vérifié avec la vraie API : le format strict avec l'énumération de version est accepté sans repli (voir dépense). | Contraintes dans le schéma : un rejet silencieux aurait provoqué un repli `json_object` à chaque appel. |
| Fichier de prompts | `photo-report-v1.ts` + `index.ts` à ré-exports **nommés** (tsx ne voit pas les ré-exports en étoile depuis un script ESM) ; nom sans point (`.v1` cassait la résolution sous tsx). | `photo-report.v1.ts` + `export *` : échec constaté du script de vérification. |
| PHOTO_BETA hors bêta gratuite | Sans effet (la version payante a ses formules photo, payantes). | Activer B gratuite en version payante : incohérent avec les CGV. |
| Garde-fou de production : conditions | Prestataire d'âge réel + variables (**ageverif**, **yoti** : noms de variables réservés `YOTI_CLIENT_SDK_ID`, `YOTI_KEY_PEM`, adaptateur au bloc 8 ; `getAgeProvider` refuse « yoti » avec une erreur explicite, jamais une simulation), **plus** vision `xai` avec clé, captcha `altcha` avec clé, filtrage ni `simulation` ni `off`. | Le seul critère d'âge : un site en production aurait pu activer la bêta avec une vision simulée qui plante à l'analyse après une vérification d'âge réelle (peut-être payante). |
| Filtrage absent | `SCREENING_PROVIDER` vide → fournisseur « none », accepté en production, avertissement au démarrage (seulement si un flux photo existe) et à chaque analyse (`screening_absent`). `simulation`/`off` restent interdits en production. | Traiter « vide » comme « simulation » (ancien défaut) : rendait la production impossible sans adaptateur PhotoDNA. |
| Plafond : règle exacte | Réservation acceptée si dépensé + réservé + 0,03 $ ≤ plafond (donc jamais de dépassement tant que le coût réel ≤ 0,03 $) ; refusée aussi dès que dépensé ≥ plafond. Une seule instruction SQL (`INSERT … ON CONFLICT DO UPDATE … WHERE … RETURNING`) : verrou de ligne, concurrence testée (20 réservations simultanées, 3 passent). | Vérifier « dépensé < plafond » seulement : dépassement d'une analyse complète possible (environ 0,02 $ par analyse simultanée). |
| Plafond : où dans l'ordre des contrôles | Après captcha et limite par adresse, **avant** `startAttempt` : un refus pour plafond n'est ni une tentative ni compté dans la limite de 5 par adresse ; la réservation est rendue même si l'image est invalide ou bloquée (règlement avec 0 appel). | Avant le captcha : un robot pourrait sonder le plafond sans résoudre le défi. |
| Coût enregistré | Jetons réels × `XAI_PRICE_*` au moment de l'appel, en micro-dollars entiers ; `calls` compte les appels réellement envoyés (repli compris). | Un prix fixe par analyse : faux dès qu'une relance ou un repli survient. |
| Libellés de la bêta photo | `/analyse` : « Gratuit », modèle d'analyse (xAI, États-Unis), marge ≥ ± 10 %, vérification d'âge, « jamais enregistrée par Bitomètre » mais conservée 30 jours par le prestataire ; politique de confidentialité et conditions de la bêta étendues ; méthode : sections photo visibles ; accueil : « déclarées ou estimées ». | Laisser les textes de la bêta A (« aucune photo ») : faux dès que PHOTO_BETA est active. |
| Appels réels de cette session | Deux exécutions de `npm run xai:schema-check` avec une image de formes géométriques : 0,0150 $ (analyse, « non recevable » attendu) + 0,0042 $ (rédaction, rejetée pour « faible ») + 0,0043 $ (rédaction après correction, conforme) = **0,0235 $**. | — |

## Nuit 4, bloc 7 : kit de test photo (décisions prises seul, option la plus prudente)

| Question | Décision | Alternative écartée |
|---|---|---|
| Écrire en base ou non ? | **Jamais** (« sans base » est la seule option, par défaut) : le test n'a pas besoin de rapport ni de tentative enregistrée ; aucune connexion à la base. Réalisé en injectant un `FlowStore` dans `runAnalysis` (défaut : la base, comportement du site inchangé), plutôt qu'en dupliquant la chaîne. | Option `--avec-base` : plus de surface (base de développement à lancer, rapport inutile) pour aucun bénéfice demain. Dupliquer la chaîne : divergence possible avec le site. |
| Où tenir le cumul de dépense du jour sans base ? | Fichier local texte `.photo-test-depenses.json` à la racine (ignoré par git, que des dollars par jour Paris), hors de `photos-test/` pour que « dossier vide » reste vrai. | Le placer dans `photos-test/` (brouille la vérification « il ne reste rien »). |
| Règle du garde-fou de plafond | Refus avant toute lecture de la photo si cumul du jour + 0,03 $ (`ESTIMATED_ANALYSIS_USD`) > `XAI_DAILY_CAP_USD` ; même règle d'arrondi que la porte du site. | Estimer d'après le coût réel moyen (0,022 $) : moins prudent. |
| `--supprimer` quand l'analyse est refusée | La photo est **supprimée quand même** (l'envoi à xAI a eu lieu ; la garder prolonge un risque). Le document dit comment relancer sur la même photo (ne pas mettre l'option). Photo non supprimée si le script a refusé de démarrer ou a eu une erreur inattendue (le message l'indique). | Garder la photo après un refus : plus pratique, mais une photo intime restant sur le disque par défaut. |
| Suppression « propre » | Écrasement (aléatoire puis zéros, `fsync`) puis suppression ; le document dit honnêtement que cela ne garantit pas l'effacement physique sur SSD et cite les copies hors de portée (iCloud Drive, Time Machine, original, Corbeille, xAI 30 jours). | Promettre un effacement sûr. |
| Lien symbolique, dossier voisin, chemin extérieur | Tous refusés (aussi pour la suppression) ; `photos-test/` lui-même ne doit pas être un lien. | Suivre les liens : permettrait de lire ou d'écraser un fichier extérieur. |
| Définition de la mesure à la règle | Reprend le questionnaire (« sur le dessus, de la base à l'extrémité » ; circonférence « au milieu, tour complet ») en précisant **sans appuyer** (la photo ne voit que la partie visible) ; deux mesures et moyenne ; noter la méthode. **Question ouverte consignée** : le site ne dit pas si ses percentiles supposent une mesure « peau-extrémité » ou « os-extrémité » (la page de guide du site précise que les méthodes diffèrent) ; la circonférence photo est π × largeur **maximale**, pas « au milieu ». À trancher avec le propriétaire. | Imposer une méthode « os-extrémité » : contredit ce que voit la photo. |
| Seuil d'écart « normal » | **Aucun seuil inventé** : la marge affichée (± 10 % minimum), les chiffres de simulation de `docs/CALIBRATION.md` et l'essai du 30/09 ; « l'écart de référence reste à établir avec plusieurs essais ». Le script dit « dans la marge affichée : oui/NON », jamais « bon/mauvais ». | Proposer ± 5 % : sans donnée. |
| Mode simulation | Moteur simulé (objet de 13 cm) : ses valeurs sont fixes et le document dit qu'elles ne veulent rien dire ; sans fichier, image neutre fabriquée en mémoire. | Utiliser la photo du propriétaire pour la simulation : inutile. |
| Alerte iCloud Drive | Écrite en tête du document (QCM) : le projet est dans `Documents`, que macOS peut synchroniser dans le nuage. | Passer sous silence. |

## Nuit 4, bloc 8 : vérification d'âge et activation (décisions prises seul, option la plus prudente)

| Question | Décision | Alternative écartée |
|---|---|---|
| Corriger l'adaptateur AgeVerif ? | **Non** : la documentation publique lue (OAuth2) correspond au code point par point ; rien de certain à corriger. Les silences de la documentation (mode test, erreur au retour, adresse de retour) sont listés, pas comblés. | Ajouter des paramètres ou une gestion d'erreur « probable » : inventé. |
| Écrire l'adaptateur Yoti ? | **Non.** Documenté : création de session, page hébergée, lecture du résultat, notifications. Non documenté dans ce que j'ai pu lire : paramètres du retour, structure détaillée du résultat et représentation du succès `OVER`, exemples de réponse, sandbox ; et aucun compte pour valider. Une hypothèse fausse = un mineur accepté (échec ouvert). Liste de ce qu'il faut obtenir de Yoti dans `docs/ACTIVATION-PHOTO.md`. | Écrire sur la base de `status === COMPLETE` : plausible, non confirmé. |
| `yoti` compte-t-il comme prestataire prêt ? | **Non** (`NOT_READY_AGE_PROVIDERS`) : refusé en production même avec toutes les variables ; retrait de la liste seulement après adaptateur écrit **et** validé sur le mode test. Remplace la décision du bloc 6. | Le laisser reconnu : permettrait d'activer la photo avec une configuration qui échoue à l'exécution. |
| Variables réservées de Yoti | `YOTI_CLIENT_SDK_ID`, `YOTI_API_KEY` (d'après la page « Onboarding » : « Client SDK ID » et « API Key » ; en-têtes `Yoti-SDK-Id` et `Bearer`) ; `YOTI_KEY_PEM` abandonné (aucune clé PEM pour ce produit). Non lues par le code. | Garder `YOTI_KEY_PEM` : nom non fondé. |
| Texte de `/verification-age` | Corrigé : plus de « double anonymat » ni de « le prestataire ne sait pas quel site vous consultez » (AgeVerif connaît le site par `client_id`, `docs/PRESTATAIRES.md` ; exigence n° 10 du référentiel de l'Arcom : informer si un tiers peut connaître le service). À faire relire par le juriste. | Laisser : libellé faux. |
| `Object.hasOwn` dans le garde-fou | Les tables sont interrogées par nom propre seulement : `AGE_PROVIDER=constructor` ne lève plus d'erreur. | Laisser (cas limite, mais un plantage au démarrage). |
| Procédure d'activation | `PHOTO_BETA` posée en dernier, redéploiement complet (`railway up -s web --ci`) plutôt qu'un redémarrage (pages construites à la construction) ; test de fumée distant **sans** le test qui exige les chemins photo introuvables ; essai de la chaîne avec une image **neutre** (refus neutre attendu, environ 0,015 $) ; retour arrière à quatre niveaux dont `XAI_DAILY_CAP_USD=0` (arrêt immédiat des appels). Option de fermer le site par mot de passe pendant les essais proposée (le site public est ouvert). | Écrire un test distant non exécutable aujourd'hui. |

## Bandeau scanner : dérogation « représentation anatomique » du 03/10/2026 (décision du propriétaire, mise en œuvre prise seul)

**Décision du propriétaire (03/10/2026), formulation :** la règle « aucune représentation anatomique » est LEVÉE POUR CE SEUL BANDEAU « scanner » de l'accueil. Elle reste en vigueur partout ailleurs : rapport, cartes de partage, images Open Graph, pages de contenu, repli statique, e-mails, etc.

**Portée exacte.** La dérogation couvre uniquement le **moteur animé (canvas)** du bandeau de l'accueil (`src/components/scanner/scannerEngine.ts` et la géométrie pure `src/lib/scannerSilhouette.ts`). Elle ne couvre PAS : l'image de repli statique (SVG calculé sur le serveur, affiché sans JavaScript, sans canvas, avant le chargement du moteur et si le moteur échoue), ni aucune image de partage ou Open Graph (`/c/[id]/og`, `/c/[id]/story`, `/og/neutre`), ni le rapport, ni les pages de contenu. Tout cela garde le cylindre géométrique abstrait de `src/lib/scanner3d.ts`, conservé tel quel. Elle ne lève pas non plus les autres règles : pas d'image explicite, pas de photo réelle, pas de réalisme. La dérogation de charte précédente (3D et fond sombre pour ce bandeau) est inchangée.

| Question | Décision | Alternative écartée |
|---|---|---|
| Que montre le moteur animé ? | Une **silhouette stylisée**, la verge seule : surface de révolution lisse, axe légèrement courbe, rayon variable (fût, léger rétrécissement de jonction, renflement arrondi en bout). Rendue **uniquement en nuage de points, en fil de fer (8 méridiens fins) et en anneaux de mesure**, avec le plan de balayage. Aucune texture, aucun détail (ni veines, ni pilosité, ni ombrage, ni orifice), aucun réalisme. | Une forme modelée avec plus de détails ou un rendu plein : exclu par le propriétaire. |
| Proportions | Rapport longueur / diamètre **calculé** à partir de `referenceFor("erect", ...)` (`src/lib/stats.ts` → `REFERENCES` de `src/config/site.ts`) : longueur 13,12 cm, circonférence 11,66 cm, diamètre = circonférence / π = 3,71 cm, rapport = **3,535**. Aucun de ces nombres n'est écrit dans la géométrie (un test le vérifie). **Écart avec les chiffres du propriétaire (13,1 et 11,7) : aucun au-delà de l'arrondi** : les constantes du code sont 13,12 et 11,66 ; ce sont elles qui servent (rapport 3,535 au lieu de 3,52). | Reprendre 13,1 et 11,7 en dur : divergerait des constantes du site. |
| Courbure | Angle et direction lus dans le rapport d'exemple (`exampleReport().curvature` : 15°, vers la gauche), transmis par le serveur à la coque puis au moteur. Courbure constante (la tangente tourne régulièrement de la base à l'extrémité). **Borne de rendu : 20°** (`MAX_RENDER_BEND_DEG`), plafond de dessin pour garder un rendu « légèrement incurvé » ; l'exemple (15°) passe tel quel. Directions haut / bas : plan de courbure vers / à l'opposé de la caméra (convention de dessin). | Un angle écrit en dur, ou une courbure non bornée (la courbure « marquée » de 35° ne serait plus légère). |
| Constantes de dessin | Position de la jonction (0,78 de la longueur), profondeur du rétrécissement (9 %), renflement terminal (+16 % de rayon), longueur dans la scène (3,0) : choix de dessin, pas des données affichées ; regroupées dans `PROFILE` et `SILHOUETTE_LENGTH`. | — |
| Repli statique et images de partage | **Cylindre abstrait, inchangé.** Test `tests/scanner-separation.test.ts` : analyse des imports (fermeture statique et dynamique) du repli et des quatre entrées d'image ; seul `scannerEngine.ts` importe la silhouette ; le SVG du repli est comparé octet pour octet à une référence (`tests/fixtures/scanner-fallback.svg`, produite avant la modification) et ne change pas avec la courbure ; un test e2e compare le HTML réellement servi à la même référence. Test de sensibilité fait à la main : un import de la silhouette dans `cardImage.tsx` fait échouer 6 tests. | Un simple commentaire d'intention : insuffisant contre une régression. |
| Texte alternatif | « Visualisation schématique de mesure : nuage de points, anneaux de mesure et plan de balayage. » Sobre, factuel, sans description de forme ; le test interdit un lot de termes anatomiques et de forme dans ce texte. Identique pour le repli et le moteur. | Décrire la forme : inutile et contraire à la sobriété demandée. |
| Vue de départ | Presque de profil, légèrement de dessus (`SILHOUETTE_VIEW`) pour que le profil et la courbure se lisent ; l'image fixe du mouvement réduit l'utilise aussi. Le cylindre du repli garde sa vue d'avant (`STATIC_VIEW`). | Même vue que le cylindre : la courbure se voyait mal. |
| Abstraction conservée | Aucun mot anatomique dans le code, les noms d'export ou les commentaires de la géométrie (« fût », « renflement », « collerette » de dessin) ; la documentation du propriétaire (ce document) dit « silhouette stylisée ». | — |


## Retouches du bandeau scanner (03/10/2026, d'après les captures du propriétaire ; mise en œuvre prise seul)

Portée inchangée : moteur canvas seulement ; repli SVG et images de partage restent le cylindre abstrait (tests de séparation et référence inchangés). Rendu toujours en nuage de points, fil de fer et anneaux, sans détail ajouté.

| Question | Décision | Alternative écartée |
|---|---|---|
| Garder le plan dans le cadre | Unité d'échelle **constante**, calculée une fois comme le plus grand dessin dont le tube balayé par le disque (t de 0 à 1) tient dans le cadre pour toutes les rotations et inclinaisons permises (marge de 6 px, sécurité 4 %). Garantie par test unitaire (grille d'azimuts, d'inclinaisons, de tailles) et e2e (boîte du plan à chaque image, pixels du bord). | Recalculer l'échelle à chaque image selon la vue : la forme « respirerait » pendant la rotation. Réduire seulement le rayon du plan : ne garantit rien aux inclinaisons extrêmes. |
| Plan de balayage | Rayon 1,4 fois le rayon maximal (juste plus large que les anneaux, au lieu de 1,6), trait de 1 px, voile 0,07 ; mêmes extrémités t = 0 à 1, aller-retour adouci (période 6,4 s) ; orienté selon la tangente de l'axe à sa position (testé). | Balayage sans retour (recommencement brusque) : saut visuel. |
| Anneaux | Un seul style (`RING_STYLE` : 1,25 de rayon relatif, opacité 0,3, 1 px), sans mise en valeur à l'approche du plan ; la géométrie perpendiculaire à la tangente existait déjà, désormais prouvée sur les polylignes dessinées. | Garder deux styles (extrémités plus marquées) : c'est ce qui ressemblait à un bug en bas. |
| « Anneau blanc épais » sur mobile | Cause identifiée : plan de balayage au bas + points éclairés blancs de 2,8 px + anneaux d'extrémité plus larges et opaques. Points éclairés = taille de leur profondeur, bleu éclairci ; anneaux uniformes. | Retirer l'éclairage des points : on garde un léger indice de la position du plan. |
| Mobile plus grand | Unité +29,5 % (52,6 → 68,1) ; bandeau mobile 184 → 276 px ; marges du hero mobile réduites (24 → 16 px en haut, espacement 20 → 16 px) pour garder le bouton dans le premier écran à 375 × 700 (693 px) ; ordinateur inchangé. | Renoncer à l'agrandissement (exclu par la consigne) ; réduire le bandeau et la forme avec lui. |
| Vue de départ | `SILHOUETTE_VIEW` = azimut 0,6, inclinaison 0,34 (trois quarts, légèrement de dessus), **la même sur toutes les tailles** (testé en e2e). | Une vue propre au mobile : écartée par la consigne. |
| Points | Disques par lots (6 classes de profondeur × normal / éclairé), rayon 0,85 × (distance caméra / profondeur)^1,2 (≈ 1,36 à 0,6 px), opacité décroissante avec la profondeur ; 560 points sur bandeau étroit. | Un remplissage par point (trop coûteux, voir le bloc 1) ; sprites pré-dessinés (inutile à cette échelle). |
| État de test | `canvas.__scannerState()` (lecture seule : vue, position du plan, boîte du plan) pour que l'e2e mesure sans deviner ; aucune donnée personnelle. | Seulement l'échantillonnage de pixels : ne donne pas la position du plan. |


## Bout de la silhouette plus réaliste (03/10/2026, demande du propriétaire)

Portée inchangée : moteur canvas seulement ; repli SVG et images de partage restent le cylindre abstrait (tests de séparation verts, référence non modifiée). Même style : nuage de points, méridiens, anneaux ; aucune texture, aucun détail de surface. Vocabulaire du code toujours neutre (« bout », « rebord », « rainure », constantes `TIP_SHAPE`), conformément à la décision « Abstraction conservée ».

| Question | Décision | Alternative écartée |
|---|---|---|
| Rebord à la base du bout | Rayon moyen +12,5 % par rapport au fût (dans la fourchette 10–15 % demandée) ; dissymétrie ×(1 ± 0,3) : +16,25 % dessus, +8,75 % dessous ; face amont très courte (1,2 % de la longueur) pour une arête nette. « Dessus » = +z de la scène, même convention que la courbure « vers le haut ». | Rebord symétrique : ne répondait pas à la consigne. |
| Rainure | Rétrécissement de 5 % (fenêtre en cos²) centré 2,5 % de la longueur sous le rebord. | Plus profond : se serait lu comme une encoche. |
| Forme du bout | Longueur 20 % ; rayon ∝ √(1 − u)·(1 + 0,15 u) : s'affine progressivement vers une pointe arrondie (testé : plus fin qu'un dôme à mi-bout, sans pointe vive) ; aplati de 12 % de haut en bas ; centre des coupes incliné de 9° vers le bas. | Calotte elliptique (l'ancien dôme symétrique). |
| Anneaux | Toujours des cercles centrés sur l'axe et de style unique ; positions 0,04 / 0,29 / 0,545 / rebord (l'anneau sur le bout, qui masquait la forme, est retiré). Un test vérifie que chaque anneau entoure la surface, dessus du rebord compris. | Anneaux épousant la coupe dissymétrique : ce ne seraient plus des anneaux de mesure. |
| Densité sur le rebord | 2 rangées de points en plus sur le rebord, prises sur le même budget (total inchangé à ±3 %) : densité surfacique ≈ 2 à 4 fois celle du fût dans une bande étroite, ordinaire ailleurs. | Augmenter la densité de tout le bout : n'aurait pas souligné le contour. |
| Méridiens | 160 échantillons (au lieu de 48) pour que l'arête et la rainure se voient ; dessus et dessous font partie des 8 méridiens. | — |
| Vue de départ | Azimut 65° (au lieu de 34°) depuis la vue de face, inclinaison 0,34 inchangée, la même sur mobile et ordinateur (tests unitaire et e2e : entre 60 et 70°). | — |
