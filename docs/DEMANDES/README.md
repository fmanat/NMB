# Demandes à envoyer (préparées pendant la nuit, **aucune n'a été envoyée**)

Règle du projet : **je prépare, vous envoyez.** Aucun compte n'a été ouvert, aucun message n'a été envoyé. Chaque fichier contient : si la demande est nécessaire au passage au payant de la formule A, le canal d'envoi (avec lien), l'objet, le message prêt à copier, les informations à joindre et les questions qui appellent une **réponse écrite**.

## Avant d'envoyer quoi que ce soit

1. **Complétez les informations de la Ltd** (raison sociale, numéro Companies House, siège, nom du signataire) : chaque message contient des `[À COMPLÉTER : …]` à remplacer. Ne rien envoyer avec un marqueur restant.
2. Relisez le message : il décrit le service **honnêtement et complètement**, y compris ce qui est sensible (valeurs et photos d'une partie intime du corps de l'utilisateur lui-même). Ne l'adoucissez pas : une description incomplète obtient une réponse sans valeur et peut justifier une résiliation ensuite.
3. Gardez **chaque réponse écrite** (courriel complet avec en-têtes) dans un dossier, elles serviront au juriste.

## Tableau récapitulatif

| Destinataire | Fichier | Langue | Nécessaire pour le payant de la formule A ? | Rôle |
|---|---|---|---|---|
| Verotel | [verotel.md](verotel.md) | anglais | **OUI** | Paiement (premier choix) |
| CCBill | [ccbill.md](ccbill.md) | anglais | **OUI (repli de Verotel)** | Paiement (repli) |
| Segpay | [segpay.md](segpay.md) | anglais | **OUI (repli, 3e choix)** | Paiement (repli) |
| Railway | [railway.md](railway.md) | anglais | Non (recommandé avant les formules photo) | Hébergeur : confirmation écrite que le service est accepté |
| AgeVerif | [ageverif.md](ageverif.md) | **français** | Non (formules photo seulement) | Vérification d'âge (en parallèle de Yoti) |
| Yoti | [yoti.md](yoti.md) | anglais | Non (formules photo seulement) | Vérification d'âge (en parallèle d'AgeVerif) |
| Microsoft (PhotoDNA) | [microsoft-photodna.md](microsoft-photodna.md) | anglais | Non (formules photo seulement) | Filtrage d'empreintes : éligibilité |
| xAI | [xai.md](xai.md) | anglais | Non (la formule A n'envoie rien à xAI) | Non-conservation des données (Zero Data Retention), accord de traitement |

**Ordre conseillé** : Verotel d'abord (délai le plus long et risque de refus : voir `docs/PRESTATAIRES.md`), en même temps Railway ; puis, quand les formules photo reviennent à l'ordre du jour : AgeVerif et Yoti ensemble, PhotoDNA et xAI.

## Description commune (reprise dans chaque message, adaptée au destinataire)

- Service : « Bitomètre » (bitometre.com), site **en français**, **réservé aux adultes**, qui fournit une **analyse statistique chiffrée** de mesures corporelles (longueur, circonférence, courbure, symétrie) : score sur 100, percentiles par rapport à une étude scientifique publiée (Veale et al., BJU International, 2015), commentaire pince-sans-rire. Ton de faux laboratoire ; **aucun contenu sexuel explicite** n'est affiché, publié ou stocké ; aucune image du corps de l'utilisateur n'est jamais générée ni affichée.
- Formule A (questionnaire) : l'utilisateur **saisit lui-même** des valeurs ; **aucune photo**. Gratuite pendant la bêta, puis payante (2,99 € TTC prévu).
- Formules B et C (photo, **pas encore ouvertes**) : l'utilisateur envoie la **photographie de sa propre anatomie intime** posée à côté d'une carte au format bancaire ; elle est analysée **en mémoire** par un modèle d'IA (xAI), **jamais enregistrée par le site** ; le fournisseur d'IA la conserve 30 jours par défaut (sauf Zero Data Retention). Vérification d'âge par prestataire tiers obligatoire avant l'envoi, filtrage par empreinte des images déjà répertoriées comme illicites, captcha.
- Éditeur : société de droit anglais (Ltd). Pas d'établissement en France à ce jour.
- Pas de compte, pas d'adresse électronique collectée ; rapport accessible par un lien privé ; suppression possible à tout moment.
