# Demande à Verotel : ouverture d'un compte marchand et conditions

**Nécessaire pour le passage au payant de la formule A : OUI.** Sans prestataire de paiement, la formule A ne peut pas devenir payante. Verotel est le premier choix (décision du propriétaire) ; CCBill ou Segpay en repli.

## Canal d'envoi

- Candidature et contact : <https://www.verotel.com/en/contactus.html> (page « Contact ») et <https://www.verotel.com/en/productchoice.html> (boutons « Apply for BASIC » / « Apply for PREMIUM » : **ne pas déposer de candidature avant d'avoir la réponse écrite aux questions ci-dessous**, car la candidature engage la procédure de conformité et, selon le contrat type, des frais d'inscription : voir `docs/PRESTATAIRES.md`).
- **Vous** envoyez (aucun compte n'a été ouvert). Joindre les pièces listées plus bas seulement quand Verotel les demande, pas dans le premier message.

## Objet

`Pre-application enquiry – UK Ltd – French-language statistical body-measurement report service (adults only) – FlexPay eligibility`

## Message prêt à copier (anglais)

> Dear Verotel team,
>
> I am writing on behalf of [À COMPLÉTER : legal name of the Ltd], a private limited company registered in England and Wales (company no. [À COMPLÉTER : Companies House number]; registered office: [À COMPLÉTER : registered office]). We are preparing a paid online service and would like to ask, **before applying**, whether it can be accepted and under which conditions.
>
> **The service.** "Bitomètre" (bitometre.com) is a French-language website for **adults only**. It sells a one-off **digital report**: a statistical analysis of body measurements (length, girth, curvature, symmetry) compared with a published scientific reference (Veale et al., BJU International, 2015), with a score out of 100 and a short deadpan comment. The tone is that of a fake laboratory. The site does **not** display, publish or store any sexually explicit image or text, and never generates an image of the user's body.
>
> **How it works today.** The user types in their own measurements (a questionnaire); there is no photograph. The report is computed by our own software and is accessible through a private link (no account, no e-mail address collected). The user can delete it at any time. We plan three offers: questionnaire (EUR 2.99 incl. VAT), then later two photo-based offers (EUR 4.99 and EUR 6.99) in which the user uploads a photograph of their own anatomy next to a bank card for scale; the photograph is analysed in memory by an AI model and is never stored by us. These photo offers would only open after age verification by a third-party provider, a captcha, and hash-matching against known illegal images. They are **not live**; we will tell you before launching them and only with your agreement.
>
> **Payment flow.** We would use hosted payment pages (Verotel FlexPay, one-time purchase, signed postbacks). We do not use subscriptions. The customer expressly requests immediate access to the digital report and acknowledges losing the right of withdrawal (UK Consumer Contracts Regulations 2013, reg. 37; French Consumer Code art. L221-28 13°), as shown on the payment page. We send Verotel only a random reference, the amount, the currency and a fixed description; never the private link of the report.
>
> **Markets.** French-speaking adults in France, Belgium, Switzerland, Luxembourg and Quebec. Prices in euros.
>
> We have read the sample Merchant Services Agreement published on your website. We would be grateful for **written answers** to the following questions:
>
> 1. Is a service of this kind (a statistical report on the user's own body measurements, no explicit content, adults only) acceptable under your content policy? Could you send us the current content policy?
> 2. FlexPay appears to be available only with a PREMIUM account, and PREMIUM merchants "should provide 6 months of processing statements". We are a newly created company without processing history. Is there an exception or an alternative for a one-time digital purchase with a per-order amount and reference?
> 3. Article 4 of the sample agreement states that merchants may not accept Codes "as payment for the sale of content of any kind" without Verotel's express written consent. Our product is a digital report, not access to a restricted website. Do you give that consent for this product, and in what form?
> 4. Is a UK-registered private limited company accepted? Which documents do you require (certificate of incorporation, proof of address, identity of directors and beneficial owners, other)? Typical time to decision?
> 5. Exact fees for our case (annual fee, per-transaction rate, weekly fee, chargeback surcharge), the holdback (percentage and duration) and the settlement schedule and currency for a EUR-priced product paid into a GBP or EUR account.
> 6. Article 8 of the sample agreement refers to 18 U.S.C. § 2257 documentation. Please confirm that it does not apply to a site with no sexually explicit material.
> 7. Do you block any of the countries listed above ("High Risk Countries")?
> 8. Test mode: can we test the full flow (purchase, postback, refund "credit" and "chargeback" postbacks) before going live? Please confirm, for FlexPay version 4: (a) the exact `event` value sent in the postback of a successful one-time purchase; (b) the names of the amount and currency parameters in postbacks; (c) whether `referenceID` is present in refund and chargeback postbacks; (d) the signature algorithm used for postbacks (SHA-256 or SHA-1); (e) whether `successURL` and `declineURL` may point to a page without parameters.
> 9. Which of our statements on the payment page would you want to review before going live?
>
> We are happy to provide any further description of the service, screenshots of every page, and our terms of use and privacy policy once they have been reviewed by counsel.
>
> Kind regards,
>
> [À COMPLÉTER : name of the director]
> Director, [À COMPLÉTER : legal name of the Ltd]
> Company no. [À COMPLÉTER : Companies House number] – [À COMPLÉTER : registered office]
> [À COMPLÉTER : contact e-mail]

## Informations à joindre ou à avoir sous la main (sur demande de Verotel)

- Certificat d'immatriculation de la Ltd (Companies House), statuts, adresse du siège ; identité des administrateurs et des bénéficiaires effectifs ; justificatif de domicile.
- Adresse du site de test protégé (identifiants fournis sur demande seulement) : voir `RAILWAY_TEST_URL` dans `.env`. Captures d'écran de l'accueil, du questionnaire, du rapport, de la page de paiement (à produire quand elle existera).
- Conditions générales de vente (`/cgv`) et politique de confidentialité : **à faire relire par le juriste avant de les remettre** (`docs/JURISTE.md`).
- Compte bancaire de la société pour les versements.

## Questions appelant une réponse écrite (à classer dans votre dossier)

Les neuf questions du message. Réponses décisives : 2 (FlexPay sans historique), 3 (vente de « content »), 4 (société britannique), 1 (politique de contenu). Une réponse négative ou évasive sur l'une d'elles = passer à CCBill ou Segpay (dont les conditions n'ont pas encore été lues : voir `docs/PRESTATAIRES.md`).
