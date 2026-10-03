# Kit de relations presse

Ce dossier contient tout ce qu'il faut pour proposer Bitomètre à des journalistes et à des sites. Rien n'est envoyé automatiquement : vous choisissez à qui écrire et vous envoyez vous-même.

| Fichier | Contenu |
|---|---|
| [ANGLES.md](ANGLES.md) | Trois angles d'article, chacun avec ses chiffres et ses sources |
| [COMMUNIQUE.md](COMMUNIQUE.md) | Un communiqué court, prêt à coller dans un e-mail |
| [CIBLES.md](CIBLES.md) | Les types de médias et de sites à contacter, et ce qui les intéresse |
| [MODELES.md](MODELES.md) | Un modèle de message par type de cible, prêt à copier |

## La page presse du site

Les graphiques téléchargeables (PNG) et la mention de source à reprendre sont sur **https://bitometre.com/presse**. C'est le lien à donner dans chaque message : le journaliste y trouve les images, les chiffres et la façon de citer.

## Règle sur les chiffres

Tous les chiffres de ce dossier viennent de deux sources, et de deux seulement :

1. **Veale et al., « Am I normal? A systematic review and construction of nomograms for flaccid and erect penis length and circumference in up to 15,521 men », BJU International, 2015** (PubMed : https://pubmed.ncbi.nlm.nih.gov/25487360/) : moyennes, écarts-types, effectifs, critères de sélection.
2. **Les calculs du site** (loi normale construite sur ces moyennes et écarts-types, mêmes fonctions que le rapport) : percentiles, proportions, valeurs aux percentiles. Pour les recalculer après une mise à jour : `npm run presse:chiffres`.

Les chiffres ont été calculés le 03/10/2026. N'en ajoutez pas d'autres sans source vérifiée : un journaliste qui trouve une erreur ne reviendra pas.

## Avant d'envoyer

- Le site doit être ouvert au public (sans mot de passe), sinon le lien ne fonctionne pas pour le destinataire.
- Écrivez depuis une adresse au nom du site (par exemple contact@bitometre.com), jamais depuis une adresse personnelle.
- Un message par personne, personnalisé avec son nom et un article récent qu'elle a écrit : les envois groupés finissent en indésirables.
- Relancez une seule fois, une semaine plus tard. Pas de troisième message.
