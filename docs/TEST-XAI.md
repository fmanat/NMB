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

## 5. Résultats des essais (30/09/2026)

Modèle `grok-4.7`, endpoint `/v1/chat/completions`, sortie JSON stricte acceptée avec des images.

**Photo réelle de l'utilisateur (une seule passe)** : xAI ne refuse pas l'image et répond. La recevabilité a répondu « carte absente ou illisible » et le repérage n'a renvoyé aucun coin de carte : aucune mesure n'a pu être calculée, donc aucune comparaison avec les mesures réelles n'est possible. Cause à établir : carte absente de la photo ou carte non reconnue. La photo a été supprimée du dossier ; rien n'a jamais été versionné.

**Durées** (une mesure par configuration, à confirmer ; image neutre pour les variantes) :

| Configuration | Appels avec photo | Avec rédaction |
|---|---|---|
| Défaut, deux appels séparés, photo réelle | 77 s (16 + 61) | 101 s |
| Raisonnement réduit (`--effort low`), deux appels | 26 s | 33 s |
| Raisonnement réduit + appels fusionnés (`--merge`) | 21 s | 29 s |
| Image 1 024 px au lieu de 1 600 | 71 s | 84 s |

Conclusions : le raisonnement du modèle est la cause principale de la lenteur ; réduire la taille de l'image n'aide pas ; la rédaction du commentaire peut se faire après l'affichage de l'aperçu. Coût réel : entre 1,4 et 2,2 centimes de dollar par analyse complète.

Options du script : `--effort low`, `--merge`, `--size 1024`, `--model NOM`, `--length`, `--girth`, `--state`.

## 6. Essai avec règle graduée (30/09/2026)

Premier essai avec mesure : photo réelle de l'utilisateur à côté d'une règle (mode `--ruler` : le modèle lit deux graduations et en déduit l'échelle, sans correction de perspective). `grok-4.7`, raisonnement réduit, appels fusionnés. Une seule photo, donc aucune conclusion statistique.

| Mesure | Estimée | Réelle déclarée | Écart | Marge ± 10 % |
|---|---|---|---|---|
| Longueur | 10,8 cm | 10,16 cm (4 pouces) | +0,6 cm (+6 %) | dans la marge |
| Circonférence (largeur max × π) | 11,0 cm | 12 cm | −1,0 cm (−9 %) | dans la marge |
| Circonférence (largeur moyenne × π) | 10,4 cm | 12 cm | −1,6 cm (−14 %) | hors marge |

Confiance moyenne des points : 0,76. Durée de l'appel avec photo : 48 s (21 s lors d'un essai précédent sans carte reconnue, donc sans points à placer) ; rédaction 19 s. L'objectif de 30 s n'est pas tenu de façon fiable avec `grok-4.7`.

À noter : l'utilisateur avait annoncé 15 cm de longueur en érection lors d'un essai précédent, contre 4 pouces ici ; la valeur de comparaison utilisée est celle de cet essai (4 pouces).

**Modèles plus rapides, testés sur l'image neutre (objet d'environ 9,9 cm)** :

| Modèle | Durée avec photo | Longueur estimée |
|---|---|---|
| `grok-4.7` raisonnement réduit | 21 à 25 s | 9,9 cm |
| `grok-4.3` raisonnement réduit | 14 s | 19,5 cm (erreur de 97 %) |
| `grok-4.3` défaut | 12 s | 10,8 cm (+9 %) |

`grok-4.3` est plus rapide et moins cher (1,25 / 2,50 $ par million de jetons) mais, sur un échantillon minuscule, il se trompe beaucoup plus : à ne pas retenir sans test de précision sur un lot de photos.

**Pour valider les marges affichées** : il faudra au moins 15 à 20 photos de référence variées (éclairage, angle, sujets différents) avec mesures réelles connues, dont des photos neutres (objet de taille connue à côté d'une carte) pour ne pas multiplier les envois de photos intimes. La carte bancaire reste la référence prévue (elle permet la correction de perspective) ; la règle est un repli.
