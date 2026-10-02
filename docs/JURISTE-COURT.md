# Consultation juridique d'une heure : ouverture de la bêta gratuite

Version courte de [JURISTE.md](JURISTE.md), limitée aux points **B1 à B5 et B13** (décision du propriétaire du 02/10/2026 : l'ouverture au public de la bêta a lieu après cette consultation). Le dossier complet reste valable pour la relecture avant le passage au payant.

## À remettre au juriste avant le rendez-vous
- Ce document (2 pages) ; accès au site de test (adresse et identifiants : voir `.env`, variables `RAILWAY_TEST_*`, à transmettre par un canal sûr, pas par ce document).
- Les textes en ligne : `/conditions`, `/confidentialite`, `/mentions-legales`, `/contact`, le questionnaire `/analyse/questionnaire`, la fenêtre d'âge de l'accueil.
- **Les mentions de la Ltd doivent être complétées avant le rendez-vous** (raison sociale, numéro Companies House, siège, directeur de la publication, e-mail de contact) : sans cela, les textes contiennent des `[À COMPLÉTER]` et le site refuse de s'ouvrir.

## Le service en 8 lignes
Site français, réservé aux adultes (bitometre.com), éditeur : Ltd britannique, sans établissement en France (non immatriculé, non mentionné). **Bêta gratuite, formule A seule** : l'utilisateur saisit lui-même des mesures corporelles intimes (longueur, circonférence, courbure) ; le site calcule un score et des percentiles (étude Veale 2015) et affiche un rapport par lien privé. Aucune photo, aucun compte, aucun e-mail, aucun paiement, aucun envoi à un prestataire d'IA. Aucun contenu explicite. Rapport effacé au plus tard après 90 jours, ou sur demande immédiate. IP hachée effacée après 24 h. Mesure d'audience maison sans cookie ni IP. Cartes de partage publiques (score) et défi entre amis (scores et percentiles). Hébergeur : Railway Corporation (États-Unis), région UE.

## Plan de l'heure (60 minutes)
| Min | Point | Question centrale |
|---|---|---|
| 0-5 | Présentation | — |
| 5-20 | **B5** puis **B4** : âge et consentement | Le service est-il ouvrable avec ces garde-fous ? |
| 20-35 | **B2** et **B3** : confidentialité, mentions | Textes conformes ? champs manquants ? |
| 35-45 | **B1** : conditions de la bêta | Clauses valables ? |
| 45-55 | **B13** : réclamations et signalement | Procédure suffisante ? |
| 55-60 | Conclusion | Liste écrite des corrections avant ouverture ; ce qui peut attendre |

## B5. Barrière d'âge de la formule A (à traiter en premier : c'est le point bloquant)
**Contexte.** Aucun prestataire d'âge. Fenêtre d'accès (accueil) : année de naissance « stockée localement sur cet appareil et jamais transmise » + case « J'ai 18 ans ou plus. Je comprends que l'envoi de contenus impliquant des mineurs est un délit pénal. » ; case « J'ai 18 ans ou plus. » dans le questionnaire. Les données saisies sont des mesures intimes.
**Questions.** (1) Suffisant pour ouvrir au public, vu la nature des données ? (2) Risque si un mineur remplit le questionnaire (données sensibles d'un mineur, responsabilité de l'éditeur) ? (3) Faut-il un contrôle plus fort (prestataire d'âge) avant l'ouverture, ou la bêta peut-elle rester déclarative ? (4) La phrase sur le « délit pénal » est-elle appropriée, sachant qu'aucune image n'est envoyée en formule A ? (5) La loi SREN / le référentiel Arcom s'appliquent-ils (aucun contenu pornographique publié) ?

## B4. Consentement à l'article 9 du RGPD
**Contexte.** Case ajoutée au questionnaire, obligatoire, vérifiée côté serveur : « Je consens au traitement des valeurs que je saisis (données sensibles, RGPD art. 9) pour calculer mon rapport, comme décrit dans la politique de confidentialité. »
**Questions.** (1) Ces valeurs relèvent-elles bien de l'article 9 (santé ou vie sexuelle) ? (2) Le libellé et la case obligatoire valent-ils consentement explicite valable (conditionner le service au consentement) ? (3) Analyse d'impact (AIPD) obligatoire avant l'ouverture, et registre des traitements : contenu minimal ? (4) Autorité compétente (ICO, CNIL) et représentant dans l'UE (art. 27) nécessaire sans établissement européen ?

## B2. Politique de confidentialité de la bêta
**Contexte.** Sections : données conservées ; IP hachée 24 h ; statistiques anonymes (journal conservé sans limite : formule, score, date) ; mesure d'audience sans cookie ni IP, qui ne compte pas les visiteurs avec Do Not Track ou Global Privacy Control ; cookies fonctionnels (« défi » 24 h, session d'administration) ; aucun envoi à un prestataire d'analyse ; hébergement chez Railway Corporation (États-Unis, région UE, accès possible hors UE pour l'exploitation) ; droits sans compte (suppression par le lien du rapport, demandes par e-mail) ; ICO « enregistrement en cours ».
**Questions.** (1) Le texte est-il complet ? Manque-t-il des mentions obligatoires (bases légales, destinataires, transferts, durées) ? (2) Journal anonyme : réellement anonyme ? (3) Mesure d'audience maison et cookies : exemptés de consentement, ou bandeau nécessaire ? (4) Comment authentifier une demande d'accès ou d'effacement sans compte ? (5) Hébergeur américain en région UE : quelles garanties exiger ou mentionner (accord de traitement publié par Railway, clauses types) ? (6) ICO « en cours » : acceptable à l'ouverture ?

## B3. Mentions légales
**Contexte.** Éditeur : Ltd (raison sociale, numéro Companies House, siège, directeur de la publication, e-mail) ; ICO ; hébergeur : Railway Corporation, 548 Market St, PMB 68956, San Francisco, California 94104, États-Unis (source : ses conditions et son accord de traitement publics), données en région UE.
**Questions.** (1) Conformes à l'article 6, III de la LCEN pour un éditeur britannique sans établissement français ? (2) Mentions manquantes (capital, TVA, médiateur) ? (3) Quand et comment immatriculer l'établissement en France, et quelles conséquences (droit applicable, autorité, représentant) ?

## B1. Conditions d'utilisation de la bêta (remplacent les CGV)
**Contenu.** Service gratuit en test, aucune garantie de disponibilité ni de conservation (effacement au plus tard à 90 jours), usage réservé aux majeurs saisissant leurs propres valeurs, interdiction de nuire, version payante ultérieure avec ses propres conditions, « en l'état », droit anglais avec préservation des dispositions impératives du pays de résidence du consommateur.
**Questions.** (1) Clauses d'exclusion et de limitation de responsabilité opposables à un consommateur ? (2) Droit anglais : adapté ou risqué vis-à-vis de consommateurs de l'UE ? (3) Médiation de la consommation, juridiction : mentions à ajouter même pour un service gratuit ? (4) Tonalité « laboratoire », score volontairement indulgent (décrit sur la page « Précision et méthode ») : mention de nature récréative nécessaire avant l'ouverture ?

## B13. Réclamations et signalement
**Contexte.** Page « Contact et signalement » : une seule adresse e-mail ; pas de procédure écrite ; les cartes de partage peuvent être retirées par leur créateur ; aucune modération (aucun contenu libre n'est publié : uniquement des scores et des libellés prédéfinis).
**Questions.** (1) Quelle procédure minimale (accusé de réception, délai de réponse, retrait) ? (2) Y a-t-il une obligation de point de contact ou de mécanisme de notification (LCEN, DSA, Online Safety Act) pour ce type de service ? (3) Faut-il un contact pour les signalements de contenus illicites alors qu'aucun contenu d'utilisateur n'est publié ?

## Ce qu'on attend de la consultation
Une liste **écrite** : (a) corrections obligatoires avant l'ouverture, (b) corrections à faire avant le payant, (c) points sans objet. Claude intègre les corrections et les teste.
