# Dossier pour le juriste

Document à remettre à un juriste (droit du numérique, protection des données, consommation ; idéalement familier des sociétés britanniques opérant vers la France). Il rassemble **les questions précises**, chacune avec **son contexte** et **le passage concerné des textes du site** (les textes sont dans `src/app/*/page.tsx`, `src/components/*`, `docs/SPEC.md` ; l'ensemble est lisible sur le site de test, protégé par mot de passe).

**Ce que Claude n'est pas** : un avocat. Les références de textes juridiques cités ici sont celles que le projet utilise ; **plusieurs n'ont pas été relues à la source** (Légifrance est inaccessible aux outils automatiques) : elles sont signalées « à vérifier ».

## 0. Présentation du service (à lire en premier)

- **Éditeur** : société de droit anglais (Ltd), immatriculée au Royaume-Uni. **Pas d'établissement en France à ce jour** (non encore immatriculé ; il n'est mentionné nulle part dans les textes). Identité complète : à compléter par le propriétaire (`src/config/company.ts`).
- **Site** : « Bitomètre » (bitometre.com), **en français**, réservé aux adultes, qui fournit une analyse statistique chiffrée de **mesures corporelles intimes** de l'utilisateur lui-même (longueur, circonférence, courbure, symétrie) : score sur 100, percentiles (Veale et al., BJU International, 2015), commentaire pince-sans-rire. Aucune image explicite n'est affichée ni stockée. Public : France, Belgique, Suisse, Luxembourg, Québec.
- **Formule A** (questionnaire) : l'utilisateur saisit ses valeurs. **Aucune photo**, aucun prestataire d'âge (case « J'ai 18 ans ou plus » et année de naissance). Gratuite pendant la bêta, 2,99 € TTC ensuite.
- **Formules B et C** (photo, 4,99 € et 6,99 €) : **pas encore ouvertes**. L'utilisateur envoie une photo de sa propre anatomie intime ; vérification d'âge par prestataire tiers avant l'envoi ; filtrage par empreinte des images déjà répertoriées ; analyse en mémoire par un modèle d'IA (SpaceXAI LLC, États-Unis) qui conserve les requêtes 30 jours par défaut ; photo jamais stockée par le site.
- **Sans compte** ; adresse privée du rapport comme seul accès ; suppression à tout moment ; rapports de la bêta effacés au plus tard après 90 jours ; adresse IP hachée, effacée après 24 h.
- **Hébergement** : Railway Corporation (États-Unis), région UE ; paiement envisagé : Verotel (Pays-Bas) ; DNS : Cloudflare.

## 1. Loi SREN et Arcom

**Contexte.** La loi n° 2024-449 du 21 mai 2024 visant à sécuriser et à réguler l'espace numérique (dite « SREN ») impose aux services mettant à disposition du contenu pornographique un contrôle de l'âge conforme à un référentiel de l'Arcom (référentiel technique d'octobre 2024, avis de la CNIL). Le site ne publie aucun contenu pornographique, mais traite des données intimes et reçoit (formules photo) des images d'anatomie intime d'adultes.

**Questions.**
1. Le service entre-t-il, en tout ou partie, dans le champ de la loi SREN et du référentiel de l'Arcom (en tant que service « mettant à disposition » du contenu pornographique, ou autre qualification) ? Même question pour la formule A seule, qui ne contient aucune image.
2. Si non : y a-t-il néanmoins un risque de qualification par l'Arcom, et quels éléments du site pourraient l'accroître (photos téléversées, cartes de partage publiques, tonalité) ?
3. Aucune « certification Arcom » n'existe (auto-déclaration, selon nos lectures : à vérifier) : est-ce exact, et quelle formulation est permise pour décrire le prestataire d'âge retenu sans rien affirmer d'inexact ?

**Passages concernés.** `docs/SPEC.md` §4 (parcours) et §7 ; `docs/PRESTATAIRES.md` §4 ; page `/methode` ; pied de page (« Service réservé aux adultes »).

## 2. Vérification d'âge limitée aux formules photo

**Contexte.** Formule A : seule la première barrière (année de naissance stockée localement, jamais transmise, et case à cocher) ; **aucune vérification par prestataire**, car aucune photo n'est reçue. Formules B et C : vérification par prestataire tiers (AgeVerif ou Yoti, en cours d'étude) avant tout envoi de photo.

**Questions.**
1. Une simple déclaration (année de naissance + case) est-elle suffisante pour la formule A, compte tenu de la nature des données (mesures intimes saisies) ? Quel risque si un mineur la remplit (traitement de données sensibles d'un mineur, consentement, responsabilité) ?
2. Faut-il, pour la formule A, un second contrôle (ex. déclaration plus explicite, ou prestataire d'âge) avant le payant ? Avant l'ouverture publique de la bêta ?
3. La fenêtre « Contrôle d'accès » est-elle correctement formulée (voir ci-dessous) ? Que penser de la phrase sur « le délit pénal » ?

**Passages concernés.** Fenêtre d'accès (`src/components/ScanButton.tsx`) : « Votre année est stockée localement sur cet appareil et n'est jamais transmise. » ; « J'ai 18 ans ou plus. Je comprends que l'envoi de contenus impliquant des mineurs est un délit pénal. » Questionnaire : « J'ai 18 ans ou plus. »

## 3. RGPD, article 9 (données sensibles)

**Contexte.** Les valeurs saisies (longueur, circonférence, courbure du sexe) et, plus encore, les photos, relèvent selon l'interprétation de la santé ou de la vie sexuelle (art. 9). Le site recueille un consentement explicite par case à cocher : en **bêta**, case de consentement au traitement des valeurs saisies ; en formules photo, case de consentement à l'envoi de la photo à un prestataire américain.

**Questions.**
1. Ces données sont-elles bien des données de l'article 9 ? Le consentement explicite est-il la bonne base, et le libellé actuel est-il suffisant (spécifique, éclairé, libre) ? Peut-on conditionner le service à ce consentement ?
2. **Analyse d'impact (AIPD, art. 35)** : est-elle obligatoire (traitement à grande échelle de données sensibles, usage innovant) ? Qui la rédige ? Registre des traitements : contenu minimum.
3. Responsable de traitement : la Ltd. Autorité compétente : l'ICO (Royaume-Uni), la CNIL, ou les deux ? **Représentant dans l'Union (art. 27)** nécessaire tant qu'il n'y a pas d'établissement dans l'UE ? Quelle conséquence de la décision d'adéquation du Royaume-Uni (à vérifier : durée de validité) ?
4. Exercice des droits **sans compte** : l'utilisateur ne s'identifie que par le lien privé de son rapport. Comment authentifier une demande d'accès ou d'effacement ? La suppression par le lien est-elle suffisante ?
5. Conservation : rapports de la bêta 90 jours maximum ; rapports payés « au moins 3 ans » (`REPORT_ACCESS.minYears`) ; paiements : durée comptable ; journal anonyme conservé sans limite : le caractère réellement anonyme du journal (formule, score, date) est-il établi ?
6. Mesure d'audience maison, sans cookie, sans IP, sans identifiant (type d'événement + date seulement) : peut-on la considérer comme hors du champ de l'exigence de consentement (exemption de mesure d'audience de la CNIL, ou règle britannique équivalente) ? Faut-il l'afficher dans un bandeau ?
7. Cookies fonctionnels (« défi » 24 h, « âge » 30 min, « paiement » 2 h, session d'administration) : exemptés de consentement ? Mention suffisante dans la politique ?

**Passages concernés.** Case de consentement (`src/app/analyse/QuestionnaireForm.tsx`) : « Je consens au traitement des valeurs que je saisis (données sensibles, RGPD art. 9) pour calculer mon rapport, comme décrit dans la politique de confidentialité. » ; politique de confidentialité (`/confidentialite`, versions bêta et payante) ; `docs/SPEC.md` §11 et §23-24.

## 4. Transfert vers SpaceXAI LLC et conservation de 30 jours (formules photo)

**Contexte.** L'analyse des photos est faite par l'API de SpaceXAI LLC (société du Nevada, Austin, Texas ; connue sous le nom xAI). Par défaut, xAI conserve les requêtes **30 jours** (détection d'abus) ; l'option « Zero Data Retention » les supprime et peut être activée par l'administrateur de l'équipe. Un accord de traitement (DPA) est proposé par xAI : **non signé**. Le site recueille un consentement explicite avant l'envoi (art. 49 RGPD).

**Questions.**
1. Le consentement explicite (art. 49, §1, a) est-il un fondement valable pour un transfert **répété** de données de l'article 9 vers les États-Unis, ou faut-il un mécanisme de l'article 46 (clauses contractuelles types, addendum britannique) ou le cadre de protection des données UE-États-Unis (si xAI y est certifié : à vérifier) ?
2. Le DPA proposé par xAI est-il acceptable ? Points à négocier ? Le fournisseur est-il sous-traitant (art. 28) ?
3. Avec Zero Data Retention activé et confirmé par écrit, peut-on rétablir l'affirmation « Photo supprimée après analyse » ? Sans lui, la mention actuelle est : « Photo jamais stockée par Bitomètre » avec l'information sur les 30 jours chez xAI : est-elle suffisante et non trompeuse ?
4. Faut-il une évaluation d'impact du transfert (analyse de la législation américaine) ?
5. xAI peut-il refuser ou signaler des images ? Que devons-nous faire en cas de signalement par xAI ?

**Passages concernés.** Case de consentement des formules photo (`src/app/analyse/photo/PhotoFlow.tsx`) : « Je consens au traitement de cette donnée sensible pour l'analyse, et à son envoi à un prestataire situé aux États-Unis qui la conserve 30 jours… » ; politique de confidentialité (sections « Prestataire d'analyse », « Transfert de données hors de l'Union européenne », « Accord de traitement des données ») ; badge « Photo jamais stockée par Bitomètre » ; `docs/DECISIONS.md` (raison sociale lue sur archive publique).

## 5. Online Safety Act (Royaume-Uni)

**Contexte.** L'éditeur est britannique. L'Online Safety Act 2023 impose des obligations aux services « user-to-user », aux moteurs de recherche et (partie 5) aux services publiant du contenu pornographique, avec évaluations des risques, évaluation de l'accès par les enfants, vérification d'âge efficace pour la pornographie, etc. Le site ne permet à aucun utilisateur de voir le contenu d'un autre : seuls peuvent être partagés une **carte** (score, éventuellement un ou deux percentiles) par adresse publique, et une **comparaison de défi** (scores et percentiles, sans image) entre deux participants.

**Questions.**
1. Le service est-il un service « user-to-user » au sens de la loi (cartes publiques, défi) ? Relève-t-il de la partie 5 (contenu pornographique publié par le fournisseur) ? Des obligations d'évaluation (illegal content risk assessment, children's access assessment) s'appliquent-elles, avec quelle échéance (Ofcom) ?
2. Les formules photo (téléversement privé d'images d'anatomie intime, jamais visibles par d'autres) changent-elles la qualification ?
3. Obligations de signalement de contenus d'abus sexuels sur mineurs au Royaume-Uni (voir §10) ?

**Passages concernés.** `docs/SPEC.md` §9 (carte), §10 (défi) ; pages `/c/…`, `/r/…/defi` ; `docs/PRESTATAIRES.md` §2 (référence à la réglementation britannique).

## 6. Renonciation au droit de rétractation

**Contexte.** Rapport = contenu numérique fourni sans support matériel, accès immédiat après paiement. Case obligatoire avant paiement. Éditeur britannique vendant à des consommateurs français, belges, luxembourgeois (droit de l'UE) et suisses/québécois.

**Questions.**
1. Le libellé de la case suffit-il à valider la renonciation en droit français (art. L221-28, 13° du Code de la consommation : **texte non relu à la source**, à vérifier) et en droit britannique (règlement 37 des CCR 2013) ? Faut-il aussi une confirmation sur support durable (e-mail) alors que le site ne collecte aucune adresse ? Comment fournir le reçu et le contenu des informations précontractuelles (art. L221-5) sans compte ?
2. Un éditeur britannique visant la France est soumis à la loi impérative française de protection du consommateur (règlement Rome I, art. 6, §2 ; à vérifier pour le Royaume-Uni) : la clause « droit anglais avec préservation des dispositions impératives » est-elle correcte ? Juridiction compétente, médiation de la consommation (obligatoire en France : médiateur à désigner), garantie légale de conformité des contenus numériques ?
3. Droit québécois et suisse : quelles règles de consommation s'appliquent à nos ventes vers ces pays, et faut-il les exclure ?
4. Durée d'accès « au moins 3 ans » : engagement correct ? Un rapport reverrouillé après remboursement : conforme ?

**Passages concernés.** Case (`src/app/paiement/[id]/PayForm.tsx`) : « Je demande l'accès immédiat à mon rapport, je renonce à mon droit de rétractation et je reconnais le perdre dès que l'accès commence. » ; CGV (`/cgv`, sections « Accès immédiat et renonciation au droit de rétractation », « Droit applicable », « À compléter ») ; `docs/DECISIONS.md` (Bloc 1 de la première nuit).

## 7. Ltd britannique avec établissement en France (prévu)

**Contexte.** Un établissement en France est envisagé, **pas encore immatriculé** : il n'est mentionné dans aucun texte. Les mentions légales actuelles identifient la Ltd, son siège britannique, un directeur de la publication, l'hébergeur (Railway Corporation) et le numéro ICO.

**Questions.**
1. Les mentions légales sont-elles conformes à l'article 6, III de la loi du 21 juin 2004 (LCEN) pour un éditeur britannique sans établissement français ? Faut-il d'autres mentions (capital, RCS britannique, TVA) ?
2. Quand et comment immatriculer l'établissement (succursale, établissement secondaire) ; conséquences : droit applicable, autorité de protection des données, représentant au sens de l'article 27 RGPD, fiscalité (établissement stable), assujettissement à la contribution sur les services numériques, etc. ?
3. En l'absence d'établissement, quelles obligations de représentation légale ou de point de contact (consommateurs, autorités) pèsent sur la Ltd en France ?

**Passages concernés.** `/mentions-legales` ; `docs/SPEC.md` §21 ; `src/config/company.ts`.

## 8. TVA et guichet unique (OSS)

(À traiter avec un comptable autant qu'avec un juriste.)

**Contexte.** Vente de services numériques à des particuliers, prix TTC unique (2,99 € en formule A), société britannique. Le code calcule la TVA à **20 %** (provisoire) pour les chiffres d'administration seulement.

**Questions.**
1. Enregistrement au **régime non-Union du guichet unique (OSS)** pour les ventes à des consommateurs de l'UE ? Pays d'identification ? Taux par pays (France, Belgique, Luxembourg) ? Seuils ?
2. Suisse et Québec : obligations de TVA/taxes pour les ventes de services numériques depuis l'étranger ?
3. TVA britannique : seuil et enregistrement ?
4. Preuves du lieu de résidence du client (le site ne collecte aucune donnée) : le pays de la carte ou de l'adresse IP suffit-il ? Que conserver ?
5. Prix TTC unique ou prix par pays ? Mentions sur la page de paiement, reçu et facture.

**Passages concernés.** `src/config/site.ts` (`FINANCE`, `FORMULAS`) ; `docs/SPEC.md` §20.

## 9. Score indulgent et pratiques commerciales trompeuses

**Contexte.** Le **score sur 100 est volontairement flatteur** : `score = 40 + 58 × P^0,85`, plancher 40, plafond 98 ; un profil médian obtient environ 72/100. Il n'est jamais présenté comme un percentile ; les percentiles exacts sont affichés tels quels ; la formule et son caractère indulgent sont décrits publiquement dans la page « Précision et méthode ». Le site adopte un ton de « laboratoire » (« Laboratoire d'analyse biométrique », numéros de dossier décoratifs, « rapport clinique n° 8492 » sur les cartes) tout en précisant que les résultats sont des estimations statistiques et pas un avis médical. Un bandeau (réel) affiche des chiffres issus de la base, masqué sous un seuil.

**Questions.**
1. La directive 2005/29/CE, les articles L121-1 et suivants du Code de la consommation et, au Royaume-Uni, le régime des pratiques commerciales déloyales (DMCC Act 2024) : un score volontairement indulgent est-il une pratique trompeuse, malgré l'information publique sur la page de méthode ? Faut-il l'indiquer à côté du score (dans le rapport, sur la carte de partage) ?
2. Le ton « laboratoire » et les numéros de dossier décoratifs peuvent-ils induire en erreur sur la nature du service (divertissement statistique) ? Quelle mention de nature récréative, quelle place ?
3. Les « marges d'erreur » (jamais inférieures à ± 10 %, hypothèses de section circulaire, précision non validée sur de vraies photos) sont-elles correctement présentées ? Que dire, tant que la calibration n'est pas faite, des formules photo ?
4. Les commentaires de l'IA (« pas un avis médical », suggestion d'avis médical si la courbure atteint 30°) : risque lié à une présentation à valeur diagnostique ?

**Passages concernés.** `docs/SPEC.md` §5.3 ; page `/methode` (« Score global : une note calibrée, pas un percentile ») ; accueil (« Mesurez. Comparez. Quantifiez. », « Laboratoire de statistiques biométriques ») ; `SITE.tagline` (`src/config/site.ts`) ; carte de partage (`src/lib/cardImage.tsx`).

## 10. Signalement lié au filtrage d'empreintes (formules photo)

**Contexte.** Avant l'analyse, comparaison de l'empreinte de l'image avec une base d'images déjà répertoriées (PhotoDNA ; demande d'éligibilité préparée, non envoyée). Ces outils ne reconnaissent que les images déjà répertoriées et ne détectent pas l'âge. Règle de conception actuelle : « Tout contenu reconnu est détruit immédiatement, sans analyse, et les obligations légales de signalement sont respectées. » **Cette phrase est une intention : le juriste doit en définir le contenu.**

**Questions.**
1. En cas de correspondance : **obligation de signaler ?** À qui (en France : plateforme PHAROS / art. 6-I-7 LCEN ; au Royaume-Uni : National Crime Agency, obligations de l'Online Safety Act ; États-Unis : NCMEC, probablement hors champ) ? Dans quel délai ? Avec quelles informations (adresse IP hachée seulement ? hachage ? rien d'autre n'est conservé) ?
2. **Conservation vs destruction** : la détention d'un contenu pédopornographique est une infraction ; la conservation à titre de preuve est-elle exigée, tolérée ou interdite ? Que conserver (empreinte seulement, journal, IP en clair temporaire) pour pouvoir signaler sans détenir l'image ? Le service photographie des adultes : comment qualifier une correspondance et quelle responsabilité de l'éditeur ?
3. Le prestataire de filtrage signale-t-il lui-même ? Cela dispense-t-il l'éditeur ?
4. **Formulation** : nos textes ne doivent jamais prêter plus de pouvoir au filtrage qu'il n'en a (« contenus illicites bloqués », « mineurs détectés » interdits). Que peut-on dire honnêtement sur la modération dans la politique de confidentialité et la page de contact (« signalement ») ?
5. Responsabilité de l'éditeur pour les images que ce filtrage ne reconnaît pas (nouvelles images, âge non détecté) : mesures complémentaires exigées (vérification d'âge, refus si doute, journal) ?

**Passages concernés.** `docs/SPEC.md` §5 (filtrage) et §17 ; `docs/PRESTATAIRES.md` §2 ; `docs/DEMANDES/microsoft-photodna.md` ; page `/contact` (« Contact et signalement »).

---

# Section à part : la bêta gratuite, ce qui doit être validé **avant l'ouverture au public**

**Situation.** Un site de test (bêta gratuite, **formule A seulement**) tourne sur Railway, **protégé par mot de passe**, relié à aucun nom de domaine. L'ouverture au public (bitometre.com via Cloudflare) est prévue après validation. Le site refuse de s'ouvrir tant que l'identité de la Ltd n'est pas renseignée.

**À valider avant d'ouvrir (liste de contrôle pour le juriste) :**

| # | Point | Texte / mécanisme concerné | Question |
|---|---|---|---|
| B1 | **Conditions d'utilisation de la bêta** | `/conditions` (remplace les CGV) | Contenu suffisant ? Exclusions et limitation de responsabilité valides pour un consommateur ? Absence de garantie de conservation (90 jours max.) acceptable ? |
| B2 | **Politique de confidentialité de la bêta** | `/confidentialite` (version bêta) | Exhaustive ? Bases légales, durées (90 jours rapports ; IP hachée 24 h ; journal anonyme sans limite), droits sans compte, autorité de contrôle (ICO / CNIL), mention des sous-traitants (hébergeur américain en région UE) |
| B3 | **Mentions légales** | `/mentions-legales` | Conformes LCEN ? Champs à compléter : raison sociale, numéro Companies House, siège, directeur de la publication, ICO, adresse e-mail, adresse de l'hébergeur |
| B4 | **Consentement art. 9** | case ajoutée au questionnaire en bêta | Libellé et base suffisants (§3) |
| B5 | **Barrière d'âge de la formule A** | année de naissance (locale) + case | Suffisante pour l'ouverture publique, sans prestataire (§2) ? |
| B6 | **Hébergeur américain en région UE** | Railway Corporation ; accord de traitement publié par Railway | Transfert/accès hors UE (support, exploitation) ; DPA applicable ; garanties (§3, question 3 ; `docs/DEMANDES/railway.md`) |
| B7 | **Mesure d'audience maison** | événements anonymes (`funnel_events`) | Exemptée de consentement ? (§3, question 6) |
| B8 | **Cookies fonctionnels** | cookie « défi » (24 h) ; session d'administration | Exemptés ? Mentionnés correctement ? (§3, question 7) |
| B9 | **Cartes de partage publiques et défi** | `/c/…`, `/r/…/defi` | Données personnelles publiées par l'utilisateur (score, « top X % ») : information suffisante avant la création d'une carte ? Droit à l'effacement (retrait de la carte) ? Applicabilité de l'Online Safety Act (§5) |
| B10 | **Ton et score indulgent** | accueil, `/methode`, rapport | Pratiques trompeuses (§9) : mention de la nature récréative nécessaire avant l'ouverture ? |
| B11 | **Pages de guide (SEO)** | `content/seo/*.md` (non publiées) | À relire avant `SEO_PUBLISH=on` ; certaines citent des prix ou des chiffres de sources ; rédigées par le propriétaire |
| B12 | **Suppression de l'adresse de test Railway** | `*.up.railway.app` | Une fois le mot de passe retiré, elle devient publique aussi (`docs/OUVERTURE.md`) |
| B13 | **Réclamations et signalement** | `/contact` | Adresse e-mail surveillée, délai de réponse, procédure de retrait d'une carte ou d'un rapport |
| B14 | **Données déjà collectées pendant les essais** | base du site de test | Tous les rapports de test sont effacés avant l'ouverture (fait par Claude, à confirmer) |

**Recommandation de Claude (non juridique)** : ne pas retirer le mot de passe avant que B1 à B5 et B13 soient validés par écrit ; les autres peuvent être traités en parallèle de l'ouverture seulement si le juriste le confirme.
