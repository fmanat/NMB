# Demande à AgeVerif : vérification d'âge pour les formules photo (envoyée en parallèle à Yoti)

**Nécessaire pour le passage au payant de la formule A : NON.** La formule A ne reçoit aucune photo et n'utilise pas de prestataire d'âge (case « J'ai 18 ans ou plus » seulement). Nécessaire **avant l'ouverture des formules B et C**.

**Décision du propriétaire** : demandes envoyées **en parallèle à AgeVerif et à Yoti**, décision sur **réponses écrites** ; **critère principal : l'indépendance vis-à-vis des exploitants de sites pour adultes**. (Un prestataire d'âge détenu ou dirigé par un exploitant de sites pour adultes aurait un intérêt commercial à connaître les sites qui l'utilisent et à orienter leurs utilisateurs.)

## Canal d'envoi

- Formulaire de contact : <https://www.ageverif.com/contact>
- Pour votre information : la plateforme webmasters (création de compte et clés d'essai) est <https://webmasters.ageverif.com/sign-up> ; documentation : <https://docs.ageverif.com> (OAuth2 : <https://docs.ageverif.com/oauth2.html>) ; conditions : <https://www.ageverif.com/webmaster-terms-of-use>. **Ne créez pas de compte avant d'avoir les réponses écrites** (règle du projet : demander avant d'ouvrir un compte).
- **Vous** envoyez. Texte en **français**.

## Objet

`Demande d'information avant inscription – site francophone réservé aux adultes (société britannique) – vérification d'âge avant envoi d'une photo`

## Message prêt à copier (français)

> Bonjour,
>
> Je vous écris pour le compte de [À COMPLÉTER : raison sociale de la Ltd], société de droit anglais (« private limited company », immatriculée sous le numéro [À COMPLÉTER : numéro Companies House], siège : [À COMPLÉTER : adresse du siège]). Avant toute inscription, nous aimerions obtenir vos réponses **écrites** aux questions ci-dessous.
>
> **Notre service.** Bitomètre (bitometre.com) est un site **en français, réservé aux adultes**, qui fournit une analyse statistique chiffrée de mesures corporelles (longueur, circonférence, courbure, symétrie), comparée à une étude scientifique publiée (Veale et al., BJU International, 2015). Il n'affiche, ne publie ni ne stocke aucun contenu sexuel explicite. Une première offre (questionnaire déclaratif, sans photo) est ouverte en bêta gratuite : elle n'utilise pas de vérification d'âge par prestataire. **Deux offres suivantes, pas encore ouvertes**, demandent à l'utilisateur d'envoyer la **photographie de sa propre anatomie intime**, posée à côté d'une carte bancaire pour l'échelle. La photo est analysée en mémoire par un modèle d'IA, n'est jamais enregistrée par notre site, et un filtrage par empreinte des images déjà répertoriées comme illicites est prévu avant l'analyse. Aucune image n'est affichée à d'autres utilisateurs.
>
> **Ce que nous voulons faire avec vous.** Obtenir un jeton « majeur : oui » **avant tout envoi de photo**, sans recevoir aucune donnée d'identité, par votre flux OAuth2 avec échange du code de serveur à serveur. Marchés : France, Belgique, Suisse, Luxembourg, Québec. Volume initial : faible (quelques dizaines à quelques centaines de vérifications par mois).
>
> **Nos questions :**
> 1. **Indépendance** : AgeVerif ou sa société mère ont-elles, directement ou indirectement, un lien de capital, de direction, de financement ou de contrat commercial avec un exploitant de sites pour adultes (éditeur, réseau d'affiliation, plateforme vidéo) ? Pouvez-vous le confirmer par écrit et nommer les actionnaires et dirigeants ?
> 2. **Ce que vous savez de notre site** : pour chaque méthode proposée en France (selfie, e-mail, carte bancaire, autres), AgeVerif connaît-il l'adresse de notre site ou le nom de la page consultée ? Les utilisateurs sont-ils reconnaissables d'un site à l'autre ? Que conservez-vous, combien de temps, où ?
> 3. **Audit** : existe-t-il un rapport d'audit indépendant publié sur votre solution (auditeur, date, périmètre) ? Quelle formulation pouvons-nous employer sur notre site pour décrire votre service sans rien affirmer d'inexact (nous n'écrirons ni « certifié Arcom » ni « anonyme » sans preuve) ?
> 4. **Conformité** : votre solution est-elle conforme au référentiel technique de l'Arcom sur la vérification de l'âge ? Sur quelle base (auto-déclaration, audit) ? Et vis-à-vis du RGPD : rôle (sous-traitant ou responsable), accord de traitement fourni, hébergement, sous-traitants, transferts hors UE, notification de violation.
> 5. **Société britannique** : acceptez-vous une société britannique sans établissement en France, pour un site de ce type, hors contenu explicite ? Conditions écrites et justificatifs demandés.
> 6. **Technique** : mode test, durée de validité et usage unique du jeton, algorithme et vérification de la signature de l'état (`state`), rotation des secrets, comportement en cas d'échec ou d'abandon, gestion des contournements connus (jeton copié, deepfake, photo d'un tiers).
> 7. **Tarif** : coût exact par vérification et par méthode, minimum mensuel, facturation en euros, conditions de résiliation.
> 8. **Responsabilité** : plafond de responsabilité, garanties sur le taux d'erreur, engagements de disponibilité.
>
> Nous sommes prêts à vous transmettre une description détaillée, des captures d'écran de chaque page et nos conditions d'utilisation une fois relues par un juriste.
>
> Cordialement,
>
> [À COMPLÉTER : nom du signataire]
> Directeur, [À COMPLÉTER : raison sociale de la Ltd]
> [À COMPLÉTER : adresse e-mail de contact]

## Informations à joindre

Rien au premier message (pas de pièce jointe). À prévoir sur demande : certificat d'immatriculation, identité du dirigeant, adresse du site de test protégé (identifiants sur demande seulement).

## Questions appelant une réponse écrite

Les huit questions du message. **Décisives** : la 1 (indépendance : critère principal du propriétaire), la 2 (architecture : connaît-il mon site ?), la 3 (audit et formulation), la 5 (société britannique). Voir aussi `docs/PRESTATAIRES.md`, section « Vérification d'âge » : le texte du site ne doit jamais prêter à ce prestataire plus de garanties qu'il n'en donne par écrit.
