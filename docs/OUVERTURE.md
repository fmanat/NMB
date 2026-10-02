# Ouverture : relier bitometre.com, retirer le mot de passe, vérifier le site public

Ce que vous faites **demain matin**, pas à pas. Rien de tout cela n'a été fait pendant la nuit : bitometre.com n'est relié à rien, Cloudflare n'a pas été touché, la protection par mot de passe est en place.

Temps prévu : 30 minutes de manipulations, plus l'attente de la propagation (de quelques minutes à quelques heures).

## 0. Avant de commencer : les vérifications

| À vérifier | Pourquoi |
|---|---|
| **L'adresse de contact est `contact@bitometre.com`** (`src/config/company.ts`) et le routage d'e-mails est actif (voir étape 1bis). | Aucune autre information sur l'éditeur n'est publiée : il n'y a plus de garde-fou 503. |
| **Une limite d'usage est définie dans Railway** (Settings → Usage → limite dure, par exemple 20 $). | Aucune limite n'était définie au 01/10/2026 : une erreur ou un pic de trafic ferait monter la facture sans plafond. |
| **Le nom de domaine est bien à vous** (acheté chez Cloudflare ou ailleurs). | Voir le cas A ou B ci-dessous. |

## 1. Côté Cloudflare : mettre le domaine dans Cloudflare

### Cas A : le domaine a été acheté chez Cloudflare (Cloudflare Registrar)

Le DNS est déjà chez Cloudflare. Passez directement à l'étape 2.

### Cas B : le domaine a été acheté ailleurs (OVH, Gandi, GoDaddy…)

1. Connectez-vous à <https://dash.cloudflare.com> → **Add a domain** (« Ajouter un domaine ») → saisissez `bitometre.com` → choisissez l'offre **Free**.
2. Cloudflare importe les enregistrements existants. **Supprimez ou ignorez ceux qui ne sont pas utiles** (anciennes pages de parking du registrar).
3. Cloudflare vous donne **deux serveurs de noms** (par exemple `xxx.ns.cloudflare.com` et `yyy.ns.cloudflare.com`). Notez-les.
4. Chez le registrar où vous avez acheté le domaine : remplacez les serveurs de noms par ces deux-là (rubrique « Serveurs DNS » / « Nameservers » du domaine). Si le registrar propose « DNSSEC », **désactivez-le avant** le changement, puis réactivez-le dans Cloudflare une fois le domaine actif.
5. Revenez dans Cloudflare : le domaine passe à **Active** (de quelques minutes à 24 heures). Ne continuez qu'une fois le statut « Active ».

## 2. Côté Railway : déclarer le domaine

1. Ouvrez <https://railway.com> → projet **bitometre-test** → service **web** → **Settings** → **Networking** → **Custom Domain** → **+ Custom Domain**.
2. Saisissez `bitometre.com` (domaine racine). Répétez avec `www.bitometre.com` si vous voulez aussi cette adresse.
3. Railway affiche, pour chaque domaine, **deux enregistrements obligatoires** : un **CNAME** (une valeur du type `xxxxx.up.railway.app`) et un **TXT** de vérification (nom du type `_railway-verify`, valeur commençant par `railway-verify=`). Copiez-les exactement. Sans les deux, le domaine n'est pas vérifié.

## 3. Côté Cloudflare : créer les enregistrements DNS

Dans Cloudflare → votre domaine → **DNS** → **Records** → **Add record**. Pour le domaine racine `bitometre.com` :

| Type | Nom | Contenu | Proxy |
|---|---|---|---|
| `CNAME` | `@` (ou `bitometre.com`) | la valeur CNAME donnée par Railway (`xxxxx.up.railway.app`) | **Proxied** (nuage orange) |
| `TXT` | le nom donné par Railway (`_railway-verify` ou `_railway-verify.bitometre.com`) | la valeur donnée par Railway (`railway-verify=…`) | (aucun : les TXT ne passent pas par le proxy) |

Si vous avez aussi ajouté `www.bitometre.com` : `CNAME` · nom `www` · même contenu que ci-dessus (celui que Railway donne pour `www`) · **Proxied**. Un CNAME à la racine est autorisé chez Cloudflare (« CNAME flattening ») ; Railway le prend en charge.

Les valeurs exactes sont celles de **votre** écran Railway : je ne peux pas les connaître à l'avance.

## 4. Réglages Cloudflare compatibles avec Railway

Dans Cloudflare → votre domaine :

| Réglage | Valeur | Pourquoi |
|---|---|---|
| **SSL/TLS → Overview → Encryption mode** | **Full** (pas « Flexible », pas « Full (strict) ») | Selon la documentation de Railway, « Full (strict) » ne fonctionne pas comme prévu avec le proxy ; « Flexible » provoque des boucles de redirection (`ERR_TOO_MANY_REDIRECTS`) car le site force déjà le HTTPS. |
| **SSL/TLS → Edge Certificates → Universal SSL** | Activé | Certificat HTTPS côté visiteur. |
| **SSL/TLS → Edge Certificates → Always Use HTTPS** | Activé | |
| **Security → Bots → Bot Fight Mode** | **Désactivé** | Il dépose un cookie (`__cf_bm`), ce qui contredirait « sans cookie » dans la politique de confidentialité, et peut bloquer l'envoi anonyme de mesure d'audience. |
| **Speed → Optimization** : Rocket Loader, Auto Minify | **Désactivés** | Ils réécrivent les scripts ; la politique de sécurité du site (CSP) les bloquerait. |
| **Web Analytics** (si proposé) | **Désactivé** | Il injecte un script et un suivi ; le site s'engage à n'en avoir aucun. |
| **Caching** | Laisser les réglages par défaut | Les pages privées (`/r/…`) ne doivent jamais être mises en cache ; elles envoient déjà `Cache-Control` adapté. Ne créez pas de règle de cache. |

Railway délivre lui-même le certificat (Let's Encrypt) pour le domaine : attendez que, dans Railway, le domaine passe à **« Active » / « Verified »** (quelques minutes, parfois jusqu'à 72 h si le DNS tarde).

## 5. Mettre à jour l'adresse du site

Dans Railway → service **web** → **Variables** :

1. `SITE_URL` = `https://bitometre.com` (sans `/` final). Cela sert aux liens de partage, aux images de partage et à la sécurité.
2. Laissez `SITE_PASSWORD` en place **tant que l'étape 6 n'est pas terminée**.

Railway redéploie tout seul après chaque changement de variable.

## 6. Vérifier le domaine **avant** de retirer le mot de passe

Dans un navigateur : ouvrez `https://bitometre.com`. Vous devez voir la fenêtre « identifiants requis » : saisissez l'utilisateur et le mot de passe notés dans votre `.env` (`RAILWAY_TEST_SITE_USER` / `RAILWAY_TEST_SITE_PASSWORD`). Puis vérifiez : cadenas HTTPS valide, accueil affiché, un questionnaire de test jusqu'au rapport (supprimez-le ensuite avec « Supprimer mon rapport »).

Test automatique sur le domaine (ou me le demander) : mettre `RAILWAY_TEST_URL=https://bitometre.com` dans `.env`, puis

```bash
npm run e2e:remote
```

## 7. Retirer le mot de passe (ouverture au public)

**Ne le faites qu'après** : étape 0 complète, étapes 1 à 6 réussies.

1. Railway → service **web** → **Variables** → supprimez `SITE_PASSWORD` (et `SITE_USER`).
2. Attendez la fin du redéploiement (statut « Active » du service).
3. Il n'y a plus de garde-fou 503 : sans `SITE_PASSWORD`, le site est public tout de suite. Pour refermer, remettez `SITE_PASSWORD`.

Pour **refermer** le site en urgence : remettez simplement `SITE_PASSWORD` (variable ajoutée, redéploiement automatique, 1 à 2 minutes).

## 8. Vérifier le site public

Depuis votre ordinateur (une fenêtre de navigation privée, pour ne pas garder vos identifiants) :

| Vérification | Résultat attendu |
|---|---|
| `https://bitometre.com` | Accueil sans demande d'identifiants, cadenas valide. |
| `http://bitometre.com` | Redirigé vers `https://`. |
| `https://bitometre.com/cgv`, `/analyse/photo`, `/paiement/x` | Page « introuvable » (bêta : formule A seule). |
| `https://bitometre.com/conditions`, `/mentions-legales`, `/confidentialite` | Textes de la bêta, sans aucun `[À COMPLÉTER]`. |
| Un questionnaire complet | Rapport affiché avec « BÊTA GRATUITE », sans paiement. Puis supprimez ce rapport. |
| `https://bitometre.com/api/health` | `{"ok":true}` |
| `https://bitometre.com/admin` | Page de connexion de l'administration (utilisez `RAILWAY_TEST_ADMIN_PASSWORD`, ou mieux : un mot de passe à vous avec `npm run admin:hash` et la variable `ADMIN_PASSWORD_HASH`). |
| Cookies (outils du navigateur → Application → Cookies) | **Aucun** cookie sur bitometre.com (hors page d'administration connectée). |
| <https://securityheaders.com/?q=bitometre.com> | Note A ou A+ attendue. |

Toute anomalie : refermez le site (remettre `SITE_PASSWORD`) et revenez me voir.

## 9. À savoir

- **HSTS** : le site envoie `Strict-Transport-Security` pour deux ans, sous-domaines compris. Tous les sous-domaines de bitometre.com devront donc être en HTTPS. Pas de `preload`.
- **Adresse de test Railway** (`…up.railway.app`) : elle reste active après la liaison du domaine. Une fois le mot de passe retiré, elle devient publique aussi, avec le même contenu. Si vous ne voulez qu'une adresse, supprimez le domaine Railway dans Settings → Networking.
- **Limitation par adresse IP** (5 analyses par 24 h) : le site lit la première adresse de l'en-tête `x-forwarded-for`. Derrière Cloudflare, vérifiez que cette adresse est bien celle du visiteur (sinon la limite s'applique à Cloudflare, ou peut être contournée). Point technique à contrôler après ouverture ; me le signaler.
- **Aucune action chez Cloudflare** n'a été faite pendant la nuit, ni aucune liaison du domaine.
