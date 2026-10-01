# Demande à Yoti : vérification d'âge pour les formules photo (envoyée en parallèle à AgeVerif)

**Nécessaire pour le passage au payant de la formule A : NON.** Nécessaire **avant l'ouverture des formules photo** (B et C). La formule A n'utilise pas de prestataire d'âge.

**Décision du propriétaire** : demandes envoyées **en parallèle à AgeVerif et à Yoti**, décision sur **réponses écrites** ; **critère principal : l'indépendance vis-à-vis des exploitants de sites pour adultes**.

## Canal d'envoi

- Contact commercial : <https://www.yoti.com/contact-us/> (formulaire) ; produit : <https://www.yoti.com/business/age-verification/> ; documentation : <https://developers.yoti.com/age-verification>.
- **Vous** envoyez. **Ne créez pas de compte** avant les réponses écrites. Texte en anglais.

## Objet

`Age verification enquiry – UK Ltd – French-language adults-only service – before photo upload`

## Message prêt à copier (anglais)

> Hello,
>
> I am writing on behalf of [À COMPLÉTER : legal name of the Ltd], a private limited company registered in England and Wales (company no. [À COMPLÉTER : Companies House number]; registered office: [À COMPLÉTER : registered office]), to ask about your age verification product before we apply. We would value **written answers**.
>
> **Our service.** Bitomètre (bitometre.com) is a French-language website **for adults only** that provides a statistical analysis of body measurements (length, girth, curvature, symmetry) against a published scientific reference. It does not display, publish or store sexually explicit material. A first offer (a questionnaire where the user types their own measurements, no photograph) is open as a free beta and does not use third-party age verification. **Two later offers, not yet live,** require the user to upload a photograph of their own intimate anatomy next to a bank card; the photograph is analysed in memory by an AI model and never stored by our site, with hash-matching against known illegal images before analysis. We need a reliable **over-18 result before any photo upload**, without receiving any identity data. Markets: France, Belgium, Switzerland, Luxembourg, Quebec. Initial volume: low (tens to hundreds of checks a month).
>
> **Questions:**
> 1. **Independence.** Do Yoti, its parent or affiliates have any ownership, board, financing or commercial relationship with operators of adult websites (publishers, affiliate networks, video platforms)? Please confirm in writing.
> 2. **What you learn about our site.** For each method you would offer us in France (facial age estimation, ID document, others), does Yoti learn the URL or name of our site, or can users be recognised across sites? What do you retain, for how long, and where?
> 3. **Assurance and audit.** What independent certifications or audits cover the method (e.g. NIST FATE results for facial age estimation, ISO 27001, certification schemes), with dates? What error rate and buffer age (challenge age) do you recommend for a 18+ requirement? What wording may we use publicly to describe your service without overstating it (we will not claim "certified by Arcom" or "anonymous" without proof)?
> 4. **French and EU compliance.** Is the solution compliant with the French Arcom technical reference for age verification? On what basis (self-declaration, audit)? GDPR: role (processor/controller), Data Processing Agreement, hosting region, sub-processors, transfers outside the UK/EU, breach notification.
> 5. **Eligibility.** Do you accept a newly created UK private limited company with no French establishment, for a site of this type (no explicit content)? Documents required and typical time to onboarding.
> 6. **Integration.** Hosted flow or SDK? Sandbox/test mode? How do we verify the result on our server (signed token, server-to-server call), token lifetime and one-time use, secret rotation, behaviour on failure or abandonment, handling of known circumvention (shared token, deepfake, photo of another person).
> 7. **Price.** Price per check by method, minimum monthly commitment, billing in EUR, term and cancellation.
> 8. **Liability.** Liability cap and service levels.
>
> We can provide a detailed description, screenshots and our terms once they have been reviewed by counsel.
>
> Kind regards,
>
> [À COMPLÉTER : name of the director]
> Director, [À COMPLÉTER : legal name of the Ltd]
> [À COMPLÉTER : contact e-mail]

## Informations à joindre

Aucune pièce au premier message. À prévoir sur demande : certificat d'immatriculation, identité du dirigeant, adresse du site de test protégé (identifiants sur demande seulement).

## Questions appelant une réponse écrite

Les huit questions. **Décisives** : 1 (indépendance : critère principal), 2 (ce que Yoti apprend de notre site), 3 (garanties réelles, formulation autorisée), 5 (éligibilité d'une jeune société britannique). Note : l'adaptateur du site pour la vérification d'âge n'est écrit que pour AgeVerif ; si Yoti était retenu, un adaptateur devra être écrit d'après sa documentation (`docs/PRESTATAIRES.md`, section « Vérification d'âge »).
