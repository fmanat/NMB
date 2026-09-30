# Addendum « Bitomètre » (reçu à l'étape 1)

Complète [SPEC.md](SPEC.md). Nom de domaine et de marque : **Bitomètre** (bitometre.com). Le dépôt garde le nom de travail NMB.

## Retenu (intégré au projet)
- Marque : Bitomètre. Ton pseudo-scientifique, clinique, sérieux, zéro vulgarité.
- Design « Dark Tech / IA cybersécurité » : fond noir/anthracite, chiffres en monospace, texte en sans-serif géométrique, accents bleu électrique et jaune/orange radar, grilles de fond, jauges circulaires. Aucune image explicite.
- Bandeau de statistiques réelles (nombre d'analyses, score moyen, meilleur score de la semaine) calculées depuis la base, jamais inventées ni arrondies à la hausse. Masqué tant que le total est sous un seuil en configuration.
- Badges de réassurance, uniquement des affirmations vraies : « Connexion chiffrée », « Photo supprimée après analyse », « Aucun compte ».
- Fenêtre d'âge au clic sur le bouton de scan : année de naissance (YYYY) stockée localement + case 18+.
- Écran d'analyse : uniquement les étapes réellement exécutées (« Contrôle de recevabilité », « Calibration sur la carte de référence », « Extraction de la ligne médiane », « Calcul des percentiles »).
- Paiement unique, aucun prix barré, Apple Pay / Google Pay en priorité (dépend du prestataire de paiement choisi).
- Formule de score : `Score = 40 + 58 × P^0.85`, plancher 40, plafond 98, paramètres en configuration. Les percentiles exacts sont affichés tels quels ; le score n'est jamais présenté comme un percentile. La page « Précision et méthode » décrit cette formule publiquement.
- Filtrage de contenus illicites par API tierce en pré-traitement (étape 3).
- Partage : URL publique `/c/identifiant` avec image OG générée ; le rapport privé garde une image OG neutre sans score (étape 4).
- Webhook quotidien d'agrégats anonymes vers une URL configurable (étape 6).

## Écarté ou à trancher (décisions notées avec l'utilisateur)
- **« Cloaking bancaire » (libellés et code faisant passer l'application pour des « statistiques biométriques »)** : non implémenté. Tromper le prestataire de paiement sur la nature du service viole ses conditions et expose le compte au gel des fonds. Le code et les libellés restent fidèles au service réel.
- **Vérification d'âge** : le cahier SPEC.md (sections 4 et 7) exige un prestataire tiers avant tout envoi de photo. La saisie de l'année de naissance est ajoutée comme première barrière mais ne remplace pas ce contrôle. À confirmer.
- **« Modélisation 3D filaire ou holographique »** : interprétée comme décor abstrait (grilles, jauges). Aucune représentation du corps, conformément à SPEC.md section 14.
