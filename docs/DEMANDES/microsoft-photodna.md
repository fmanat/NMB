# Demande à Microsoft : éligibilité à PhotoDNA (filtrage d'empreintes d'images)

**Nécessaire pour le passage au payant de la formule A : NON.** La formule A ne reçoit aucune photo. Nécessaire **avant l'ouverture des formules photo** (B et C), qui ne peuvent pas tourner en production sans filtrage d'empreintes tranché (voir `docs/PRESTATAIRES.md`, section 2).

**Décision du propriétaire** : demande d'éligibilité à PhotoDNA ; **la question du signalement est tranchée par le juriste** (`docs/JURISTE.md`) : ne pas s'engager sur ce point dans la demande avant son avis.

## Ce que cette technologie fait, et ne fait pas (à ne jamais dépasser dans nos textes)

PhotoDNA compare l'empreinte d'une image à une base d'**images déjà répertoriées** comme abusives. Il ne reconnaît pas les nouvelles images et **ne détecte pas l'âge** d'une personne. Il ne remplace pas la vérification d'âge. Aucun texte du site ne doit dire « contenus illicites bloqués » ou « mineurs détectés » (règle du projet, `CLAUDE.md`).

## Canal d'envoi

- Page du service : <https://www.microsoft.com/en-us/photodna> et sa FAQ <https://www.microsoft.com/en-us/photodna/faq> (c'est là qu'est indiquée la procédure d'accès : formulaire de demande, évaluation par Microsoft). **Ces pages refusent l'accès aux outils automatiques (erreur 403) : je n'ai pas pu lire la procédure actuelle.** Ouvrez-les dans votre navigateur et suivez le lien « demande d'accès » / « request access » qui y figure ; reprenez le texte ci-dessous dans le champ de description. Ne devinez pas une adresse e-mail.
- **Vous** envoyez. Texte en anglais.

## Objet (ou intitulé de la demande)

`PhotoDNA eligibility request – UK Ltd – adults-only service receiving user-submitted photographs (processed in memory)`

## Message prêt à copier (anglais)

> Hello,
>
> We are [À COMPLÉTER : legal name of the Ltd], a private limited company registered in England and Wales (company no. [À COMPLÉTER : Companies House number]; registered office: [À COMPLÉTER : registered office]). We would like to know whether we can be **eligible for PhotoDNA** (cloud service or on-premise hash computation) and under which conditions.
>
> **Our service.** Bitomètre (bitometre.com) is a French-language website **for adults only** that provides a statistical analysis of body measurements. In its photo-based offers (not yet live) an adult user uploads **one photograph of their own body** next to a bank card for scale. The image is re-encoded server-side, processed **in memory only**, sent to a third-party AI provider for analysis, and **never stored by us** (not on disk, in the database or in logs). Uploads are preceded by third-party age verification and a captcha. The site is not a social network: users cannot see, share or download anyone's image, and there is no public gallery.
>
> **What we want to do with PhotoDNA.** Before analysis, compute (or send) the PhotoDNA hash of each uploaded image and compare it with the reference database. On a match, the image is destroyed immediately without analysis and we follow our legal obligations. We understand that PhotoDNA recognises previously identified images only, and does not estimate age; we will never describe it otherwise.
>
> **Please tell us in writing:**
> 1. Whether a small UK company operating a service of this type is eligible, and the criteria, documents and typical time to a decision.
> 2. Whether hash computation can be done on our side without sending the image to Microsoft (e.g. an "edge hash" mode), and exactly what is transmitted to Microsoft if we use the cloud service (the hash only, or the image).
> 3. What happens on a match: is there automatic reporting by Microsoft (e.g. to NCMEC or another body)? What is our own legal obligation as the operator, in the UK and in France, and what do you recommend we retain, if anything? (We are asking counsel in parallel; we would like your operational description.)
> 4. The data processing terms: GDPR / UK GDPR role, Data Processing Agreement, region of processing, retention of submitted hashes and match records, sub-processors.
> 5. Whether the service is available to a service that is not a "user-to-user" platform, and any usage restrictions (volume, purpose, resale).
> 6. Cost, if any, and the technical documentation we will receive after approval (API, SDK, test images or test hashes).
> 7. Alternatives you would recommend if we are not eligible.
>
> We can provide a detailed description, screenshots of every page and our terms of use once they have been reviewed by counsel.
>
> Kind regards,
>
> [À COMPLÉTER : name of the director]
> Director, [À COMPLÉTER : legal name of the Ltd]
> [À COMPLÉTER : contact e-mail]

## Informations à joindre

À prévoir sur demande : certificat d'immatriculation, identité du dirigeant, description du flux de traitement (schéma : `docs/SPEC.md`, sections 5 et 17), politique de confidentialité (à faire relire).

## Questions appelant une réponse écrite

Les sept questions. **Décisives** : 1 (éligibilité), 2 (calcul local sans envoi d'image), 3 (ce qui se passe en cas de correspondance : l'obligation de signalement relève du juriste). Si Microsoft refuse : repli IWF ou autre solution, décision à prendre avec le juriste (`docs/PRESTATAIRES.md`).
