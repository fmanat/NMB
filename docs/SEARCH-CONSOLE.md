# Déclarer Bitomètre à Google et à Bing

Ce guide se suit dans l'ordre, sans connaissance technique. Comptez 30 à 45 minutes en tout. Les libellés des boutons peuvent changer légèrement d'un mois à l'autre : cherchez le mot le plus proche.

Vous aurez besoin :
- d'un compte Google (une adresse Gmail suffit) ;
- de l'accès à votre compte **Cloudflare** (celui qui gère le domaine bitometre.com) ;
- d'un ordinateur (plus simple qu'un téléphone pour ces écrans).

## Avant de commencer : le site doit être ouvert

Google et Bing ne lisent que ce qu'un visiteur anonyme peut lire. Tant que le site demande un mot de passe (variable `SITE_PASSWORD` sur Railway) ou affiche la page « site en préparation » (code 503), **la déclaration fonctionne mais aucune page ne sera indexée**. Vous pouvez faire les étapes 1 à 3 dès maintenant (la vérification par DNS ne dépend pas du mot de passe) ; l'envoi du sitemap (étape 4) donnera une erreur tant que le site est fermé : refaites-le le jour de l'ouverture.

Pour vérifier : ouvrez https://bitometre.com/sitemap.xml dans une fenêtre de navigation privée. Si vous voyez une liste d'adresses sans qu'on vous demande de mot de passe, le site est prêt.

## 1. Google Search Console : ajouter le domaine

1. Allez sur https://search.google.com/search-console et connectez-vous avec votre compte Google.
2. Si c'est votre première visite, une fenêtre « Sélectionnez le type de propriété » s'ouvre directement. Sinon, cliquez en haut à gauche sur le menu déroulant des propriétés, puis sur **Ajouter une propriété**.
3. Choisissez la case de **gauche**, intitulée **Domaine** (et non « Préfixe de l'URL »).
4. Tapez `bitometre.com` (sans https, sans www), puis cliquez sur **Continuer**.
5. Google affiche une fenêtre « Valider la propriété du domaine via un enregistrement DNS ». Elle contient une longue ligne qui commence par `google-site-verification=`.
6. Cliquez sur le bouton **Copier** à côté de cette ligne. **Ne fermez pas cette fenêtre** : vous y reviendrez à l'étape 2.8.

## 2. Cloudflare : coller le code de Google

1. Dans un nouvel onglet, allez sur https://dash.cloudflare.com et connectez-vous.
2. Cliquez sur le domaine **bitometre.com**.
3. Dans le menu de gauche, cliquez sur **DNS**, puis sur **Enregistrements** (ou « Records »).
4. Cliquez sur le bouton bleu **Ajouter un enregistrement** (« Add record »).
5. Remplissez :
   - **Type** : choisissez `TXT` dans la liste ;
   - **Nom** : tapez `@` (cela veut dire « le domaine lui-même ») ;
   - **Contenu** : collez la ligne copiée chez Google (`google-site-verification=…`), en entier, sans espace avant ni après ;
   - **TTL** : laissez « Auto ».
6. Cliquez sur **Enregistrer** (« Save »).
7. Ne touchez à aucun autre enregistrement de cette page : ils font fonctionner le site.
8. Revenez sur l'onglet de Google Search Console et cliquez sur **Valider**.

Si Google répond « Échec de la validation », c'est en général que l'enregistrement n'est pas encore diffusé. Attendez 10 minutes, puis cliquez de nouveau sur **Valider**. Cela peut prendre jusqu'à quelques heures dans de rares cas. Laissez l'enregistrement TXT en place pour toujours : s'il est supprimé, Google retire l'accès.

## 3. Google Search Console : réglage utile

Une fois validé, vous arrivez sur le tableau de bord de la propriété `bitometre.com`.

1. En bas du menu de gauche, cliquez sur **Paramètres**, puis **Utilisateurs et autorisations** : vous êtes « Propriétaire ». N'ajoutez personne d'autre sans en avoir besoin.
2. Rien d'autre à régler.

## 4. Google Search Console : envoyer le sitemap

Le sitemap est la liste des pages du site, tenue à jour automatiquement à chaque mise en ligne. Il se trouve à l'adresse https://bitometre.com/sitemap.xml.

1. Dans le menu de gauche, cliquez sur **Sitemaps**.
2. Dans la zone « Ajouter un sitemap », l'adresse commence déjà par `https://bitometre.com/`. Tapez seulement `sitemap.xml` à la suite.
3. Cliquez sur **Envoyer**.
4. Le tableau « Sitemaps envoyés » affiche une ligne. L'état passe à **Opération effectuée** en quelques minutes à quelques jours. La colonne « Pages découvertes » doit indiquer le même nombre que de pages listées dans le sitemap.

Vous n'aurez **jamais à renvoyer** le sitemap : Google le relit de lui-même. Si l'état affiche « Impossible de récupérer », vérifiez que le site est bien ouvert (voir « Avant de commencer »), puis renvoyez-le.

### Demander l'indexation des pages principales (facultatif, accélère)

1. En haut de l'écran, dans la barre « Inspecter n'importe quelle URL », collez `https://bitometre.com/` puis appuyez sur Entrée.
2. Après l'analyse, cliquez sur **Demander une indexation**.
3. Recommencez pour : `https://bitometre.com/taille-moyenne-penis`, `https://bitometre.com/taille-penis-normale`, `https://bitometre.com/percentile-penis`. Google limite le nombre de demandes par jour : inutile de le faire pour toutes les pages.

## 5. Bing Webmaster Tools : importer depuis Google (le plus simple)

Bing alimente aussi DuckDuckGo, Ecosia et Qwant en partie. La méthode la plus rapide reprend la vérification déjà faite chez Google.

1. Allez sur https://www.bing.com/webmasters et cliquez sur **Se connecter** (« Sign in »).
2. Choisissez **Google** et connectez-vous avec **le même compte Google** que pour Search Console.
3. Bing propose deux options. Choisissez **Importer vos sites à partir de Google Search Console** (« Import your sites from GSC »), puis **Importer**.
4. Autorisez l'accès quand Google le demande (lecture seule de Search Console), puis cochez `bitometre.com` et cliquez sur **Importer**.
5. Le sitemap déclaré chez Google est repris automatiquement. Vérifiez-le dans le menu **Sitemaps** : la ligne `https://bitometre.com/sitemap.xml` doit y figurer. Sinon, cliquez sur **Envoyer un sitemap** et collez cette adresse.

### Variante : vérification par DNS chez Cloudflare (si vous ne voulez pas lier Google et Bing)

1. Sur Bing Webmaster Tools, choisissez **Ajouter votre site manuellement**, tapez `https://bitometre.com`, puis **Ajouter**.
2. Choisissez la méthode **Enregistrement DNS** : Bing affiche un enregistrement de type `CNAME` avec un **nom** (une suite de lettres et de chiffres) et une **valeur** (`verify.bing.com`).
3. Dans Cloudflare, **DNS** › **Enregistrements** › **Ajouter un enregistrement** : Type `CNAME`, Nom = le nom donné par Bing, Cible = `verify.bing.com`, et surtout **désactivez le nuage orange** (« Proxy status » sur « DNS only », nuage gris). Enregistrez.
4. Revenez sur Bing et cliquez sur **Vérifier**. Puis menu **Sitemaps** › **Envoyer un sitemap** › `https://bitometre.com/sitemap.xml`.

## 6. Ouvrir le planificateur de mots-clés de Google

Le planificateur de mots-clés indique combien de fois par mois une expression est recherchée en France. Il est gratuit, mais il se trouve dans **Google Ads** : il faut un compte Google Ads, **sans créer de campagne ni dépenser quoi que ce soit**.

> Important : Google Ads pousse à créer une publicité dès l'ouverture du compte. Ne remplissez pas ce parcours : cherchez le lien « mode Expert » ou « Créer un compte sans campagne ». Si l'écran vous demande une carte bancaire pour lancer une campagne, c'est que vous êtes dans le parcours de campagne : revenez en arrière. Ouvrir un compte Google Ads est une décision qui vous appartient ; ce guide se contente de décrire le chemin.

1. Allez sur https://ads.google.com et cliquez sur **Commencer** (ou « Se connecter » si vous avez déjà un compte).
2. Connectez-vous avec votre compte Google.
3. À l'écran « Quel est votre principal objectif publicitaire ? », ne choisissez rien : cherchez en bas le lien **Passer en mode Expert** (« Switch to Expert Mode »).
4. À l'écran suivant, cliquez sur **Créer un compte sans campagne** (« Create an account without a campaign »).
5. Vérifiez le pays (France), le fuseau horaire (Paris) et la devise (euro), puis **Envoyer**. Ces trois réglages ne se modifient plus ensuite.
6. Cliquez sur **Explorer votre compte**.
7. En haut, cliquez sur l'icône **Outils** (une clé à molette), puis **Planification** › **Planificateur de mots clés**.
8. Choisissez **Obtenir le nombre de recherches et les prévisions**, collez une liste d'expressions (une par ligne), par exemple :
   ```
   taille moyenne pénis
   taille pénis normale
   calculateur taille pénis
   percentile pénis
   taille pénis 14 cm
   ```
9. Vérifiez sous la zone de saisie : **Langue** = français, **Zone** = France (vous pouvez ajouter Belgique, Suisse, Canada). Cliquez sur **Commencer**.
10. Ouvrez l'onglet **Historique des métriques** : la colonne « Recherches mensuelles moyennes » donne une fourchette (par exemple « 1 k – 10 k »). Les chiffres précis ne sont affichés qu'aux comptes qui dépensent en publicité : la fourchette suffit pour comparer des expressions entre elles.
11. Pour garder une trace : bouton **Télécharger les idées de mots clés** (en haut à droite), format CSV ou Google Sheets.

Sur certains sujets jugés sensibles, Google peut masquer ou limiter les données : si une expression n'affiche rien, ce n'est pas une erreur de votre part.

## Et ensuite ?

- **Après 3 à 7 jours** : Search Console, menu **Pages**, montre combien de pages sont indexées et pourquoi les autres ne le sont pas. Les pages d'analyse, de rapport et de paiement sont volontairement exclues (« Exclue par la balise noindex » ou « Bloquée par robots.txt ») : c'est normal.
- **Après 2 à 4 semaines** : menu **Performances**, pour voir les requêtes qui affichent le site, le nombre de clics et la position moyenne.
- Le sitemap, les balises canoniques et les données structurées sont produits par le site lui-même : aucune action de votre part n'est nécessaire quand de nouvelles pages sont ajoutées.
