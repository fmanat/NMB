# Tester la formule photo avec VOTRE photo (5 minutes, sur votre Mac)

But : lancer l'analyse photo complète du site, **en local sur votre Mac** (pas sur bitometre.com), avec votre propre photo, voir le résultat en texte, puis **supprimer la photo**. Ce document est écrit pour être suivi pas à pas, sans connaissance technique.

Ce qui se passe, en clair :
- Votre photo reste dans le dossier `photos-test/` du projet. Ce dossier est **ignoré par git** : elle ne peut pas être envoyée sur GitHub par erreur.
- Le script lit la photo en mémoire, la **réencode** (JPEG, 1 600 px au plus, toutes les métadonnées supprimées, position GPS comprise) et l'envoie **à l'API xAI** (États-Unis), qui la conserve **30 jours** sauf option « Zero Data Retention » activée sur votre compte (voir `docs/TEST-XAI.md`, section 4). C'est le seul endroit où elle part.
- Le script n'écrit **rien en base de données** (aucune base n'est nécessaire pour ce test) et ne crée aucune page de rapport : il affiche tout **en texte** dans le terminal. Il n'affiche jamais l'image, jamais son nom, jamais d'octets.
- Le script s'occupe d'effacer la photo si vous le lui demandez (option `--supprimer`).
- Claude (l'assistant) n'ouvre jamais votre photo : il ne lit que le texte que vous lui renvoyez.

## 0. Avant de commencer (à cocher une fois)

- [ ] **La clé xAI est dans `.env`** (ligne `XAI_API_KEY=`). Si ce n'est pas fait : `docs/TEST-XAI.md`, section 1. Le script lit la clé lui-même et ne l'affiche jamais.
- [ ] Les réglages utiles de `.env` (facultatifs) : `XAI_DAILY_CAP_USD` (plafond du jour en dollars, **5 si vide**), `XAI_PRICE_IN_PER_M` et `XAI_PRICE_OUT_PER_M` (tarif, 2 et 6 par défaut : à vérifier sur votre console xAI pour que le coût affiché soit juste).
- [ ] **Question de sécurité (QCM)** : le dossier du projet est dans `Documents`. Sur Mac, **iCloud Drive** peut copier tout le dossier Documents dans le nuage. Vérifiez : Réglages Système → votre nom en haut → iCloud → iCloud Drive → « Synchroniser ce Mac » → « Dossiers Bureau et Documents ».
  - **A. Désactivé** : rien à faire (recommandé).
  - **B. Activé** : votre photo pourrait être copiée sur les serveurs d'Apple, ce que ce test cherche à éviter. Deux choix : désactiver cette option le temps du test, ou déplacer le projet hors de `Documents` (par exemple dans `~/Projets/BR`). Ne lancez pas le test avant d'avoir choisi.
  - **C. Je ne sais pas** : choisissez B par prudence et regardez le réglage.
- [ ] Une sauvegarde **Time Machine** ou un autre outil de sauvegarde peut conserver une copie de la photo tant qu'elle est dans le dossier. Le script ne peut pas l'effacer des sauvegardes : à vous de décider (voir section 5).

## 1. Avant la photo : vos mesures à la règle

Faites ces mesures **juste avant** la photo, dans **le même état** (au repos ou en érection : celui que vous annoncerez au script), et **notez-les sur papier avant de lancer quoi que ce soit** (pour ne pas être influencé par le résultat).

| Mesure | Comment | Ce que fait le site |
|---|---|---|
| **Longueur** (cm) | Règle rigide, **sur le dessus, de la base à l'extrémité** (définition du questionnaire du site). Posez la règle **sans appuyer** : démarrez là où la peau commence, comme le fait la photo, qui ne voit que la partie visible. | La photo donne la longueur le long de la ligne médiane visible. |
| **Circonférence** (cm) | Mètre ruban souple (ou ficelle puis règle), **au milieu, tour complet**, sans serrer (définition du questionnaire). | La photo donne π × la **largeur maximale** vue sur l'image (hypothèse de section circulaire, c'est une estimation). |

Règles de méthode (reprises de `docs/CALIBRATION.md`) :
1. **Mesurez deux fois, gardez la moyenne**, avec une décimale. Votre propre mesure a une incertitude d'environ ± 3 à 5 mm : un écart de cet ordre entre la règle et la photo ne prouve rien.
2. **Notez la méthode** employée (point de départ de la longueur, endroit de la circonférence). La page du site sur la mesure (`/comment-mesurer-son-penis`) rappelle que la mesure n'est pas standardisée : un point de départ différent change la valeur. **La comparaison n'a de sens que si votre règle suit ce que la photo voit.** (Question ouverte consignée dans `docs/DECISIONS.md` : le site ne dit pas encore si ses percentiles supposent une mesure « peau-extrémité » ou « os-extrémité ».)
3. Si le point le plus épais n'est pas le milieu, notez aussi la circonférence à cet endroit : le script ne compare qu'**une** valeur de circonférence (celle que vous tapez), choisissez-la en connaissance de cause.
4. Ne « tirez » pas, ne cherchez pas la valeur la plus flatteuse : une méthode constante vaut mieux qu'une mesure parfaite.

## 2. Faire la photo

Conseils du site, sur la page d'envoi, plus les seuils réellement appliqués par le code (une photo qui ne les respecte pas est **refusée**) :

- **Une carte au format bancaire** (85,6 × 54 mm) posée **à côté**, **à plat**, **entière, avec ses 4 coins visibles**. Choisissez de préférence une carte de fidélité ou un ancien badge, sans numéro sensible ; si c'est une carte bancaire, côté verso et numéros masqués, comme le demande le site.
- **Carte et sujet sur la même surface plane** (table, plan de travail), à côté l'un de l'autre. Le calcul suppose un sujet **posé** sur la surface, pas tenu en l'air, et une carte non pliée.
- **Vue de dessus de préférence** (appareil à la verticale : inclinaison 0°). Au-delà de **50°** d'inclinaison, la photo est refusée.
- **La carte doit occuper au moins 15 % du grand côté de l'image** : approchez-vous ; **sans zoom** et avec l'**objectif principal** de l'appareil (pas de grand-angle, pas de mode portrait).
- Bonne lumière, image **nette**, **pas de reflet** sur la carte.
- **Aucun visage, ni élément identifiant** (tatouage reconnaissable, bijou, pièce reconnaissable, papier avec une adresse) dans l'image.
- **Format** : JPEG ou PNG, **8 Mo au plus** (le script ne réduit pas la photo avant de la lire ; au-delà, réduisez-la avec la commande `sips -Z 3000` de la section 3). Une photo d'iPhone au format HEIC doit d'abord être convertie : voir la commande `sips` de la section 3.

## 3. Les commandes, pas à pas

Ouvrez l'application **Terminal** (touches Cmd + Espace, tapez « Terminal », Entrée). Copiez-collez chaque ligne, puis Entrée.

**3.1 Aller dans le dossier du projet**

```bash
cd ~/Documents/Claude/BR
```

(Si vous avez déplacé le projet, adaptez le chemin.)

**3.2 Créer le dossier de test et y copier la photo**

```bash
mkdir -p photos-test
cp ~/Downloads/NOM-DE-VOTRE-PHOTO.jpg photos-test/ma-photo.jpg
```

Remplacez `NOM-DE-VOTRE-PHOTO.jpg` par le vrai nom (dans le Terminal, vous pouvez glisser le fichier depuis le Finder après `cp ` pour écrire son chemin). **Copiez** la photo, ne la déplacez pas encore : vous supprimerez ensuite l'original vous-même (section 5).

Photo d'iPhone au format HEIC : convertissez-la en JPEG directement dans le dossier de test.

```bash
sips -s format jpeg ~/Downloads/NOM-DE-VOTRE-PHOTO.HEIC --out photos-test/ma-photo.jpg
```

Photo de plus de 8 Mo : réduisez la copie (le plus grand côté passe à 3 000 px ; l'original n'est pas modifié).

```bash
sips -Z 3000 photos-test/ma-photo.jpg
```

**3.3 Essai à blanc (gratuit, recommandé : 10 secondes)**

```bash
npm run photo:test -- --simulation --etat erection
```

L'API et la photo sont simulées (aucune photo n'est lue, aucun coût). Vous voyez à quoi ressemble le résultat. Les valeurs affichées dans ce mode sont fixes (un objet simulé de 13 cm) : elles ne veulent rien dire.

**3.4 Le vrai test, avec votre photo**

Remplacez les nombres par **vos** mesures à la règle (virgule ou point) et l'état par `erection` ou `repos` :

```bash
npm run photo:test -- photos-test/ma-photo.jpg --etat erection --longueur 14,2 --circonference 12,1 --supprimer
```

- `--etat` est obligatoire : les percentiles dépendent de l'état.
- `--longueur` et `--circonference` sont facultatifs : sans eux, pas de comparaison avec la règle.
- `--supprimer` efface la photo (écrasement puis suppression) **dès que l'analyse a été tentée, même si elle est refusée**. Si vous voulez pouvoir relancer sur la même photo, retirez `--supprimer` et supprimez à la main ensuite (3.5). Chaque lancement envoie la photo à xAI : un seul envoi suffit en général.
- Le script **refuse de démarrer** si la photo n'est pas dans `photos-test/`, si ce dossier n'est pas ignoré par git, si la clé est vide, ou si le **plafond du jour** serait dépassé (dépensé aujourd'hui + 0,03 $ estimés pour cette analyse > `XAI_DAILY_CAP_USD`). Dans tous ces cas, aucun appel n'est envoyé et la photo n'est ni envoyée ni supprimée.
- Comptez environ une minute d'attente (mesures précédentes : de 40 à 70 secondes ; la durée de bout en bout est à confirmer, voir la section 4).

**3.5 Supprimer la photo (si vous n'avez pas mis `--supprimer`)**

```bash
npm run photo:supprimer -- photos-test/ma-photo.jpg
```

Ou tout le dossier :

```bash
npm run photo:supprimer -- --tout
```

Le script affiche « photos-test/ est vide. Il ne reste aucune photo. » quand c'est fait.

## 4. Lire le résultat

Le résultat s'affiche en texte, en cinq blocs.

**a) Mesures calculées par le code.** Longueur et circonférence **estimées** (le modèle ne mesure rien : il place des points, le calcul est fait par notre code), la **marge** affichée (± 10 % au minimum : c'est le plancher du site), les **percentiles** (comparaison avec l'étude de référence Veale et al., 2015), la courbure, la symétrie, la **confiance du repérage** (sur 100), le score et le **profil morphologique**.

**b) Écart avec vos mesures à la règle.** Pour chaque mesure : valeur estimée, valeur à la règle, **écart en cm et en %** (estimé − règle, en % de la règle), et « dans la marge affichée : oui / NON ».

| Si… | Alors… |
|---|---|
| L'écart est **dans la marge affichée** | C'est le comportement attendu (la marge est justement faite pour cela). Ce n'est **pas** une preuve de précision avec un seul essai. |
| L'écart est **hors de la marge** (« NON ») | Signal à noter : la marge annoncée serait trop optimiste pour cette photo. Relevez aussi la confiance, la taille de la carte et l'inclinaison. **Ne tirez aucune conclusion d'un seul essai.** |
| Un **grand** écart avec une **faible confiance** | Probablement un problème de prise de vue (flou, carte mal visible, pose). Refaire la photo en suivant la section 2. |
| Une circonférence plus petite ou plus grande que la règle, longueur correcte | Pensez à la différence « milieu » (règle) contre « largeur maximale » (photo), section 1. |

**Quel écart est « normal » ? Le site n'a pas de seuil établi** et ce document n'en invente pas. Ce qui existe : la marge affichée (± 10 % minimum) ; en **simulation** (repérage parfait), l'erreur maximale est de 6,1 % et le repérage bruité reste dans la marge dans 94 % des cas (`docs/CALIBRATION.md`) ; un premier essai réel avec règle, le 30/09/2026, a donné +6 % (longueur) et −9 % (circonférence), sur une seule photo (`docs/TEST-XAI.md`, section 6). **L'écart de référence reste à établir avec plusieurs essais** (objectif de `docs/CALIBRATION.md` : au moins 15 photos, dont des objets neutres ; la règle de décision du site est « 90 % ou plus dans la marge »). Chacun de vos essais est un point de plus.

**c) Rapport standardisé.** **Trois observations** (qualité du repérage, cadrage, cohérence des estimations) et **un verdict d'une phrase**, rédigés par le modèle **sans aucun chiffre** (les chiffres viennent du code). Si le modèle répond d'une façon non conforme, le script **relance une seule fois** puis, si c'est encore invalide, affiche un refus (motif `commentaire_invalide`) : c'est le même comportement que le site.

**d) Refus ou erreur.** Un refus affiche son **motif technique** parmi : `carte_absente_ou_illisible`, `visage_visible`, `plusieurs_personnes`, `sujet_non_conforme`, `image_non_originale`, `doute_majorite`, `inclinaison_trop_forte`, `carte_trop_petite`, `confiance_faible`, `mesure_invraisemblable`, `calcul_impossible`, `recevabilite_invalide`, `reperage_incomplet`, `commentaire_invalide`. (Le site, lui, n'affiche aux visiteurs qu'un message neutre.) Le 30/09/2026, la photo du premier essai avait été refusée pour `carte_absente_ou_illisible`.

**e) Appels, durée, coût.** Nombre d'appels à l'API (3 normalement : recevabilité et repérage en parallèle, puis rédaction ; **une relance de plus par réponse invalide**), détail par appel (durée, jetons, coût), durée par étape, jetons totaux, **coût en dollars** (jetons × `XAI_PRICE_IN_PER_M` / `XAI_PRICE_OUT_PER_M`) et **cumul du jour** par rapport au plafond `XAI_DAILY_CAP_USD`. Repères mesurés (non garantis) : environ 0,02 $ par analyse complète ; appel avec photo de 21 à 48 s, rédaction d'environ 19 s (`docs/TEST-XAI.md`, `docs/SESSION-NUIT-4.md`). **La durée de bout en bout avec le vrai moteur n'a pas encore été mesurée** : votre essai la donnera.

## 5. Supprimer la photo à la fin et vérifier qu'il ne reste rien

Si vous avez utilisé `--supprimer` (ou la commande de suppression), le fichier de `photos-test/` est écrasé puis effacé. Il reste à vérifier et à nettoyer **autour** :

```bash
npm run photo:supprimer -- --verifier
ls -la photos-test
git status --short
```

- La première commande doit dire « photos-test/ est vide ». La deuxième ne doit rien lister de plus que `.` et `..`. La troisième ne doit **mentionner aucune photo** (le dossier est ignoré par git).
- **Original** : supprimez votre photo d'origine (`~/Downloads/...`, application Photos, AirDrop reçu) **vous-même**, puis **videz la Corbeille**. Le script ne touche qu'à `photos-test/`.
- **Sauvegardes** : Time Machine, iCloud Drive (voir la section 0) ou un autre outil ont pu garder une copie. Sachez-le ; le script ne peut pas l'effacer. Précision honnête : l'écrasement avant suppression ne garantit pas l'effacement physique sur un disque SSD ou un système de fichiers moderne ; la protection fiable, c'est le disque chiffré (FileVault) et l'absence de copies.
- **Côté xAI** : la requête (image comprise) est conservée **30 jours** chez le prestataire, sauf option « Zero Data Retention » (`docs/TEST-XAI.md`, section 4). Aucune suppression à la demande n'est faite par ce script.
- Le fichier `.photo-test-depenses.json` (à la racine du projet) ne contient que des dollars par jour : pas de photo. Vous pouvez le supprimer pour remettre le cumul à zéro (ce qui relâche votre propre garde-fou : à ne faire que si vous savez ce que vous avez dépensé).

## 6. Ce que vous me renvoyez (uniquement du texte)

Copiez **tout le texte affiché par le script** (il ne contient ni la photo, ni son nom, ni votre clé) et collez-le dans la conversation. Il contient vos mesures à la règle et les mesures estimées : c'est vous qui décidez de me le transmettre. Ne m'envoyez jamais la photo.

Puis répondez aux questions (une lettre chacune) :

1. Le test s'est-il déroulé… **A.** jusqu'au bout avec un résultat · **B.** refus de la photo (motif affiché) · **C.** erreur ou message du script · **D.** il n'a pas démarré.
2. L'attente vous a semblé… **A.** acceptable (moins d'une minute et demie) · **B.** longue · **C.** trop longue pour un visiteur.
3. Les trois observations et le verdict étaient… **A.** cohérents avec votre photo · **B.** trop génériques · **C.** hors sujet ou déplacés · **D.** je n'ai pas eu de rapport.
4. Voulez-vous refaire un essai… **A.** avec un objet neutre (plus de points de calibration sans nouvelle photo intime) · **B.** avec la même prise de vue, autre éclairage · **C.** non, pas pour l'instant.
5. Pour la longueur à la règle, vous avez mesuré… **A.** de la base visible à l'extrémité, sans appuyer · **B.** en appuyant au fond (méthode « os-extrémité ») · **C.** les deux (notez les deux valeurs).

Cases à cocher, à me confirmer :

- [ ] J'ai supprimé la photo de `photos-test/` (la commande a affiché « Il ne reste aucune photo »).
- [ ] J'ai supprimé l'original (Téléchargements, Photos, AirDrop) et vidé la Corbeille.
- [ ] J'ai vérifié que `git status --short` ne mentionne aucune photo.
- [ ] J'ai vérifié le réglage iCloud Drive (section 0) et je sais s'il y a eu une copie dans le nuage.
- [ ] Je n'ai collé aucune photo ni aucune clé dans la conversation.

## Pour mémoire : fonctionnement technique

- Commandes : `npm run photo:test` (`scripts/photo-test.mts`) et `npm run photo:supprimer` (`scripts/photo-supprimer.mts`), logique dans `scripts/lib/photoTest.ts`, testée par `tests/photo-test.test.ts` (API simulée, image neutre fabriquée, sans réseau).
- La chaîne est **exactement** celle du site (`runAnalysis` de `src/lib/analyseFlow.ts`) : réencodage, filtrage (aucun : comme le site sans prestataire), recevabilité et repérage validés (une relance), calculs, rédaction validée (une relance), profil. Seules différences : les écritures en base sont remplacées par un magasin en mémoire (option « sans base », la seule disponible), le captcha et la vérification d'âge sont sans objet (test local du propriétaire), et la porte de dépense lit un petit fichier local au lieu de la base.
- Mode simulation : `createSimulatedVision` (objet de 13 cm, scénario « ok »). Le mode réel utilise `xaiVision` et la clé de `.env`.
