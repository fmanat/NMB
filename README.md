# Bitomètre

Site francophone (pensé pour le téléphone) qui vend une analyse chiffrée de mesures corporelles saisies par l'utilisateur : score sur 100, percentiles, courbure, symétrie. Ton pince-sans-rire de faux laboratoire. Aucune image explicite.

- Formule A : questionnaire, 2,99 €. Formule B : photo, 4,99 €. Formule C : photo et mesures déclarées, 6,99 €.
- Le cahier des charges complet est dans [docs/SPEC.md](docs/SPEC.md). Les choix pris en autonomie sont dans [docs/DECISIONS.md](docs/DECISIONS.md).
- La photo n'est jamais enregistrée par le site : elle est analysée en mémoire puis abandonnée.

> **État actuel : un site de TEST tourne sur Railway (région UE), en mode bêta gratuite, protégé par mot de passe et relié à aucun nom de domaine** (voir [docs/RAILWAY.md](docs/RAILWAY.md) ; ouverture : [docs/OUVERTURE.md](docs/OUVERTURE.md) ; passage au payant : [docs/PASSAGE-PAYANT.md](docs/PASSAGE-PAYANT.md)). Hébergeur : **Railway** ; DNS de bitometre.com : **Cloudflare**. En local, tout fonctionne avec des prestataires **simulés** (paiement, vérification d'âge, filtrage d'images, captcha). Ils sont interdits en production : le site refuse de les utiliser en production (la fonction concernée échoue). Il faut de vrais prestataires avant la mise en ligne (voir la partie 5).

---

## 1. Faire tourner le site sur votre ordinateur

Il faut : Node.js (version 22 ou plus récente) et PostgreSQL 17.

1. Ouvrez un terminal dans le dossier du projet et installez les outils :
   ```bash
   npm install
   ```
2. Copiez le fichier d'exemple de réglages : `.env.example` → `.env` (le fichier `.env` n'est jamais envoyé sur GitHub). Remplissez les secrets (partie 2).
3. Créez les tables de la base de données :
   ```bash
   npm run db:migrate
   ```
4. Lancez le site :
   ```bash
   npm run dev
   ```
   Il s'ouvre sur http://localhost:3000.

Pour vérifier que tout va bien (contrôle du code, tests, construction du site) :

```bash
npm run verify
```

Si cette commande se termine sans erreur, le site est dans un état sain.

## 2. Les réglages du fichier `.env`

Un secret = une longue chaîne de caractères aléatoires (au moins 32), différente pour chaque ligne. Ne jamais les publier, ne jamais les mettre dans le code.

| Réglage | À quoi il sert | Obligatoire |
|---|---|---|
| `DATABASE_URL` | Adresse de la base PostgreSQL. | Oui |
| `SITE_URL` | Adresse publique du site (ex. `https://bitometre.com`). Sert aux liens, aux images de partage et à la sécurité (https forcé si l'adresse est en https). | Oui |
| `IP_HASH_SECRET` | Secret pour brouiller les adresses IP (limite de 5 essais par 24 h). Les IP ne sont jamais gardées en clair. | Oui |
| `AGE_TOKEN_SECRET` | Secret qui signe le jeton « majeur : oui » (valable 30 minutes). | Oui |
| `FREE_BETA` | `on` = **bêta gratuite** : formule A seule, rapport débloqué sans paiement, formules B et C / paiement / CGV introuvables (404). Vide = version payante. À changer, puis redéployer. | Non |
| `SITE_PASSWORD`, `SITE_USER` | Protège **tout** le site par mot de passe (fenêtre d'identifiants du navigateur). Vide = site public. **Sans mot de passe, le site est public** (plus de blocage automatique). | Non |
| `DB_POOL_MAX` | Nombre maximal de connexions simultanées à la base (défaut 10 ; 5 sur Railway). | Non |
| `PAYMENT_PROVIDER` | `simulation` en local. En production payante : `verotel` (adaptateur prévu, bloc 4 de la nuit 3). `stripe` est **exclu définitivement** (adaptateur laissé, désactivé). | Oui |
| `PAYMENT_WEBHOOK_SECRET` | Secret qui signe les notifications de paiement. Seule une notification signée débloque un rapport. | Oui |
| `VISION_PROVIDER` | `simulation` en local ; `xai` pour le vrai moteur d'analyse. | Oui |
| `XAI_API_KEY` | Clé de l'API xAI. Reste sur le serveur, jamais envoyée au navigateur. | Si `xai` |
| `XAI_MODEL` | Modèle xAI. Vide = `grok-4.7` (celui qui a été testé). | Non |
| `XAI_EFFORT` | Effort de raisonnement : `low` (recommandé, le plus rapide). Ne pas laisser vide : 10 fois plus lent. | Non |
| `XAI_TEXT_MODEL` | Modèle de la rédaction du rapport photo (appel sans la photo). Vide = `grok-4.20-0309-non-reasoning` (sans raisonnement : environ 9 s et 0,006 $ par rédaction, contre 199 s et 0,11 $ avec `grok-4.7`, mesuré le 03/10/2026). | Non |
| `XAI_PRICE_IN_PER_M`, `XAI_PRICE_OUT_PER_M` | Tarifs xAI (dollars par million de jetons), pour calculer le coût réel d'une analyse dans l'administration. À mettre à jour si xAI change ses prix. | Non |
| `AGE_PROVIDER` | Vérification d'âge : `simulation` en local ; en production `ageverif` (adaptateur prêt, jamais essayé avec le vrai prestataire) ; `yoti` : adaptateur **non écrit**, ne pas utiliser (voir docs/ACTIVATION-PHOTO.md). | Oui (B, C) |
| `SCREENING_PROVIDER` | Filtrage des images par empreinte : **optionnel**. Vide = aucun filtrage (accepté partout, un avertissement est journalisé au démarrage et à chaque analyse ; le site ne prétend jamais qu'un filtrage a eu lieu) ; `simulation` ou `off` : local uniquement ; prestataire réel : aucun adaptateur disponible à ce jour. | Non |
| `PHOTO_BETA` | `on` = **bêta de la formule photo** (avec `FREE_BETA=on`) : la formule B (photo) existe, gratuite ; C, paiement et CGV restent introuvables. **Désactivée par défaut.** En production, ignorée (avertissement au démarrage) tant qu'un prestataire réel de vérification d'âge n'est pas configuré avec ses variables (`ageverif` : `AGEVERIF_CLIENT_ID`, `AGEVERIF_CLIENT_SECRET`, `AGE_TOKEN_SECRET`, `SITE_URL` ; `yoti` ne suffit pas : pas d'adaptateur, il ne compte pas comme prestataire prêt), que `VISION_PROVIDER` n'est pas `xai` (avec `XAI_API_KEY`), que `CAPTCHA_PROVIDER` n'est pas `altcha` (avec `ALTCHA_HMAC_KEY`), ou si `SCREENING_PROVIDER` vaut `simulation` ou `off`. | Non |
| `XAI_DAILY_CAP_USD` | Plafond de dépense xAI par jour civil (Europe/Paris), en dollars. Vide ou invalide = 5. Plafond atteint : « Capacité du jour atteinte, revenez demain », aucun appel au modèle. Dépense visible dans `/admin`. | Non |
| `CAPTCHA_PROVIDER` | Anti-robots : `simulation`, `altcha` (preuve de travail auto-hébergée, prête), ou `off` (local uniquement). | Oui (B, C) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Clés du paiement Stripe (`sk_test_`/`sk_live_` et `whsec_`). Adresse de notification à déclarer chez Stripe : `SITE_URL` + `/api/payments/webhook`. | Si `stripe` |
| `AGEVERIF_CLIENT_ID` | AgeVerif : identifiant « client » OAuth2 (clé « Live » du site), plateforme webmasters d'AgeVerif (https://webmasters.ageverif.com ; l'emplacement exact dans le tableau de bord n'est pas décrit par la documentation, à relever à l'ouverture du compte). Forme : une chaîne fournie par AgeVerif. | Si `ageverif` |
| `AGEVERIF_CLIENT_SECRET` | AgeVerif : secret OAuth2 associé (même endroit). Reste sur le serveur. | Si `ageverif` |
| `AGEVERIF_CHALLENGES` | AgeVerif : méthodes proposées, séparées par des virgules, vide = toutes. Valeurs documentées : `selfie`, `email_age`, `credit_card`, `ticket`, `anonymage`, `pleenk`, `paypal`, `agego`, `agekey`. Exemple de forme : `selfie,email_age,credit_card`. Adresse de retour à déclarer si la plateforme la demande : `SITE_URL` + `/api/age/callback`. | Non |
| `YOTI_CLIENT_SDK_ID`, `YOTI_API_KEY` | Yoti : **noms réservés, non lus par le code** (aucun adaptateur, `yoti` ne compte pas comme prestataire prêt). D'après la documentation de Yoti : « Client SDK ID » (UUID, en-tête `Yoti-SDK-Id`) et « API Key » (jeton Bearer, secret), créés avec le service « Age Verification » dans Yoti Hub. | Non |
| `ALTCHA_HMAC_KEY`, `ALTCHA_MAX_NUMBER` | Clé secrète (32 caractères ou plus) et difficulté du captcha auto-hébergé (défaut 100000). | Si `altcha` |
| `SEO_PUBLISH` | Vide = pages de contenu (guides) cachées et en `noindex`. Mettre `on` **après relecture des textes**, puis reconstruire le site. | Non |
| `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` | Accès à `/admin`. Générez-les avec `npm run admin:hash -- "votre mot de passe de 12 caractères ou plus"` et copiez les deux lignes affichées. Le mot de passe lui-même n'est écrit nulle part. | Pour /admin |
| `STATS_WEBHOOK_URL`, `STATS_WEBHOOK_SECRET` | Envoi quotidien de chiffres anonymes agrégés (Make, n8n…). Adresse en https. Vide = rien n'est envoyé. | Non |

## 3. Où changer les prix, les poids et les marges

Tout est dans un seul fichier : [src/config/site.ts](src/config/site.ts).

- `FORMULAS` : les prix des formules A, B et C.
- `SCORE` : la formule du score et le poids de chaque critère (longueur, circonférence, courbure, symétrie).
- `REFERENCES` : les populations de référence pour les percentiles.
- `MARGIN` : la marge d'erreur affichée et ses seuils. `PHOTO_LIMITS` : refus de photo (inclinaison, carte trop petite). `CAMERA` : réglages de géométrie.
- `FINANCE` : TVA (20 %) et commission de paiement (15,5 %, **provisoire** : à remplacer par la vraie valeur).
- `UPLOAD`, `TICKER`, `ADMIN`, `WEBHOOK` : taille des photos, bandeau défilant (seuil du compteur d'analyses, délais de lecture), administration, webhook.
- Réponse standardisée des rapports photo : schéma versionné et règles de validation (nombre et longueur des observations, termes interdits) dans `src/lib/vision/schema.ts` ; prompts dans `src/lib/vision/prompts/photo-report-v1.ts` (pour les améliorer : nouveau fichier `-v2`, référencé dans `prompts/index.ts`). Réservation par analyse pour le plafond quotidien : `ESTIMATED_ANALYSIS_USD` dans `src/lib/xaiSpend.ts`.

Après une modification : `npm run verify`, puis commit. Les formules de calcul sont couvertes par des tests automatiques : si un test casse, c'est qu'un résultat a changé, à examiner avant d'aller plus loin.

## 4. Tâches programmées (à mettre en place à la mise en ligne)

| Commande | Fréquence | Rôle |
|---|---|---|
| `npm run db:purge` | **toutes les heures** | Supprime les rapports non payés, les rapports de la bêta gratuite de plus de 90 jours et les empreintes d'IP de plus de 24 h. Sans elle, le site ne respecte pas sa politique de confidentialité. |
| `npm run stats:webhook` | **une fois par jour** | Envoie les chiffres agrégés anonymes (seulement si `STATS_WEBHOOK_URL` est rempli). |

Les deux se lancent avec les mêmes réglages que le site. Sur Railway, ce sont deux services « cron » (`purge`, `stats`) : voir [docs/RAILWAY.md](docs/RAILWAY.md). Sur un hébergeur sans variables d'environnement, ajouter `--env-file=.env` aux commandes.

Les statistiques durables (journal anonyme, paiements) sont conservées même après suppression des rapports ; elles ne contiennent ni photo, ni mesure, ni adresse IP.

## 5. Mise en ligne, étape par étape

**Rien de ceci n'est fait.** Chaque étape qui crée un compte ou un abonnement doit être validée par vous d'abord.

1. **Hébergeur : Railway** (décidé) : voir [docs/RAILWAY.md](docs/RAILWAY.md) et [docs/HEBERGEMENT.md](docs/HEBERGEMENT.md). Pour les formules photo, demander à Railway une confirmation écrite (message prêt dans `docs/DEMANDES/`).
2. **Faire relire par un juriste** les CGV, la politique de confidentialité, les mentions légales et la clause de renonciation au droit de rétractation (point signalé dans `docs/DECISIONS.md`).
3. **Choisir les vrais prestataires** et les brancher (une interface existe pour chacun dans `src/lib/providers`) : paiement, vérification d'âge, filtrage d'images par empreinte, captcha. Ajouter leur domaine, et lui seul, dans la politique de sécurité de `next.config.ts` si leur page charge un script.
4. **Créer la base PostgreSQL** chez l'hébergeur, renseigner `DATABASE_URL`, puis lancer `npm run db:migrate`.
5. **Renseigner tous les secrets** du tableau de la partie 2 chez l'hébergeur (jamais dans le code). Mettre `VISION_PROVIDER=xai`, les vrais fournisseurs, `SITE_URL` en https.
6. **Construire et démarrer** : `npm run build` puis `npm run start`.
7. **Programmer** `db:purge` (toutes les heures) et `stats:webhook` (une fois par jour).
8. **Contrôler** : pages principales, un paiement de test en mode test du prestataire, `/admin`, les en-têtes de sécurité, `npm run seo:check -- --urls` sur l'adresse publique.
9. **Relire les pages de guide** puis mettre `SEO_PUBLISH=on` et reconstruire.
10. Demander à xAI la **non-conservation des données** (Zero Data Retention) : sans cela, xAI garde les requêtes 30 jours, ce que la politique de confidentialité indique.

## 6. Commandes utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Site en mode développement. |
| `npm run verify` | Code, types, tests, contrôle des pages de contenu, construction : à lancer avant chaque commit. |
| `npm test` | Tests unitaires seuls. |
| `npm run e2e` | Tests du navigateur (parcours complets avec prestataires simulés, sans aucun appel xAI), y compris le mode bêta gratuite protégé par mot de passe. Premier usage : `npx playwright install chromium`. |
| `npm run e2e:remote` | Test de fumée du site de test déployé (adresse et identifiants lus dans `.env`). Supprime les rapports qu'il crée. |
| `npm run db:migrate` | Crée ou met à jour les tables. |
| `npm run db:purge` | Purge (voir partie 4). |
| `node scripts/reset-test-data.mjs` | Remet à zéro les données d'un site de TEST (refuse sans `RESET_TEST_DATA=oui-effacer-les-donnees-de-test` et refuse si la base contient un vrai paiement). **Jamais sur un site réel.** |
| `npm run seo:check` | Contrôle les pages de contenu (`-- --urls` : contrôle aussi le site en ligne). |
| `npm run admin:hash` | Fabrique les réglages de l'accès administrateur. |
| `npm run stats:webhook` | Envoie les agrégats anonymes. |
| `npm run geometry:report` | Rapport d'exactitude de la géométrie sur des prises de vue simulées. |
| `npm run calibrate` | Calibration sur de vraies prises de vue : protocole dans [docs/CALIBRATION.md](docs/CALIBRATION.md). |
| `npm run latency:bench`, `npm run xai:test` | Mesures et essais du moteur xAI. Coûtent quelques centimes ; n'utiliser qu'une image neutre. |
| `npm run photo:test`, `npm run photo:supprimer` | Test de la formule photo sur **votre** photo, en local (photos-test/, ignoré par git), résultat en texte seulement, suppression propre : mode d'emploi pas à pas dans [docs/TEST-PHOTO.md](docs/TEST-PHOTO.md). `-- --simulation` : essai à blanc sans coût. Le mode réel appelle xAI (environ 2 centimes) ; il refuse de démarrer si `XAI_DAILY_CAP_USD` serait dépassé. |
| `npm run xai:schema-check` | Vérifie avec la vraie API que le schéma JSON strict versionné des réponses (`photo-report/1`) est accepté et que les réponses se valident, avec une image neutre fabriquée par le script (environ 2 centimes ; `--comment-only` : la rédaction seule). |

## 7. Règles à ne jamais enfreindre

- Aucun secret dans le code ou sur GitHub.
- Aucune image explicite dans le dépôt ; les photos personnelles de test restent dans `photos-test/` (ignoré par git) et sont supprimées après usage.
- Les libellés doivent être vrais : le filtrage par empreinte n'est jamais présenté comme une détection d'âge ni d'images nouvelles.
- Les prestataires simulés ne doivent jamais tourner en production.
