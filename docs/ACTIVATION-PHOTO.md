# Activer la formule photo en bêta (PHOTO_BETA) : ce qu'il faut, dans l'ordre

**État au 03/10/2026 : rien n'est activé.** `PHOTO_BETA` n'est posée nulle part, aucune variable Railway n'a été touchée, rien n'a été déployé pour la formule photo. Ce document dit **exactement** ce qu'il faut récupérer, poser et vérifier, et ce qui manque encore. Toute question qui vous est posée ici l'est sous forme de QCM, avec la recommandation indiquée.

Rappel de ce que fait `PHOTO_BETA=on` (avec `FREE_BETA=on`) : la formule B (photo) s'ouvre sur bitometre.com, **gratuite** ; la formule C, le paiement et les CGV restent introuvables. En production, un garde-fou (`src/lib/photoBeta.ts`) **ignore** `PHOTO_BETA` tant que les prérequis du chapitre 2 ne sont pas tous réunis, et le dit dans les journaux au démarrage.

## Aperçu administrateur (PHOTO_BETA=admin), avant l'ouverture

But : voir le parcours photo **en ligne** avant de l'ouvrir au public. Avec `PHOTO_BETA=admin` (et `FREE_BETA=on`), la formule photo n'existe que pour une **session d'administration** valide : connectez-vous sur `/admin`, puis suivez le lien « Aperçu de la formule photo » du tableau de bord. Le public ne voit rien (404 sur tous les chemins photo, questionnaire seul). Sans prestataire d'âge réel prêt, l'écran de vérification d'âge le dit et votre session d'administration en tient lieu ; si AgeVerif est configuré (variables 8 et 9 ci-dessous), c'est **AgeVerif** qui est utilisé, même en aperçu : c'est ainsi qu'on le teste en ligne avant l'ouverture.

Variables Railway pour l'aperçu : 1 à 7 et 10 du chapitre 2 (captcha, xAI, plafond), puis **`PHOTO_BETA=admin`** ; `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` et `AGE_TOKEN_SECRET` sont déjà en place. Note : le cookie de session d'administration a changé de nom (`nmb_admin_session`, valable sur tout le site) : il faut se reconnecter une fois après le déploiement. Les analyses faites en aperçu sont de vraies analyses (appels xAI payants, comptés dans le plafond du jour, rapports de la bêta conservés 90 jours au plus).

## 0. Ce qui est prêt et ce qui ne l'est pas

| Brique | État | Remarque |
|---|---|---|
| Chaîne d'analyse photo (recevabilité, repérage, calculs, rédaction standardisée, profil, plafond de dépense) | Prête, testée avec l'API simulée ; **testée avec la vraie API xAI sur images neutres seulement** | Jamais essayée avec une vraie photo de bout en bout : c'est l'objet de `docs/TEST-PHOTO.md`. |
| Vérification d'âge **AgeVerif** | Adaptateur écrit d'après la documentation publique, testé avec des réponses simulées. **Jamais essayé avec le vrai prestataire** (pas de compte, mode test non décrit) | Comparaison avec la documentation : chapitre 1.1. |
| Vérification d'âge **Yoti** | **Adaptateur NON écrit** | Documentation insuffisante pour l'écrire sans deviner : chapitre 1.2. **`yoti` ne compte pas comme prestataire prêt** : avec `AGE_PROVIDER=yoti` en production, la bêta photo reste fermée. |
| Captcha ALTCHA | Prêt (auto-hébergé) | Il faut seulement une clé secrète que vous fabriquez. |
| Filtrage d'empreintes | **Aucun prestataire** | Variable laissée vide : aucun filtrage, avertissement journalisé (décision de conformité à confirmer : chapitre 4). |
| Test de fumée distant | **Ne couvre pas la formule photo** | Voir le chapitre 3, étape 6. |

## 1. Les informations à récupérer, prestataire par prestataire

**Règle du projet : ne créez aucun compte avant d'avoir les réponses écrites des prestataires** (`docs/DEMANDES/ageverif.md`, `yoti.md`). Ce chapitre vaut pour **après** l'ouverture d'un compte.

### 1.1 AgeVerif (le seul prestataire d'âge prêt)

Plateforme : <https://webmasters.ageverif.com> (inscription : <https://webmasters.ageverif.com/sign-up>). Documentation : <https://docs.ageverif.com/oauth2.html>.

| À récupérer | Variable Railway | Où le trouver | Remarque |
|---|---|---|---|
| Identifiant « client » OAuth2, version **Live** | `AGEVERIF_CLIENT_ID` | Tableau de bord de la plateforme webmasters. **La documentation ne dit pas à quelle page** : relevez-la et notez-la ici. | Obligatoire. |
| Secret OAuth2 | `AGEVERIF_CLIENT_SECRET` | Même endroit. | Obligatoire, secret. |
| Méthodes à proposer | `AGEVERIF_CHALLENGES` (facultatif) | À choisir parmi les valeurs documentées : `selfie`, `email_age`, `credit_card`, `ticket`, `anonymage`, `pleenk`, `paypal`, `agego`, `agekey`. Vide = toutes. | **À décider avec la réponse écrite d'AgeVerif** (le projet n'a pas retenu AgeGO, `docs/PRESTATAIRES.md`). |
| **Adresse de retour (redirect_uri)** | rien à poser chez nous | **`https://bitometre.com/api/age/callback`** exactement (le code la construit : `SITE_URL` + `/api/age/callback`, sans `/` final dans `SITE_URL`). | La documentation **ne dit pas** comment une adresse de retour est déclarée ni si elle doit l'être ; elle indique seulement que plusieurs sites peuvent partager les mêmes identifiants avec des adresses différentes. **À demander à AgeVerif** et à déclarer si le tableau de bord le propose. |
| Mode test / production | — | **Non décrit** dans la documentation publique lue. À demander par écrit (question 6 de `docs/DEMANDES/ageverif.md`). | Sans mode test, le premier essai réel est une vraie vérification, avec vos données. |
| Réglages du tableau de bord | — | **Non décrits** (domaines autorisés, seuil d'âge, assurance). | Le code exige `verified = true` **et** `age_threshold` d'au moins 18 dans la réponse. Il **n'utilise pas** `assurance_level` (STANDARD, ENHANCED, STRICT) : la question « quel niveau exiger ? » est à poser au juriste et à AgeVerif. |
| Réponses écrites (gouvernance, ce qu'AgeVerif sait du site, tarif, accord de traitement) | — | `docs/DEMANDES/ageverif.md` | Conditions à lever avant toute activation : chapitre 4. |

**Comparaison de l'adaptateur (`src/lib/providers/ageverif.ts`, callback, jeton) avec la documentation publique** (lue le 03/10/2026) : adresse d'autorisation `GET https://api.ageverif.com/v1/oauth2/checker`, paramètres `client_id`, `redirect_uri`, `response_type=code`, `scope=read`, `state`, `language=fr`, `challenges` ; retour avec `code` (valable 10 minutes) et `state` ; échange `POST https://api.ageverif.com/v1/oauth2/token` en authentification Basic (`client_id:client_secret`), corps `grant_type=authorization_code`, `code`, `redirect_uri` ; réponse `access_token` (jeton d'une heure) ; confirmation `GET https://api.ageverif.com/v1/oauth2/resources` avec `Bearer`, champs `verified` (booléen) et `age_threshold` (entier). **Écart trouvé et corrigé le 03/10/2026 (relecture de la documentation)** : la réponse de `/v1/oauth2/resources` est **imbriquée** (`{"resources": {"verified": true, "age_threshold": 18, …}}`) ; l'adaptateur lisait les champs à la racine et aurait refusé toute vérification réelle. Il lit maintenant `resources` (format documenté seulement), tests mis à jour. Points non couverts par la documentation (donc non vérifiables ici) : paramètre d'erreur au retour (le code traite un retour sans `code` ou avec `error` comme « non majeur »), enregistrement de l'adresse de retour, mode test, signature du `state` (le `state` est signé par **notre** code, pas par AgeVerif). Le jeton « majeur : oui » du site est un jeton propre (`src/lib/age/token.ts`, 30 minutes, signé par `AGE_TOKEN_SECRET`) : il n'est pas un jeton d'AgeVerif. La variante « login » de la documentation (bouton « Login with AgeVerif ») n'est pas utilisée.

### 1.2 Yoti (adaptateur non écrit : ce qui est connu et ce qui manque)

Documentation lue le 03/10/2026 : <https://developers.yoti.com/age-verification> et ses pages (« Onboarding », « Create a session », « Launch the user view », « Results », « Notifications », spécification de l'API).

**Ce qui est documenté précisément**
- Compte : Yoti Hub, <https://hub.yoti.com/get-started> ; vérification de l'organisation en « 2 à 3 heures ouvrées » ; création d'un « service » de type **Age Verification** qui génère deux valeurs : le **Client SDK ID** et la **clé d'API** (jeton « Bearer »).
- Création d'une session : `POST https://age.yoti.com/api/v1/sessions`, en-têtes `Authorization: Bearer <clé d'API>`, `Content-Type: application/json`, `Yoti-SDK-Id: <SDK ID>` ; corps avec `type` (`OVER`, `UNDER` ou `AGE`), `ttl` (60 s à 1 mois), méthodes (`age_estimation`, `digital_id`, `doc_scan`, `credit_card`, `mobile`, … avec `allowed` et `threshold`), `callback` (`url`, `auto`), `notification_url`, `reference_id` ; réponse `id`, `expires_at`, `status: PENDING`.
- Page hébergée : `https://age.yoti.com?sessionId=<id>&sdkId=<SDK ID>&locale=<fr>`.
- Résultat : `GET https://age.yoti.com/api/v1/sessions/<id>/result` (mêmes en-têtes) ; états `PENDING`, `IN_PROGRESS`, `COMPLETE`, `FAIL`, `ERROR`, `CANCELLED`, `EXPIRED`.
- Notifications (webhook) : HTTPS obligatoire, signées en RSA-PSS SHA-256.

**Pourquoi l'adaptateur n'est PAS écrit** (une erreur ici ferait accepter un mineur, donc on ne devine pas)
1. **Ce que contient l'adresse de retour n'est pas documenté** : les pages lues ne disent pas quels paramètres reviennent sur `callback.url` (identifiant de session ?). Contournable en retenant l'identifiant de session de notre côté, mais cela reste une hypothèse non validée.
2. **Comment lire « majeur : oui » n'est pas établi sans ambiguïté** : la page « Results » dit que `COMPLETE` signifie « seuil franchi ou âge renvoyé » et que `FAIL` vaut pour `OVER`/`UNDER`, et cite un booléen `allowed` dans chaque objet de méthode ; mais la spécification de l'API **ne montre pas** la structure détaillée de la réponse ni comment le succès d'un type `OVER` est représenté, et aucun exemple de réponse n'est donné dans les pages lues.
3. **Aucun accès test lu** : des pages « Sandbox » existent (introduction, création de session, réponse simulée) mais n'ont pas été lues, et rien ne permet de valider un adaptateur sans compte.
4. **Le seuil réel à demander est une décision à prendre** (exemple de la documentation : estimation d'âge à 21 pour un seuil de 18, ce qui est une marge de sécurité choisie par le site) et dépend de la réponse écrite de Yoti (question 3 de `docs/DEMANDES/yoti.md`).
5. **Variables** : l'ancien nom réservé pour une clé PEM (bloc 6) n'a pas de raison d'être d'après la documentation (aucune clé PEM pour ce produit) : remplacé par **`YOTI_API_KEY`**. Les noms réservés, non lus par le code, sont `YOTI_CLIENT_SDK_ID` et `YOTI_API_KEY`.

**Pour pouvoir l'écrire (à demander à Yoti en même temps que les réponses de `docs/DEMANDES/yoti.md`)** : un exemple de réponse complète de `GET …/result` pour un type `OVER` réussi, refusé, annulé et expiré ; la liste des paramètres ajoutés à l'adresse de retour ; l'accès sandbox ; le seuil et la marge recommandés pour un 18+.

**Ce que fait le site en attendant** : `getAgeProvider()` refuse « yoti » avec une erreur explicite (jamais une simulation) ; `photoBetaDecision` ne le compte pas comme prestataire prêt, même avec toutes les variables (test dans `tests/photo-beta.test.ts`). Retirer `yoti` de `NOT_READY_AGE_PROVIDERS` n'est permis qu'après écriture de l'adaptateur **et** validation sur le mode test de Yoti.

### 1.3 xAI (moteur d'analyse)

| À récupérer | Variable Railway | Où le trouver |
|---|---|---|
| Clé d'API | `XAI_API_KEY` | <https://console.x.ai> → API Keys → Create API key (elle ne s'affiche qu'une fois). Une clé distincte de celle de votre `.env` local est recommandée. |
| Tarif par million de jetons (entrée et sortie) du modèle utilisé | `XAI_PRICE_IN_PER_M`, `XAI_PRICE_OUT_PER_M` | Page tarifs de la console xAI. **Vérifiez** : les valeurs par défaut du site (2 et 6) servent au calcul du plafond et du coût affiché. |
| Modèle | `XAI_MODEL` | Laissez **vide** : le code utilise `grok-4.7`, le modèle testé. |
| Non-conservation (Zero Data Retention) | — | Console xAI, réglage de l'équipe ; sinon xAI garde les requêtes **30 jours** (`docs/TEST-XAI.md`, section 4). À obtenir par écrit : `docs/DEMANDES/xai.md`. |

### 1.4 Captcha ALTCHA et jeton d'âge (rien à récupérer chez un tiers)

- `ALTCHA_HMAC_KEY` : une longue chaîne aléatoire de 32 caractères ou plus **que vous fabriquez** (par exemple avec la commande `openssl rand -hex 32` dans le Terminal). Obligatoire. `ALTCHA_MAX_NUMBER` : facultatif (difficulté, 100000 par défaut).
- `AGE_TOKEN_SECRET`, `SITE_URL` et `IP_HASH_SECRET` existent déjà sur le service `web` (`docs/RAILWAY.md`). **Contrôlez** que `SITE_URL` vaut bien `https://bitometre.com` (sans `/` final) : l'adresse de retour d'AgeVerif en dépend.

## 2. Les variables Railway à poser, dans l'ordre

Service **web** → **Variables** (ou la ligne de commande Railway). Déjà en place d'après `docs/RAILWAY.md` : `FREE_BETA=on`, `SITE_URL`, `DATABASE_URL`, `IP_HASH_SECRET`, `AGE_TOKEN_SECRET`, etc. Ne posez **`PHOTO_BETA` qu'en dernier**.

| # | Variable | Valeur (forme, jamais une vraie valeur ici) | Prérequis du garde-fou |
|---|---|---|---|
| 1 | `ALTCHA_HMAC_KEY` | chaîne aléatoire d'au moins 32 caractères | captcha |
| 2 | `CAPTCHA_PROVIDER` | `altcha` | captcha |
| 3 | `XAI_API_KEY` | clé de la console xAI | vision |
| 4 | `VISION_PROVIDER` | `xai` | vision |
| 5 | `XAI_EFFORT` | `low` (posez-la explicitement ; **ne la posez jamais vide** : le raisonnement par défaut est environ 10 fois plus lent) | performance |
| 6 | `XAI_PRICE_IN_PER_M`, `XAI_PRICE_OUT_PER_M` | tarifs vérifiés (nombres avec point) | coût affiché et plafond |
| 7 | `XAI_DAILY_CAP_USD` | plafond en dollars par jour civil (Paris), par exemple `1`. **Vide = 5 $ par jour** ; `0` = aucun appel. Repère : la réservation par analyse est de 0,03 $, soit au plus environ 33 analyses pour 1 $ par jour (coût mesuré : environ 0,022 $ par analyse complète) | maîtrise de la dépense (aucun prérequis du garde-fou, mais **à fixer avant d'ouvrir**) |
| 8 | `AGEVERIF_CLIENT_ID`, `AGEVERIF_CLIENT_SECRET` (+ `AGEVERIF_CHALLENGES` facultatif) | identifiants d'AgeVerif | âge |
| 9 | `AGE_PROVIDER` | `ageverif` (jamais `simulation`, jamais `yoti`) | âge |
| 10 | `SCREENING_PROVIDER` | **laisser vide ou absente** (jamais `simulation` ni `off`) | filtrage : absent, avec avertissement |
| 11 | **`PHOTO_BETA`** | `on` | (en dernier) |

Rien d'autre à poser : `NODE_ENV` est réglé par Next.js. **Laissez `FREE_BETA=on`** : sans elle, `PHOTO_BETA` n'a aucun effet.

Contrôle du garde-fou avant le déploiement (sans rien changer en ligne) : le code refuse tant qu'une ligne manque, et la raison est écrite dans les journaux de démarrage (`startup_warning`, « PHOTO_BETA=on ignorée … »).

## 3. La procédure d'activation, par étapes

**Avant toute chose, deux décisions (QCM)**
- **Fermer le site pendant les essais ?** **A.** Oui : poser `SITE_PASSWORD` (et `SITE_USER`) le temps des essais, comme avant l'ouverture, puis les retirer à la fin (recommandé : l'ouverture publique d'une formule photo ne se fait qu'après essais) · **B.** Non, activer directement sur le site public. Avec A, les essais automatiques de l'étape 6 doivent fournir les identifiants.
- **Quel plafond ?** **A.** 1 $ par jour pendant la première semaine (recommandé) · **B.** garder la valeur par défaut de 5 $ · **C.** autre valeur.

**Étapes**
1. **Conditions préalables** (aucune ne se contourne) : `docs/TEST-PHOTO.md` suivi une fois avec **votre** photo, mesures et durée relevées ; réponses écrites d'AgeVerif (chapitre 4) ; relecture du juriste de la bêta photo (chapitre 4) ; Zero Data Retention de xAI obtenue **ou** formulation acceptée par le juriste ; `npm run verify` vert sur le commit à déployer.
2. **Compte AgeVerif** ouvert (par vous), chapitre 1.1 : relevez `AGEVERIF_CLIENT_ID`, `AGEVERIF_CLIENT_SECRET`, la page du tableau de bord où ils se trouvent, l'adresse de retour déclarée.
3. **Poser les variables 1 à 10** du chapitre 2 (pas `PHOTO_BETA`). Le site fonctionne comme avant : rien n'a changé pour les visiteurs.
4. **Déployer** depuis le dossier du projet : `railway up -s web --ci` (le service n'est relié à aucun dépôt : un `git push` ne déploie rien ; `railway redeploy` ne relance que l'ancien déploiement). Attendre « Active ». Contrôler `https://bitometre.com/api/health` → `{"ok":true}`.
5. **Poser `PHOTO_BETA=on`** puis **redéployer avec `railway up -s web --ci`** (certaines pages sont construites à la construction : un simple redémarrage ne suffit pas à coup sûr). Dans les journaux du service au démarrage : **aucun** avertissement « PHOTO_BETA=on ignorée » ; l'avertissement de **filtrage absent** (`SCREENING_PROVIDER` vide) est **attendu**.
6. **Test de fumée.** Le test de fumée habituel contient un test qui exige que les chemins photo soient introuvables : il échouera forcément une fois la bêta photo active. Lancez-le **sans ce test** :
   ```bash
   RAILWAY_TEST_URL=https://bitometre.com npx playwright test -c playwright.remote.config.ts --grep-invert "protection par mot de passe|administration : connexion|formules photo, paiement, CGV introuvables"
   ```
   Puis la vérification **à la main** (aucun test automatique distant n'existe pour la formule photo, voir chapitre 5) : `/analyse` propose A et B, B « Gratuit » sans prix ni formule C ; `/analyse/photo?f=B` mène à la vérification d'âge ; `/analyse/photo?f=C`, `/cgv`, `/paiement/x` → page introuvable ; `/confidentialite` et `/conditions` décrivent la photo et le prestataire ; l'accueil dit « déclarées ou estimées ».
7. **Essai avec un compte de test du prestataire.** AgeVerif : **aucun mode test n'est décrit** (chapitre 1.1) ; demandez-le par écrit ; sans lui, c'est vous qui passez une vraie vérification (vos données vont à AgeVerif). Parcours complet : vérification d'âge → retour sur le site → cases de consentement → envoi d'**une image neutre fabriquée** (une photo d'objet quelconque, jamais une photo personnelle) : le résultat attendu est un **refus neutre** (« Cette image n'a pas pu être analysée… »), ce qui prouve la chaîne entière (jeton d'âge, captcha, plafond, appel xAI, validation) pour environ 0,015 $. Vérifiez dans `/admin`, carte « Plafond de dépense xAI », que l'appel est compté. Un rapport complet exige votre vraie photo : à faire par vous seul, selon `docs/TEST-PHOTO.md`, ou sur le site.
8. **Retirer `SITE_PASSWORD`** seulement si vous l'aviez posé pour les essais (option A) ET que tout est vert.
9. **Surveillance de la première semaine** : `/admin` (dépense du jour, appels, analyses, plafond), journaux (`analysis_cap_reached`, `analysis_refused`, `analysis_error`, `screening_absent`), facture Railway.

**Plan de retour arrière** (chacun efface l'effet du précédent plus vite)
1. **Arrêt immédiat des appels xAI** : poser `XAI_DAILY_CAP_USD=0` (aucun appel, les visiteurs lisent « Capacité du jour atteinte, revenez demain »). Redéploiement automatique en 1 à 2 minutes.
2. **Fermeture de la formule photo** : **retirer la variable `PHOTO_BETA`** (ou la poser à toute valeur autre que `on`), puis `railway up -s web --ci`. Les chemins photo redeviennent introuvables ; le site revient à la bêta gratuite de la formule A. Vérifier `/analyse/photo` → introuvable.
3. **Fermeture du site entier** : poser `SITE_PASSWORD`.
4. **Version précédente** : tableau de bord Railway → service `web` → Deployments → redéployer la version d'avant.
- Les rapports de la bêta photo déjà créés se suppriment seuls au plus tard après 90 jours ; aucune photo n'est jamais enregistrée par le site ; xAI conserve les requêtes 30 jours (sauf ZDR).

## 4. Risques connus et décisions de conformité à confirmer

Renvois : `docs/JURISTE.md` (sections 1 à 5, 10, et la section « bêta » B1 à B14), `docs/PRESTATAIRES.md` (section 4 « Vérification d'âge », filtrage), `docs/DEMANDES/`. **Ce document ne tranche aucune question juridique.**

1. **Aucun filtrage d'empreintes** : décision prise au bloc 6, acceptée en production avec avertissement ; elle est **à confirmer par le juriste** (`docs/JURISTE.md`, §10 : signalement, conservation). Les textes disent qu'« aucun filtrage n'a lieu » tant qu'aucun prestataire n'est configuré ; le filtrage, quand il existera, ne détecte ni l'âge ni les images nouvelles.
2. **Gouvernance d'AgeVerif** : son dirigeant dirige aussi un exploitant de plateformes pour adultes (reconnu par AgeVerif dans sa réponse à AI Forensics, `docs/PRESTATAIRES.md`) ; critère principal du propriétaire : l'indépendance. **Réponses écrites à obtenir avant d'activer** (`docs/DEMANDES/ageverif.md`, questions 1, 2, 3, 5).
3. **AgeVerif connaît le site** (`client_id`) : le texte de `/verification-age` a été **corrigé le 03/10/2026** (il affirmait « le prestataire ne sait pas quel site vous consultez », ce qui n'est pas établi) : il dit maintenant que le prestataire peut savoir que la demande vient du site et que la procédure n'est pas anonyme au sens du RGPD. À faire relire (exigence n° 10 du référentiel de l'Arcom, `docs/PRESTATAIRES.md`).
4. **Pas de garantie « âge garanti »** ni de « certifié Arcom » nulle part ; l'âge vérifié ne prouve pas que la personne sur la photo est celle qui a passé la vérification (deux contrôles séparés). Le seuil d'âge qu'AgeVerif applique réellement (`age_threshold`, `assurance_level`) est à faire confirmer par écrit.
5. **Transfert vers xAI (États-Unis)** de données sensibles (RGPD art. 9) : consentement explicite, conservation de 30 jours par le prestataire sauf Zero Data Retention (`docs/JURISTE.md`, §4 : fondement, accord de traitement, évaluation d'impact du transfert).
6. **Société britannique, AIPD, représentant dans l'Union, Online Safety Act** : voir `docs/JURISTE.md` §3, §5, §7. La bêta photo ajoute à la bêta un traitement d'images d'une partie intime : à faire valider **avant ouverture au public** (la section « bêta » du dossier du juriste a été écrite pour la formule A seule : **elle ne couvre pas encore la photo**, à compléter).
7. **Précision non validée sur de vraies photos** : marge « ± 10 % au minimum » non établie par calibration (`docs/CALIBRATION.md`) ; la page méthode le dit.
8. **Dépense** : plafond quotidien configurable, marge de dépassement théorique au plus 0,015 $ par analyse simultanée en cas de relance (`docs/DECISIONS.md`) ; pas de plafond mensuel ; pas de limite d'usage définie dans Railway (`docs/RAILWAY.md`).
9. **Contournements** possibles de la vérification d'âge (jeton copié, deepfake) : le jeton du site est à courte durée (30 minutes) et signé, mais il n'est pas à usage unique.

## 5. Ce qui reste NON fait (sans le cacher)

- **Adaptateur Yoti** : non écrit (chapitre 1.2) ; variables `YOTI_*` réservées, non lues.
- **AgeVerif jamais essayé en réel** : mode test inconnu, emplacement des identifiants dans le tableau de bord inconnu, déclaration de l'adresse de retour inconnue, comportement d'erreur au retour inconnu.
- **Aucun compte ouvert** chez AgeVerif, Yoti, xAI (compte existant pour les essais), ni ailleurs ; aucune variable posée sur Railway ; rien déployé ; Cloudflare non touché.
- **Test distant de la formule photo** : n'existe pas (le test de fumée existant exige l'inverse) ; seul le test local `e2e/formule-photo.spec.ts` (API simulée) existe. À écrire une fois l'activation décidée.
- **Filtrage d'empreintes** : aucun prestataire (PhotoDNA : éligibilité à demander, `docs/DEMANDES/microsoft-photodna.md`).
- **Zero Data Retention xAI** : non obtenue.
- **Durée de bout en bout avec le vrai moteur et fréquence des relances** : non mesurées sur de vraies photos (à relever avec `npm run photo:test`).
- **Calibration** de la marge sur de vraies photos : non faite.
- **Relecture juridique** de la bêta photo : non faite ; section dédiée du dossier du juriste à compléter.
- **Texte de `/verification-age`** : corrigé (chapitre 4, point 3) mais non relu par le juriste.
- Aucun essai sur un vrai téléphone ni avec un lecteur d'écran des pages photo.
