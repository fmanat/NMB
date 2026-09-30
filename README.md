# Bitomètre

Site francophone (pensé pour le téléphone) qui vend une analyse chiffrée de mesures corporelles saisies par l'utilisateur : score sur 100, percentiles, courbure, symétrie. Ton pince-sans-rire de faux laboratoire. Aucune image explicite.

- Formule A : questionnaire, 2,99 €. Formule B : photo, 4,99 €. Formule C : photo et mesures déclarées, 6,99 €.
- Le cahier des charges complet est dans [docs/SPEC.md](docs/SPEC.md). Les choix pris en autonomie sont dans [docs/DECISIONS.md](docs/DECISIONS.md).
- La photo n'est jamais enregistrée par le site : elle est analysée en mémoire puis abandonnée.

> **État actuel : le site n'est pas en ligne.** Tout fonctionne en local, avec des prestataires **simulés** (paiement, vérification d'âge, filtrage d'images, captcha). Ils sont interdits en production : le site refuse de les utiliser en production (la fonction concernée échoue). Il faut de vrais prestataires avant la mise en ligne (voir la partie 5).

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
| `PAYMENT_PROVIDER` | `simulation` en local. En production : `stripe` (adaptateur prêt, désactivé tant que ses clés manquent). | Oui |
| `PAYMENT_WEBHOOK_SECRET` | Secret qui signe les notifications de paiement. Seule une notification signée débloque un rapport. | Oui |
| `VISION_PROVIDER` | `simulation` en local ; `xai` pour le vrai moteur d'analyse. | Oui |
| `XAI_API_KEY` | Clé de l'API xAI. Reste sur le serveur, jamais envoyée au navigateur. | Si `xai` |
| `XAI_MODEL` | Modèle xAI. Vide = `grok-4.7` (celui qui a été testé). | Non |
| `XAI_EFFORT` | Effort de raisonnement : `low` (recommandé, le plus rapide). Ne pas laisser vide : 10 fois plus lent. | Non |
| `XAI_PRICE_IN_PER_M`, `XAI_PRICE_OUT_PER_M` | Tarifs xAI (dollars par million de jetons), pour calculer le coût réel d'une analyse dans l'administration. À mettre à jour si xAI change ses prix. | Non |
| `AGE_PROVIDER` | Vérification d'âge : `simulation` en local ; en production `ageverif` (adaptateur prêt). | Oui (B, C) |
| `SCREENING_PROVIDER` | Filtrage des images par empreinte : `simulation`, prestataire réel, ou `off` (local uniquement). | Oui (B, C) |
| `CAPTCHA_PROVIDER` | Anti-robots : `simulation`, `altcha` (preuve de travail auto-hébergée, prête), ou `off` (local uniquement). | Oui (B, C) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Clés du paiement Stripe (`sk_test_`/`sk_live_` et `whsec_`). Adresse de notification à déclarer chez Stripe : `SITE_URL` + `/api/payments/webhook`. | Si `stripe` |
| `AGEVERIF_CLIENT_ID`, `AGEVERIF_CLIENT_SECRET`, `AGEVERIF_CHALLENGES` | Identifiants OAuth2 d'AgeVerif et liste facultative de méthodes. Adresse de retour à déclarer : `SITE_URL` + `/api/age/callback`. | Si `ageverif` |
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
- `FINANCE` : TVA (20 %) et commission de paiement (12 %, **provisoire** : à remplacer par la vraie valeur).
- `UPLOAD`, `TICKER`, `ADMIN`, `WEBHOOK` : taille des photos, bandeau de chiffres réels, administration, webhook.

Après une modification : `npm run verify`, puis commit. Les formules de calcul sont couvertes par des tests automatiques : si un test casse, c'est qu'un résultat a changé, à examiner avant d'aller plus loin.

## 4. Tâches programmées (à mettre en place à la mise en ligne)

| Commande | Fréquence | Rôle |
|---|---|---|
| `npm run db:purge` | **toutes les heures** | Supprime les rapports non payés et les empreintes d'IP de plus de 24 h. Sans elle, le site ne respecte pas sa politique de confidentialité. |
| `npm run stats:webhook` | **une fois par jour** | Envoie les chiffres agrégés anonymes (seulement si `STATS_WEBHOOK_URL` est rempli). |

Les deux se lancent avec les mêmes réglages que le site. Chaque hébergeur a sa façon de programmer une tâche : voir [docs/HEBERGEMENT.md](docs/HEBERGEMENT.md).

Les statistiques durables (journal anonyme, paiements) sont conservées même après suppression des rapports ; elles ne contiennent ni photo, ni mesure, ni adresse IP.

## 5. Mise en ligne, étape par étape

**Rien de ceci n'est fait.** Chaque étape qui crée un compte ou un abonnement doit être validée par vous d'abord.

1. **Choisir l'hébergeur** : voir [docs/HEBERGEMENT.md](docs/HEBERGEMENT.md). Écrire à l'hébergeur pour confirmer que ce service est accepté avant de payer (la plupart des conditions interdisent le contenu « pornographique » ; ce site n'en contient pas, mais une confirmation écrite évite une suspension).
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
| `npm run e2e` | Tests du navigateur (parcours complets avec prestataires simulés, sans aucun appel xAI). Premier usage : `npx playwright install chromium`. |
| `npm run db:migrate` | Crée ou met à jour les tables. |
| `npm run db:purge` | Purge (voir partie 4). |
| `npm run seo:check` | Contrôle les pages de contenu (`-- --urls` : contrôle aussi le site en ligne). |
| `npm run admin:hash` | Fabrique les réglages de l'accès administrateur. |
| `npm run stats:webhook` | Envoie les agrégats anonymes. |
| `npm run geometry:report` | Rapport d'exactitude de la géométrie sur des prises de vue simulées. |
| `npm run calibrate` | Calibration sur de vraies prises de vue : protocole dans [docs/CALIBRATION.md](docs/CALIBRATION.md). |
| `npm run latency:bench`, `npm run xai:test` | Mesures et essais du moteur xAI. Coûtent quelques centimes ; n'utiliser qu'une image neutre. |

## 7. Règles à ne jamais enfreindre

- Aucun secret dans le code ou sur GitHub.
- Aucune image explicite dans le dépôt ; les photos personnelles de test restent dans `photos-test/` (ignoré par git) et sont supprimées après usage.
- Les libellés doivent être vrais : le filtrage par empreinte n'est jamais présenté comme une détection d'âge ni d'images nouvelles.
- Les prestataires simulés ne doivent jamais tourner en production.
