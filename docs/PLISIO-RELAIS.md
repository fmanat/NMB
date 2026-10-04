# Mettre en place le relais Plisio (Cloudflare Worker)

**Pourquoi :** le serveur de Plisio (`api.plisio.net`) ne répond pas aux connexions qui viennent de Railway (diagnostic du 04/10/2026 : délai dépassé à chaque essai, alors qu'il répond en 0,3 s depuis un ordinateur ordinaire). Le site enverra donc ses demandes de facture à un petit programme hébergé gratuitement chez Cloudflare, le « relais », qui les transmet à Plisio.

Le relais ne fait qu'une chose : transmettre la demande de création de facture. Il refuse tout le reste, et toute demande qui ne porte pas le bon secret. Il n'enregistre rien.

Durée : 10 à 15 minutes. Vous aurez besoin de votre compte Cloudflare et de votre compte Railway.

## Étape 1 : fabriquer un secret

Le secret est un mot de passe partagé entre le site et le relais. Sur votre Mac, ouvrez l'application **Terminal**, collez cette commande et appuyez sur Entrée :

```bash
openssl rand -hex 32
```

Une ligne de 64 caractères s'affiche. Copiez-la et gardez-la sous la main (dans votre gestionnaire de mots de passe, par exemple). Ne l'envoyez à personne.

## Étape 2 : créer le Worker chez Cloudflare

1. Allez sur https://dash.cloudflare.com.
2. Dans le menu de gauche, cliquez sur **Compute (Workers)** puis **Workers & Pages** (selon l'affichage : **Workers & Pages** directement).
3. Cliquez sur **Créer** (« Create »), puis choisissez **Créer un Worker** (« Create Worker », modèle « Hello World »).
4. Dans le champ du nom, tapez `plisio-relais`.
5. Cliquez sur **Déployer** (« Deploy »). Cloudflare crée le Worker et affiche son adresse, de la forme `https://plisio-relais.VOTRE-SOUS-DOMAINE.workers.dev`. **Notez cette adresse.**

## Étape 3 : coller le code du relais

1. Sur la page du Worker, cliquez sur **Modifier le code** (« Edit code »).
2. Dans l'éditeur, sélectionnez tout le code existant (Cmd + A) et supprimez-le.
3. Ouvrez le fichier `cloudflare/plisio-relais.js` du projet (sur GitHub : dépôt fmanat/NMB, dossier `cloudflare`), copiez **tout** son contenu et collez-le dans l'éditeur.
4. Cliquez sur **Déployer** (« Deploy »), en haut à droite.

## Étape 4 : donner le secret au relais

1. Revenez à la page du Worker `plisio-relais`, onglet **Paramètres** (« Settings »).
2. Rubrique **Variables et secrets** (« Variables and Secrets »), cliquez sur **Ajouter** (« Add »).
3. Remplissez :
   - **Type** : `Secret` (et non « Text ») ;
   - **Nom** : `RELAIS_SECRET` ;
   - **Valeur** : le secret de l'étape 1.
4. Cliquez sur **Déployer** (« Deploy ») pour enregistrer.

Vérification facultative : ouvrez l'adresse du Worker dans votre navigateur. Vous devez voir « Not found ». C'est normal : le relais refuse tout ce qui n'est pas une demande de facture signée.

## Étape 5 : indiquer le relais au site (Railway)

1. Allez sur https://railway.com, projet **bitometre-test**, service **web**, onglet **Variables**.
2. Ajoutez deux variables (**New Variable**) :
   - `PLISIO_API_BASE` = l'adresse du Worker notée à l'étape 2, par exemple `https://plisio-relais.VOTRE-SOUS-DOMAINE.workers.dev` (sans rien après) ;
   - `PLISIO_RELAY_SECRET` = le **même** secret que dans Cloudflare (étape 1).
3. Railway redéploie le site tout seul (2 à 3 minutes).

## Étape 6 : vérification

Dites-moi quand c'est fait. Au démarrage, le site teste automatiquement le relais avec une fausse clé (aucune facture n'est créée) et inscrit le résultat dans ses journaux : la ligne `plisio_probe` doit indiquer `relais: "HTTP 422 (code Plisio 101) …"`, ce qui veut dire que Plisio a bien répondu à travers le relais. Je contrôle cette ligne, puis vous pouvez refaire votre paiement de test.

Si la ligne indique `HTTP 403`, les deux secrets ne sont pas identiques (Cloudflare et Railway). Si elle indique un échec ou un délai dépassé, Plisio refuse aussi les connexions venant de Cloudflare : il faudra alors passer par une autre solution (adresse IP fixe chez Railway, ou support de Plisio).

## Pour revenir en arrière

Supprimez les deux variables `PLISIO_API_BASE` et `PLISIO_RELAY_SECRET` dans Railway : le site recontacte Plisio directement.
