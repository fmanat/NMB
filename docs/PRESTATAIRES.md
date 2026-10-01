# Comparaison des prestataires (session de nuit, sans inscription ni message envoyé)

**Méthode et limites, à lire d'abord.** Recherche documentaire en lecture seule : aucun compte ouvert, aucun formulaire, aucun message envoyé. Les pages ont été lues par un outil qui en renvoie un **résumé** produit par un petit modèle : les citations ci-dessous sont donc de seconde main et **doivent être relues sur la page avant toute décision**. Certaines pages (Mollie, Adyen, Paddle, Safer, Google, Friend Captcha tarifs…) étaient en erreur 403 ou 404 ; `web.archive.org` est bloqué dans l'outil, donc pas de repli. Légende : **[LU]** lu sur la page ; **[DÉDUIT]** raisonnement ; **[NT]** non trouvé. Rien ici n'est un conseil juridique.

Règle du projet rappelée : on ne masque jamais la nature du service auprès d'un prestataire. Chaque demande d'accord se fait en décrivant le service tel qu'il est.

---

## 1. Paiement

Besoin : page de paiement hébergée (redirection), notification serveur signée, Apple Pay et Google Pay, société britannique vendant en euros à des consommateurs UE et UK, contenu numérique à accès immédiat.

| Critère | **Stripe** | **Mollie** | **Paddle** (marchand officiel) |
|---|---|---|---|
| Contenu « adulte » | Interdit : pornographie et contenu destiné à la « gratification sexuelle », y compris généré par IA. L'analyse corporelle n'est pas citée. | Interdit : contenu « obscène, pornographique ou blasphématoire » sur les URL enregistrées ; peut refuser ce qui présente un « risque de réputation ». | Interdit : « produits ou services à caractère sexuel », « conseil médical » et visages « human-like ». |
| Santé, données intimes | Télémédecine et produits de santé restreints ; rien sur l'analyse de mesures déclarées. | Non trouvé. | « Conseil médical » interdit : une analyse corporelle pourrait y être assimilée [DÉDUIT]. |
| Société britannique | Oui (pages en-gb, tarif UK). | Oui selon une source secondaire ; page officielle non lue. | Non trouvé. |
| Apple Pay / Google Pay | **Non confirmé** dans les pages lues. | Oui (page tarifs : « Rate defined by card used »). | Non trouvé. |
| Commission publiée | Cartes EEE standard 1,5 % + 0,25 € ; premium 2,8 % + 0,25 € ; cartes UK 2,5 % + 0,25 € ; internationales 3,15 % + 0,25 € (+2 % conversion) ; litige 20 €. | Cartes de consommateurs EEE 1,80 % + 0,25 €. Remboursement : non trouvé. | 5 % + 0,50 $ ; en dessous de 10 $ : tarif sur devis, donc hors barème public pour 2,99 €. |
| Versement | Premier versement 7 jours après le premier paiement réel (France, UK), puis 3 jours ouvrés. | Au choix (quotidien, hebdomadaire, mensuel) ; SEPA 1 à 3 jours ouvrés ; réserve glissante possible. | Non trouvé. |
| Webhooks | En-tête `Stripe-Signature`, HMAC-SHA256, tolérance 5 min, doublons possibles. | En-tête `X-Mollie-Signature` (`sha256=`) **seulement pour les nouveaux webhooks** ; les classiques ne sont pas signés (il faut alors rappeler l'API). | Non examiné. |
| Mode test | Oui. | Oui. | Non examiné. |
| Idempotence | En-tête `Idempotency-Key`. | Non trouvé. | Non examiné. |

### Clauses citées (seconde main)
- Stripe, activités interdites et restreintes : <https://stripe.com/en-fr/legal/restricted-businesses> (rubrique « Adult content and services » : « Pornography and other mature audience content »). Contrat : <https://stripe.com/en-gb/legal/ssa> (interdiction d'exercer une activité interdite ou restreinte sans accord écrit, suspension immédiate possible, réserve possible). Tarifs : <https://stripe.com/en-fr/pricing>. Versements : <https://docs.stripe.com/payouts>. Webhooks : <https://docs.stripe.com/webhooks>. Idempotence : <https://docs.stripe.com/api/idempotent_requests>.
- Mollie, contrat, article 3.1 (contenu « obscene, pornographic or blasphemous »), 5.6 (règlement SEPA), 5.7 (réserve) : <https://www.mollie.com/legal/user-agreement>. Tarifs : <https://www.mollie.com/pricing>. Webhooks : <https://docs.mollie.com/reference/webhooks-new>. Page des produits refusés (403, non lue) : <https://help.mollie.com/hc/en-us/articles/115000939369-Which-products-and-services-does-Mollie-not-accept>.
- Paddle, produits interdits : <https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle> ; tarif : <https://www.paddle.com/pricing>.

### Recommandation
**Stripe en premier choix, à condition d'une validation écrite avant l'ouverture du compte.** Aucune clause lue ne vise expressément l'analyse statistique de mesures saisies, sans image ni texte explicite ; le risque vient de l'appréciation de Stripe (contenu « intime » ≠ contenu sexuel, mais la classification est subjective). **Repli : Mollie** (frais plus bas, versements au choix, mais webhooks signés seulement en « next-gen » et réserve possible). **Paddle : non recommandé** (interdit « conseil médical » et contenu à caractère sexuel ; tarif non publié pour ce panier).

### Risques
Fermeture de compte ou gel des fonds à l'appréciation du prestataire (Stripe 7.2 et 10.1 ; Mollie 5.7). Frais fixes de 0,25 € sur 2,99 € : environ 8 % du prix [calcul]. TVA à la charge de l'éditeur (pas de marchand officiel) : question fiscale à faire traiter par un professionnel. Versements en devise du compte : conversion possible si le compte est en GBP. Apple Pay et Google Pay à confirmer pour Stripe Checkout.

### Questions à poser par écrit avant inscription
1. Un service payant d'analyse statistique de mesures corporelles déclarées par l'utilisateur, sans image ni texte explicite, est-il interdit, restreint ou accepté ? Réponse écrite avant l'ouverture du compte ?
2. L'envoi d'une photo (non stockée, supprimée après analyse) change-t-il la classification ?
3. Une société britannique avec établissement en France peut-elle ouvrir un compte, avec quels justificatifs ?
4. Réserve, plafond de volume ou délai de versement propres à cette catégorie ?
5. Apple Pay et Google Pay sont-ils actifs par défaut sur la page hébergée ? Vérification de domaine ?
6. Frais de remboursement ? Commission fixe remboursée ?
7. Conversion de devise EUR → devise de versement : taux et frais ?
8. Traitement des contestations de paiement pour un contenu numérique à accès immédiat avec renonciation au droit de rétractation ?
9. (Mollie) Signature des webhooks disponible en production ?

---

## 2. Filtrage d'empreintes d'images (contenus d'abus déjà répertoriés)

**Cadrage rappelé :** ce filtrage ne fait que comparer avec des contenus **déjà connus**. Il ne détecte ni l'âge d'une personne ni les images nouvelles, et le site ne doit jamais le présenter autrement. Microsoft l'écrit pour PhotoDNA : il « identifie uniquement des images d'exploitation d'enfants connues » (<https://www.microsoft.com/en-us/photodna/faq>) [LU].

| Critère | **PhotoDNA Cloud Service** (Microsoft) | **Cloudflare CSAM Scanning Tool** | **IWF** (adhésion, liste de hachages d'images) |
|---|---|---|---|
| Éligibilité | Fournisseurs de confiance hébergeant du contenu d'utilisateurs, avec vérification par un tiers. Éligibilité d'une petite société britannique : [NT]. | Aucune condition indiquée ; un e-mail vérifié suffit (<https://developers.cloudflare.com/changelog/post/2025-02-04-easier-onboarding-for-csam-scanning-tool/>). | Organisation enregistrée, active depuis plus de 12 mois, plus de 2 salariés, sécurité des données démontrée (<https://www.iwf.org.uk/membership/how-to-join/>) : une structure récente pourrait ne pas remplir les critères [DÉDUIT]. |
| Prix | Gratuit pour les clients qualifiés. | Gratuit (source secondaire). | 5 000 £ à plus de 100 000 £ par an (<https://www.iwf.org.uk/membership/fees/>). |
| Mécanisme | API REST ; mode qui envoie l'image (Microsoft dit la convertir aussitôt en empreinte) ; mode « Edge Hash » qui n'envoie que l'empreinte (source secondaire). | Examine les images **servies depuis le cache Cloudflare**. | Liste à intégrer soi-même ; comparaison locale probable [DÉDUIT]. |
| Adapté à Bitomètre ? | Oui si l'éligibilité est accordée. | **Non** : les photos ne sont ni stockées ni re-diffusées, l'outil ne filtre pas les envois [DÉDUIT]. | Oui techniquement ; coût élevé. |

Autres candidats vus : Safer (Thorn : conditions non lues) ; Google Content Safety API (**classe des images inconnues**, donc le contraire d'un simple filtrage) et CSAI Match (vidéo) ; Take It Down et StopNCII (empreintes d'images intimes soumises par des victimes : autre sujet). Sources : <https://www.microsoft.com/en-us/photodna>, <https://developers.cloudflare.com/cache/reference/csam-scanning/>, <https://protectingchildren.google/tools-for-partners/>, <https://safer.io/>.

### Obligations de signalement : incertitudes fortes, avis juridique indispensable
- États-Unis (NCMEC) : l'obligation légale (18 U.S.C. § 2258A) vise les plateformes américaines ; Microsoft indique que les clients non américains déterminent leurs obligations locales.
- Royaume-Uni : l'article 66 de l'Online Safety Act (règlement 2025/368, <https://www.legislation.gov.uk/uksi/2025/368/body/made>) oblige certains services « user-to-user » à signaler à la NCA, y compris hors Royaume-Uni ; **date d'entrée en vigueur contradictoire selon les sources** ; savoir si Bitomètre est un tel service (envoi privé, sans partage entre utilisateurs) : [NT].
- France : article 6-I-7 de la LCEN (signalement via PHAROS pour les hébergeurs ; source secondaire, texte non lu).
- UE : règlement transitoire 2021/1232 expiré le 4 avril 2026 selon des résultats de recherche ; vise les services de communications interpersonnelles, donc probablement pas Bitomètre [DÉDUIT] ; base légale RGPD d'un filtrage volontaire : [NT].
- **Tension avec le principe « photo jamais stockée »** : une correspondance peut imposer de signaler et de conserver (Cloudflare mentionne une conservation d'un an aux États-Unis). À arbitrer avec un juriste **avant** de brancher un filtre.

### Recommandation
**Premier choix : PhotoDNA Cloud Service**, idéalement en mode empreinte calculée chez soi (aucune image ne sort), sous réserve d'éligibilité. **Repli : IWF** si les critères et le budget le permettent. **Écartés :** Cloudflare (mauvais point d'application), Google (classification, vidéo).
**Conséquence pour le code :** l'API PhotoDNA n'est accessible qu'après approbation : **aucun adaptateur fidèle n'a pu être écrit d'après une documentation publique**. Il reste à faire après accord (voir Bloc 3 dans SESSION-NUIT.md).

### Questions avant inscription
Éligibilité d'une petite société britannique (justificatifs, délais) ; le mode « Edge Hash » permet-il le calcul local sans envoi d'image, et quelle empreinte est transmise ; que se passe-t-il en cas de correspondance (signalement par le prestataire ? conservation ?) ; DPA RGPD et région de traitement ; utilisable sans être un service « user-to-user » ; pour l'IWF : prix exact, durée de licence, fréquence de mise à jour.

---

## 3. Captcha

| Critère | **ALTCHA** (auto-hébergé, MIT) | **Friendly Captcha** | **Cloudflare Turnstile** |
|---|---|---|---|
| Vie privée | « Ni cookie, ni suivi, ni donnée qui sort de votre contrôle » ; pas d'empreinte (<https://altcha.org/>, <https://github.com/altcha-org/altcha>). | « Zéro cookie, traqueur ou donnée personnelle » (<https://friendlycaptcha.com/>) ; société allemande. | Traite IP, empreinte TLS, User-Agent ; Cloudflare agit aussi **en responsable de traitement** pour améliorer la détection (<https://www.cloudflare.com/turnstile-privacy-policy/>). |
| Hébergement / transferts | Auto-hébergé : aucun transfert. | Centres UE, US, Asie ; UE seul « sur les offres supérieures ». | Transferts hors UE : [NT] ; hébergement UE : [NT]. |
| Tarif | Gratuit (MIT) ; offre cloud dès 47 €/mois. | Gratuit 1 000 requêtes/mois, 1 domaine ; 9, 39, 200 €/mois. | Gratuit (20 widgets, défis illimités). |
| Vérification serveur | Sur votre serveur (HMAC) ; détails de la doc illisibles. | `POST https://global.frcapi.com/api/v2/captcha/siteverify`, en-tête `X-API-Key`. | `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` (`secret`, `response`, `remoteip`) ; jeton valable 300 s, usage unique. |
| Accessibilité | WCAG 2.2 AA (auto-déclaré). | WCAG 2.2 AA (auto-déclaré). | WCAG 2.2 AA. |

Pour comparaison : hCaptcha collecte mouvements de souris, défilement et frappes, utilise des cookies, transferts vers les États-Unis (<https://www.hcaptcha.com/privacy>) : moins adapté. reCAPTCHA et mCaptcha non consultés.

### Recommandation
**ALTCHA auto-hébergé** : aucun tiers, aucun transfert, gratuit, cohérent avec la promesse de confidentialité. Contrepartie : pas de réputation d'adresse IP mondiale, donc la limite de 5 essais par 24 h et la vérification d'âge restent les vraies barrières ; il faut gérer le secret HMAC et le rejeu des jetons. **Repli : Friendly Captcha** (UE, DPA à vérifier), ou Turnstile si Cloudflare comme responsable de traitement partiel est acceptable.

### Questions avant inscription
(Friendly Captcha, Turnstile) DPA, sous-traitants, régions ; option UE seule et son prix ; données envoyées à chaque vérification et réutilisation. (ALTCHA) durée de validité des défis, anti-rejeu, difficulté de preuve de travail sur mobile d'entrée de gamme, alternative pour les personnes qui ne peuvent pas l'exécuter.

---

## 4. Vérification d'âge

**Le texte de référence.** Référentiel technique de l'Arcom (délibération n° 2024-20 du 9 octobre 2024), lu en intégralité : <https://www.arcom.fr/sites/default/files/2024-10/Arcom-Referentiel-technique-sur-la-verification-de-age-pour-la-protection-des-mineurs-contre-la-pornographie-en-ligne.pdf> [LU]. Points utiles :
- Il vise les services qui diffusent des contenus pornographiques ; **Bitomètre n'en est pas un** : le « double anonymat » est ici un choix volontaire, pas une obligation de ce texte [DÉDUIT].
- Définition du double anonymat (exigence n° 7) : le prestataire de preuve d'âge ne doit pas savoir pour quel service la vérification est faite. L'Arcom précise que le mécanisme **« n'est pas anonyme » au sens du RGPD** : le site ne doit donc jamais écrire « anonyme ».
- Exigence n° 10 : afficher clairement le niveau de protection ; si un tiers peut connaître le service demandeur, en informer l'utilisateur.
- **Il n'existe ni certification ni liste de prestataires agréés** dans ce texte, et la CNIL indique qu'elle ne certifie pas de solutions (<https://www.cnil.fr/fr/verification-de-lage-en-ligne-la-cnil-rend-son-avis-sur-le-referentiel-de-larcom>, via résumé). « Certifié Arcom » ou « conforme Arcom » est donc une **auto-déclaration** du prestataire.
- Une étude indépendante de juillet 2026 juge les garanties de double anonymat « largement non vérifiables » de l'extérieur et relève des contournements à faible coût (<https://arxiv.org/pdf/2606.08667>, lu).

| Critère | **AgeVerif** | **Yoti** | **AgeGO** |
|---|---|---|---|
| Double anonymat réel | Seulement via certaines méthodes déléguées ; AgeVerif connaît le site (`client_id`) [DÉDUIT]. | Yoti connaît le client ; « double blind » via un partenaire non nommé ; l'information « ne savent pas quel client » ne vaut que pour les sous-traitants. | **Contesté** : un rapport d'AI Forensics dit qu'AgeGO reçoit le site visité (<https://www.biometricupdate.com/202509/intermediary-age-assurance-provider-collecting-user-data-on-specific-urls-more>, relayé). |
| Audit / certification | Auto-déclare IEEE 2089.1-2024, AVPA, ACCS, KJM, ICO ; aucun audit Arcom trouvé. | SOC 2 Type II, ISO 27001/27701, ACCS (auto-déclarés) ; pas d'approbation Arcom trouvée. | Non trouvé (pages illisibles). |
| Coût | Selfie, carte, e-mail : gratuits ; AgeGO via AgeVerif 0,015 € ; Pleenk 0,04 € (<https://www.ageverif.com/webmaster-terms-of-use>, clause 10). | 0,25 £ (identité numérique) et 1,00 £ (document) **en 2022**, relayé ; aucun tarif actuel public. | 0,015 € par vérification (relayé), facturation mensuelle. |
| Intégration | OAuth2 (code côté serveur, jeton d'accès 1 h, point d'accès aux ressources), clés de test : <https://docs.ageverif.com/oauth2.html>. | Session API, page hébergée, redirection ou iframe : <https://developers.yoti.com/age-verification>. | Redirection, retour GET signé HMAC-SHA256, point `validate-token` : <https://docs.agego.com/integration/callbacks-and-redirects.md>. |
| Conditions, société britannique | Éditeur portugais (PlanetSeason Lda). Aucune restriction géographique vue. Responsabilité limitée aux dommages directs prouvés et aux 12 derniers mois payés (clause 15). | Société britannique ; conditions contractuelles non lues. | Compte « Business » avec validation manuelle ; conditions non lisibles. |
| Hébergement, conservation | Non précisé. | Serveurs UK ou régions AWS US/UE/UK ; selfie supprimé après estimation. | Webcam envoyée vers AWS (relayé) ; durées non lues. |

**Point de gouvernance à clarifier (AgeVerif).** Dans sa réponse au rapport d'AI Forensics, AgeVerif reconnaît que son dirigeant est aussi dirigeant d'un exploitant de plateformes pour adultes (Evofill Ltd., Chypre), déclaré à l'Arcom sans objection selon eux (<https://assets.ageverif.com/docs/AgeVerif_Analysis_AI-Forensics_Technical_Report.pdf>, lu). C'est une déclaration de leur part.

**Écartés :** Didit (prestataire d'identité, pas de double anonymat démontré ; conservation indéfinie par défaut), France Identité (expérimentation fermée), Veriff, Incode, IDnow et Privately (non approfondis : axés identité).

### Ce que chaque prestataire garantit réellement, et ce que le site ne doit pas dire
- Personne ne garantit la majorité à 100 % (l'estimation faciale a une marge d'erreur ; AgeVerif applique un seuil de 23 ans en France pour compenser). Le site ne dit jamais « âge garanti » ni « preuve infaillible ».
- Ne jamais écrire « certifié Arcom », « validé par la CNIL » ni « conforme au référentiel Arcom » comme un fait.
- « Double anonymat » seulement pour une méthode dont le prestataire le prouve, avec la mention « pas anonyme au sens du RGPD » et l'information de l'exigence n° 10.
- L'âge vérifié ne prouve pas que la personne sur la photo est celle qui a passé la vérification : deux contrôles séparés.

### Recommandation
**AgeVerif en premier choix, sous conditions** : flux OAuth2 avec échange de code côté serveur (vérifiable sans faire confiance au navigateur), clés de test, tarif nul ou très bas, pas de restriction géographique vue. Conditions à lever par écrit : gouvernance (lien avec un exploitant de sites pour adultes) et fait qu'il connaît votre site. **Repli : Yoti** (le plus solide, tarif actuel non public). **Écarter AgeGO** tant qu'il n'a pas répondu par écrit à l'accusation d'AI Forensics.

### Risques
Étiquette « double anonymat » non vérifiable ; dépendance à un petit prestataire et limite de responsabilité basse ; contournements possibles (jeton copié, deepfakes) donc validation côté serveur, jeton à usage unique et de courte durée ; le site reste responsable de traitement.

### Questions avant inscription
1. Pour chaque méthode proposée en France : le prestataire connaît-il l'adresse de mon site ? (architecture des flux)
2. Rapport d'audit indépendant publié (auditeur, date) ? Sinon, quelle formulation puis-je utiliser sans mentir ?
3. Société britannique avec établissement en France, site de mesures corporelles sans image explicite : accepté ? Conditions écrites.
4. Mode test, durée et usage unique du jeton, algorithme de signature, rotation des secrets.
5. Coût exact par vérification et par méthode, minimum mensuel, facturation en euros.
6. Hébergement, sous-traitants, conservation, notification de fuite.
7. Liens de direction ou de capital avec des exploitants de sites pour adultes ; DPA fourni.
8. Plafond de responsabilité et garanties sur le taux d'erreur.

---

## 5. Questions pour le propriétaire (une par rôle, à reprendre dans le compte rendu)

1. **Paiement** : A. Demander à Stripe une validation écrite avant toute ouverture de compte, Mollie en repli (recommandé) · B. Mollie d'abord · C. Autre.
2. **Vérification d'âge** : A. AgeVerif sous conditions (questions 1, 2 et 7 à faire confirmer par écrit), Yoti en repli (recommandé) · B. Yoti d'abord · C. Autre.
3. **Filtrage d'empreintes** : A. Demander l'éligibilité à PhotoDNA et faire trancher l'obligation de signalement par un juriste avant tout branchement (recommandé) · B. IWF · C. Ne pas filtrer au lancement (à décider avec le juriste).
4. **Captcha** : A. ALTCHA auto-hébergé, Friendly Captcha en repli (recommandé) · B. Friendly Captcha · C. Turnstile.

---

# Mise à jour de la session de nuit n° 3 (01/10/2026) : décisions du propriétaire et Verotel

## Décisions inscrites

- **Paiement** : **Stripe est exclu définitivement.** Prestataire visé : **Verotel**, repli **CCBill** ou **Segpay**. Adaptateur Verotel écrit (`src/lib/payments/verotel.ts`), adaptateur Stripe laissé, désactivé.
- **Vérification d'âge** : demandes **en parallèle à AgeVerif et à Yoti**, décision sur **réponses écrites**, critère principal : **indépendance vis-à-vis des exploitants de sites pour adultes**.
- **Filtrage d'empreintes** : **demande d'éligibilité à PhotoDNA** ; signalement à trancher par le juriste.
- **Captcha** : ALTCHA auto-hébergé, Friendly Captcha en repli.
- Les demandes à envoyer sont dans `docs/DEMANDES/` (une par destinataire).

## Verotel : ce que disent ses textes (lus le 01/10/2026)

**Méthode et limites.** Pages publiques de verotel.com lues directement (pas par un résumé) : le **contrat marchand type** (https://www.verotel.com/en/merchantagreement.html : « Please do not use the agreement below, as this is just an example »), les offres (https://www.verotel.com/en/productchoice.html et https://www.verotel.com/en/pricechart.html) et l'intégration (https://www.verotel.com/en/integration.html). **Non lus** : la politique de contenu (« content policy », annoncée par le contrat comme « sent on request and … published on www.verotel.com » : introuvable sur le site à cette date), la documentation FlexPay et le Control Center (derrière une connexion), les conditions de souscription réelles (envoyées après dépôt de la demande). Les clauses ci-dessous sont celles du contrat **type** ; le contrat réellement proposé peut différer.

### Clauses citées, numérotées comme dans le contrat type

| Sujet | Citation | Portée pour ce service |
|---|---|---|
| Éligibilité à FlexPay | Page « productchoice » : ligne « Verotel FlexPay » : BASIC « No », PREMIUM « Yes ». Même page : « Premium merchants should provide 6 months of processing statements to open an account. » | **Obstacle probable** : l'adaptateur utilise FlexPay (montant et référence propres à chaque rapport). Une société nouvellement créée n'a pas de relevés de traitement. À demander par écrit : une dérogation existe-t-elle ? (voir `docs/DEMANDES/verotel.md`). Sans FlexPay, un compte Basic ne permet pas ce flux. |
| Frais | Page « productchoice » : BASIC « Annual registration fee EUR 500.00 », « Pricing non-recurring transactions 15,5% » ; PREMIUM : « Weekly fee EUR 25 / week (only if Weekly Volume is less than EUR 1000) », taux selon le volume. Pricechart : « If this ratio is 1.0% or more, a surcharge of 2.5% will apply to the base rate » (taux de contestations). | La commission provisoire du site (12 %, `FINANCE.paymentFeeRate`) est **inférieure** aux 15,5 % du compte Basic. À réviser. |
| Retenue | Art. 2 : « Company shall also hold a 10% of Customer Charges for a period of 26 weeks against potential charge backs (“Holdback”). » | Trésorerie : 10 % bloqués 26 semaines. |
| Remboursements et contestations | Art. 2 : le paiement dû au marchand est diminué de « all refunds processed on account of Merchant's Customer Charges » et des sommes « charged back by the Acquirer ». | Un remboursement reprend l'argent ; d'où le reverrouillage du rapport (implémenté). |
| Nature de ce qui peut être vendu | Art. 4 : « Merchant shall accept Codes only as payment for access to its restricted web sites … Without the express written consent of Company, Merchant may not accept Codes, or other Verotel-provided Proofs of Purchase as payment for the sale of content of any kind. » | **À clarifier par écrit** : le rapport est un contenu numérique vendu à l'unité, pas l'accès à un site restreint. Il faut le « express written consent » de Verotel. |
| Description du service | Art. 4 : le marchand doit « actively communicate modifications or changes … and a complete description of goods sold and services provided ». | Description exacte et tenue à jour (celle de `docs/DEMANDES/verotel.md`). |
| Contenu et loyauté | Art. 4 : « refrain from engaging in any illegal, unfair, deceptive or disparaging trade practices » ; art. 8 : « fully responsible for the contents of Merchant's Web site and follow the content policy of Company ». | Cohérent avec la règle du projet (jamais de présentation trompeuse). La politique de contenu n'a pas été lue. |
| Exigences américaines | Art. 8 : documentation « 18 U.S.C. § 2257 and 28 C.F.R. 75 » exigible « at any time » ; « Failure … may result in immediate suspension of processing. » | Concerne le contenu sexuellement explicite produit avec des acteurs ; le site n'en contient pas. À faire confirmer comme sans objet. |
| Résiliation | Art. 9 : « Company reserves the right to terminate this … Agreement without cause upon notification to the Merchant. » ; résiliation immédiate possible en cas de manquement ou d'« activities harmful to Company ». Art. 3 : le marchand peut résilier à tout moment. | Risque de coupure sans motif : prévoir un prestataire de repli (CCBill, Segpay). |
| Modification unilatérale | Art. 14 : Verotel peut modifier le contrat « to take into account changes in law … and to accommodate changes imposed on Company by its Acquirer, and to make other changes deemed necessary », sauf refus écrit sous 15 jours. | À connaître. |
| Pouvoir de représentation | Art. 2 « Power of Attorney » : le marchand donne à Verotel « full power of attorney … to register Merchant with acquiring banks and other processors ». | À faire relire par le juriste. |
| Pays à risque | Art. 2 « High Risk Countries » : Verotel peut bloquer certains pays « without the need to compensate Merchant ». | Le public visé (France, Belgique, Suisse, Luxembourg, Québec) est à confirmer comme non concerné. |
| Droit applicable | Art. 12 : « laws of the Netherlands and the venue … shall be the Netherlands ». | Droit et tribunaux néerlandais. |
| Lutte contre le blanchiment | Art. 4 : le marchand fournit « necessary information or documents » au titre de la loi néerlandaise (Wwft/Wft). | Vérification d'identité de la société et de ses dirigeants à prévoir (Companies House, pièces d'identité). |

### Sociétés britanniques

**Aucune clause du contrat type ne vise les sociétés britanniques** (ni pour les accepter, ni pour les exclure) : le contrat prévoit seulement une adresse de société et un pays, et des virements « to an account in United Kingdom » (GBP 15.00, tableau « Payment fees international payments »). Une source tierce de seconde main (un comparateur de prestataires, non officiel) indique que Verotel travaille avec des sociétés quel que soit leur pays d'immatriculation : **non vérifié à la source**. La question reste à poser par écrit.

### Ce que cela change

1. **Le compte Premium (FlexPay) est probablement le point bloquant** pour une société nouvelle : demander la dérogation ou une alternative. Si elle est refusée : CCBill ou Segpay (non étudiés cette nuit : leurs conditions n'ont pas été lues ; à faire avant toute demande).
2. L'adaptateur est écrit d'après le client officiel (signature et URL, **vérifié contre le jeu d'essai public de Verotel** : la signature SHA-1 de son test est reproduite à l'identique) et une bibliothèque tierce (noms des événements et des paramètres de notification). **À confirmer en mode test**, avant tout paiement réel : (a) la valeur exacte de l'événement d'une vente unique (« initial », ou absence d'événement avec « type=purchase »), (b) les noms des paramètres de montant et de devise dans la notification (« priceAmount » / « amount »), (c) la présence de « referenceID » dans les notifications de remboursement et de contestation (sinon le numéro de vente est utilisé), (d) l'adresse de retour acceptée, (e) le format de signature (SHA-256 ; SHA-1 refusé par défaut).
3. Aucune donnée d'identité n'est reçue de Verotel par le site ; seuls la référence du paiement, le numéro de vente, le montant et la devise sont lus. L'adresse privée du rapport n'est jamais transmise à Verotel.
