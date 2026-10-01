# Demande à xAI (SpaceXAI LLC) : non-conservation des données (Zero Data Retention) et accord de traitement

**Nécessaire pour le passage au payant de la formule A : NON.** La formule A n'envoie **rien** à xAI (vérifié dans le code : seul `src/lib/vision/xai.ts` appelle l'API, et uniquement pour les formules photo). Nécessaire **avant l'ouverture des formules photo**, pour (1) faire disparaître la conservation de 30 jours des photos, (2) signer l'accord de traitement des données (RGPD, art. 28).

Rappel (SPEC.md, section 11) : par défaut, xAI conserve les requêtes et réponses, images comprises, **30 jours** pour détecter les abus ; l'option Zero Data Retention (ZDR) les supprime, **activable par l'administrateur de l'équipe dans la console xAI**, au niveau de toute l'équipe, avec des fonctions désactivées (API Responses avec état, Files, Collections, Batch). Le site utilise l'endpoint sans état `/v1/chat/completions`.

## Deux actions distinctes

1. **Activer ZDR vous-même** dans la console xAI : <https://console.x.ai> → réglages de l'équipe (« Team settings ») → rubrique de confidentialité / conservation des données (le libellé exact change : je n'ai pas pu ouvrir la console, qui exige votre connexion). Seul l'administrateur de l'équipe peut le faire.
2. **Obtenir une confirmation écrite** (message ci-dessous) : que ZDR s'applique bien aux images envoyées à `/v1/chat/completions`, ce qu'il couvre et ne couvre pas, et l'accord de traitement.

## Canal d'envoi

- Support depuis la console : <https://console.x.ai> (rubrique d'aide / « Support » ou « Contact sales ») ; site : <https://x.ai/api> (formulaire de contact entreprise). **Je n'ai pas pu ouvrir x.ai/contact (accès refusé aux outils automatiques) et je n'ai pas trouvé d'adresse e-mail publiée dans la documentation lue : n'envoyez pas à une adresse devinée.** Utilisez le formulaire ou le support indiqué dans la console.
- Accord de traitement : le pied de page de x.ai propose un lien « DPA » (relevé le 30/09/2026, voir `docs/DECISIONS.md`) : à lire et à faire relire par le juriste avant signature.
- **Vous** envoyez et **vous** signez. Texte en anglais.

## Objet

`Zero Data Retention for image inputs on /v1/chat/completions + Data Processing Addendum – EU-facing service (UK Ltd)`

## Message prêt à copier (anglais)

> Hello,
>
> We are [À COMPLÉTER : legal name of the Ltd], a private limited company registered in England and Wales (company no. [À COMPLÉTER : Companies House number]), using the xAI API (team: [À COMPLÉTER : team name or ID from the xAI console]) for a French-language, adults-only website.
>
> **What we send.** In a future offer (not live), a user uploads a photograph of their own body next to a bank card; our server re-encodes it and sends it to `/v1/chat/completions` (model grok-4.7, vision input) for two requests: an admissibility check and the location of key points. The image is processed in memory on our side and never stored by us. The photograph is a **special category of personal data** (GDPR art. 9), sent with the user's explicit prior consent. We have not yet sent any real user photograph; we only used neutral drawn test images.
>
> **Please confirm in writing:**
> 1. Zero Data Retention: that, once enabled by our team administrator, ZDR applies to **image inputs** and to the responses of `/v1/chat/completions`, and that no copy is kept for abuse monitoring or any other purpose. What exactly remains retained (billing metadata, token counts, abuse-flag metadata)? Is there any exception, even for flagged content?
> 2. Whether enabling ZDR is team-wide, immediate, and reversible; and which API features it disables for our team (we use only the stateless chat completions endpoint).
> 3. A **Data Processing Addendum** (GDPR art. 28 and UK GDPR) covering our use: please send the version to sign (the footer of x.ai mentions a DPA), with the list of sub-processors, the processing locations, the mechanism for transfers outside the EU/UK (adequacy decision or standard contractual clauses / UK addendum) and breach-notification terms.
> 4. Whether xAI uses any API inputs or outputs for training or evaluation in any case, with or without ZDR.
> 5. Whether our use case (statistical analysis of a user-submitted photograph of the user's own body; adults only; age verification and hash-matching of known illegal images before submission; no storage) complies with your acceptable-use policy for the API. If the model refuses some images, is that a content-policy decision we should expect, and how should we handle it?
> 6. What xAI does and what it expects from us if an image is flagged as potentially illegal on its side (notification to us? reporting? deletion?).
>
> Kind regards,
>
> [À COMPLÉTER : name of the director]
> Director, [À COMPLÉTER : legal name of the Ltd]
> [À COMPLÉTER : contact e-mail]

## Informations à joindre

Identifiant de l'équipe (console xAI) ; description du flux (`docs/SPEC.md`, sections 5, 11 et 17) ; engagements déjà pris dans nos textes : « Photo jamais stockée par Bitomètre » (le badge « Photo supprimée après analyse » ne sera rétabli qu'une fois ZDR **activé et confirmé par écrit**).

## Questions appelant une réponse écrite

Les six questions. **Décisives** : 1 (ZDR couvre bien les images), 3 (accord de traitement et garanties de transfert : sans eux, l'envoi à xAI ne doit pas ouvrir), 6 (que fait xAI d'une image qu'il juge illicite). La question 5 compte aussi : un refus d'xAI sur le sujet bloquerait les formules photo.
