# Test de faisabilité de l'API xAI (étape 3)

But : savoir si xAI accepte d'analyser votre photo. Si xAI refuse, on s'arrête et on décide de la suite.

## 1. Ouvrir le compte xAI et créer la clé (une seule fois)

1. Allez sur https://console.x.ai et créez un compte (ou connectez-vous).
2. Ajoutez du crédit dans la section facturation (Billing). Quelques dollars suffisent : un essai coûte environ 2 centimes.
3. Ouvrez **API Keys**, cliquez sur **Create API key**, puis copiez la clé (elle commence souvent par `xai-`). Elle ne s'affiche qu'une fois.
4. Ouvrez le fichier `.env` du projet (à la racine de `D:\cLAUDE\NMB`). Collez la clé juste après `XAI_API_KEY=`, sans espace ni guillemets. Enregistrez.
5. Ne collez jamais cette clé dans une conversation, un e-mail ou un fichier versionné. Le fichier `.env` n'est jamais envoyé sur GitHub.

## 2. Premier essai avec une image neutre (aucune photo personnelle)

Dans un terminal, dans le dossier du projet :

```bash
npm run xai:test -- --selftest
```

Le script fabrique lui-même une image neutre (un objet cylindrique posé à côté d'une carte). Il vérifie votre clé et le fonctionnement. Il doit finir par un verdict. Un « REFUSÉ » ou « PARTIEL » ici est normal : l'image n'est pas une vraie photo. Ce qui compte à ce stade, c'est de ne PAS voir « CLÉ INVALIDE ».

## 3. Essai avec votre photo

1. Copiez votre photo dans le dossier `photos-test/` (il est ignoré par git : elle ne peut pas être publiée par erreur).
   - Une carte au format bancaire posée à côté, côté verso visible (numéros masqués).
   - Bien éclairée, aucun visage ni élément identifiant.
2. Lancez :

```bash
npm run xai:test
```

Le script réencode la photo (JPEG, 1 600 px maximum, toutes les métadonnées supprimées, y compris la position GPS), l'envoie à xAI, puis affiche un verdict :

| Verdict | Signification |
|---|---|
| FAISABLE | xAI a accepté l'image et répondu de façon exploitable. |
| PARTIEL | xAI accepte l'image, mais les réponses sont à fiabiliser. |
| REFUSÉ PAR xAI | xAI refuse. On s'arrête et on décide de la suite. |
| CLÉ INVALIDE | Problème de clé, pas de refus. Vérifiez le `.env`. |

3. Copiez-moi le texte affiché par le script (il ne contient jamais la photo ni la clé).
4. Supprimez ensuite votre photo de `photos-test/`.

## 4. À savoir avant la mise en ligne

- Par défaut, xAI conserve les requêtes (images comprises) 30 jours pour détecter les abus, sans les utiliser pour l'entraînement. Une option « Zero Data Retention » supprime cette conservation. Pour que l'affirmation « Photo supprimée après analyse » reste vraie, il faudra l'activer dans la console xAI (réglage de l'équipe) avant le lancement. Vérifiez qu'elle est disponible sur votre compte.
- Pendant ce test, votre photo est donc conservée 30 jours par xAI, comme tout appel API, sauf si cette option est active sur votre compte.
