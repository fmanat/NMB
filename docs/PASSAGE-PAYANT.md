# Feuille de route : passer la formule A de la bêta gratuite au payant

Liste **ordonnée** de tout ce qu'il faut. Pour chaque étape : **qui** la fait (**vous** = le propriétaire ; **moi** = Claude ; **juriste**, **prestataire** = tiers), **ce dont elle dépend**, et **le délai habituel**.

**Les délais sont des ordres de grandeur fondés sur l'expérience courante de ce type de démarche, pas des engagements ni des chiffres vérifiés auprès des organismes** (sauf mention contraire). Le chemin critique est en gras.

Périmètre : **formule A seule** (questionnaire, 2,99 € TTC, aucune photo). Les formules B et C ont leur propre liste, à la fin.

## Vue d'ensemble

| # | Étape | Qui | Dépend de | Délai habituel |
|---|---|---|---|---|
| 1 | Informations de la Ltd dans le site | vous, puis moi | — | 1 jour |
| 2 | **Choisir et mandater un juriste** | vous | — | 1 à 3 semaines |
| 3 | Compte bancaire professionnel de la Ltd | vous | 1 | 1 à 4 semaines |
| 4 | **Demande Verotel** (et repli CCBill / Segpay) | vous (message prêt : moi) | 1, 2 pour les textes | **2 à 8 semaines** (conformité, contrat) |
| 5 | TVA : enregistrement et guichet unique | vous + comptable | 1, 3 | 2 à 6 semaines |
| 6 | **Relecture juridique complète** | juriste | 2 | **2 à 6 semaines** |
| 7 | **Sauvegardes quotidiennes de la base, vérifiées** (obligatoire avant tout paiement) | moi (accord de coût : vous) | — | 1 jour |
| 8 | Plafond de dépense et alertes (Railway) | vous | — | 15 minutes |
| 9 | Brancher Verotel en mode test, vérifier tous les points « À CONFIRMER » | moi | 4 (identifiants de test) | 1 à 3 jours |
| 10 | Mettre à jour les textes et réglages payants (CGV, commission, TVA) | moi, avec le juriste | 5, 6, 9 | 1 à 3 jours |
| 11 | Domaine bitometre.com et ouverture publique de la bêta | vous (pas à pas : `docs/OUVERTURE.md`) | 1, 6 (section bêta de `docs/JURISTE.md`) | 1 jour + propagation |
| 12 | Procédures de support, remboursement, contestation | vous + moi | 4 | 2 à 3 jours |
| 13 | Essai réel de bout en bout (achat, remboursement) | vous | 7, 9, 10 | 1 jour |
| 14 | Bascule : retirer `FREE_BETA`, redéployer, vérifier | moi, validation : vous | 6, 7, 10, 13 | 1 heure |
| 15 | Surveillance de la première semaine | moi + vous | 14 | 1 semaine |

**Chemin critique réaliste : 6 à 10 semaines**, dominé par le prestataire de paiement (4), le juriste (6) et la TVA (5), qui peuvent avancer en parallèle si les étapes 1 et 2 démarrent tout de suite.

## Détail des étapes

### 1. Informations de la Ltd dans le site
- **Vous** me donnez : raison sociale, numéro Companies House, adresse du siège, nom du directeur de la publication, numéro d'enregistrement ICO, adresse e-mail de contact (boîte relevée chaque jour), adresse de Railway Corporation (à relever sur railway.com/legal).
- **Moi** : je les inscris dans `src/config/company.ts`, je redéploie. Tant qu'un `[À COMPLÉTER]` subsiste, le site refuse de s'ouvrir sans mot de passe (503).
- Ne mentionner l'établissement en France qu'**après son immatriculation**.

### 2. Choisir et mandater un juriste
- **Vous.** Profil : droit du numérique, protection des données (RGPD et UK GDPR), consommation, idéalement habitué aux sociétés britanniques opérant vers la France. Le dossier à lui remettre est prêt : `docs/JURISTE.md`.

### 3. Compte bancaire professionnel de la Ltd
- **Vous.** Nécessaire pour les versements du prestataire de paiement. Beaucoup de banques en ligne exigent une activité clairement décrite : le site relève d'un secteur sensible, annoncer la nature du service dès l'ouverture évite une clôture ultérieure.

### 4. Demande Verotel (et repli)
- **Vous** envoyez le message de `docs/DEMANDES/verotel.md` (relu, complété) ; **moi**, je prépare en parallèle la lecture des conditions de **CCBill** et **Segpay** (non lues à ce jour) pour pouvoir basculer sans perdre de temps.
- Dépend de : informations de la Ltd (1), compte bancaire (3, pour la signature finale).
- **Risques connus** (voir `docs/PRESTATAIRES.md`) : FlexPay réservé au compte Premium, qui demande six mois de relevés de traitement ; vente de « contenu » soumise à accord écrit (art. 4 du contrat type) ; aucune clause sur les sociétés britanniques ; retenue de 10 % pendant 26 semaines ; résiliation possible sans motif.
- **Décision à prendre selon la réponse** : accepter la retenue et les frais, ou passer au repli.

### 5. TVA
- **Vous + comptable.** Vente de services numériques à des particuliers de plusieurs pays (France, Belgique, Luxembourg dans l'Union ; Suisse et Québec hors Union) : la TVA ne se calcule pas au taux français pour tous. Questions à poser au comptable : enregistrement au **régime non-Union du guichet unique (OSS)** pour les ventes à des consommateurs de l'Union, traitement de la Suisse et du Québec, taux appliqués, seuils, facturation ou reçu, tenue des justificatifs de pays de résidence du client (le site n'en collecte aucun aujourd'hui). Le code applique **un seul taux de 20 %** pour les calculs d'administration (`FINANCE.vatRate`) : valeur provisoire. **Je n'ai pas vérifié la réglementation fiscale applicable ; ceci n'est pas un avis fiscal.**
- Impact technique possible : prix TTC unique (2,99 €) mais TVA différente selon le pays ; décision commerciale à prendre (prix unique ou prix selon le pays).

### 6. Relecture juridique complète (obligatoire avant le payant)
- **Juriste.** Périmètre : tous les textes (CGV, conditions de la bêta, confidentialité, mentions légales, méthode, FAQ, pages de guide), la clause de renonciation au droit de rétractation, les parcours (cases à cocher, consentement RGPD art. 9), le transfert vers xAI (pour les formules photo), la loi SREN et l'Arcom, les obligations de signalement, le droit applicable. Questions précises : `docs/JURISTE.md`.
- À la fin : les textes corrigés me sont remis, je les intègre et les teste.

### 7. Sauvegardes quotidiennes de la base, **vérifiées** : ÉTAPE OBLIGATOIRE AVANT TOUT PAIEMENT
**Pourquoi** : dès le premier paiement, la base contient des paiements (obligations comptables) et des rapports que des clients ont achetés. Une perte de base sans sauvegarde = clients payés sans rapport, comptabilité manquante, obligations légales non tenues. **État au 02/10/2026 : sauvegarde quotidienne et restauration à un instant donné activées, restauration testée avec succès sur un service séparé** (voir `docs/RAILWAY.md`). Restent à faire : constater deux sauvegardes quotidiennes successives, la copie hors Railway, et fixer la durée de conservation (6 jours actuellement).
- **Moi** (avec votre accord sur le coût, car les sauvegardes consomment du stockage facturé) :
  1. Activer les **sauvegardes automatiques quotidiennes** du volume de la base dans Railway (tableau de bord → service Postgres → onglet « Backups » → planification quotidienne ; ou, selon l'offre, `railway postgres pitr` pour la restauration à un instant donné, qui demande un stockage objet associé).
  2. **Vérifier qu'elles fonctionnent** : constater au moins deux sauvegardes quotidiennes successives datées (une sauvegarde jamais testée n'en est pas une).
  3. **Tester une restauration** : restaurer une sauvegarde dans un **nouveau** service Postgres (jamais par-dessus la base en service), puis comparer : nombre de lignes de `reports`, `payments`, `report_log` ; dernière migration appliquée ; ouvrir un rapport de test. Noter la date et le résultat dans `docs/SESSION-NUIT-3.md` (ou le journal suivant).
  4. Fixer la **durée de conservation** des sauvegardes et la mentionner dans la politique de confidentialité si elle contient des données personnelles (juriste : les sauvegardes contiennent les rapports supprimés pendant leur durée de vie).
  5. Prévoir une **copie hors de Railway** (export chiffré périodique de la base vers un stockage que vous contrôlez) : une sauvegarde chez le même hébergeur ne protège pas d'une suspension de compte.
- **Critère d'acceptation** (sans lui, pas de paiement) : sauvegarde quotidienne active **et** restauration testée avec succès **et** date du test inscrite.
- Délai : 1 jour. À répéter après chaque changement majeur d'hébergement.

### 8. Plafond de dépense et alertes
- **Vous** : Railway → Settings → Usage → définir une limite dure (par exemple 20 $) et une alerte ; relever une adresse de contact surveillée pour les incidents. Un service de surveillance externe (ping de `/api/health` toutes les 5 minutes avec alerte par e-mail) est conseillé.

### 9. Brancher Verotel en mode test
- **Moi**, dès réception des identifiants de test : variables `PAYMENT_PROVIDER=verotel`, `VEROTEL_SHOP_ID`, `VEROTEL_SIGNATURE_KEY`, adresse de notification déclarée chez Verotel (`SITE_URL/api/payments/webhook`). Vérifier en mode test les points « À CONFIRMER » de `src/lib/payments/verotel.ts` : événement d'une vente unique, noms des paramètres de montant et de devise, présence de `referenceID` dans les remboursements, format de signature, adresse de retour. Corriger l'adaptateur et ses tests si la réalité diffère.
- Tester : achat, refus de carte, remboursement (rapport reverrouillé), contestation, notification rejouée.
- Le site de test (mot de passe) reste en place pendant ces essais : `/api/payments/webhook` est **déjà** joignable sans identifiants dès que `PAYMENT_PROVIDER=verotel` (exception de `src/lib/siteGate.ts`, limitée à ce chemin ; la signature de Verotel est vérifiée avant tout accès à la base). Contrainte : il faut retirer `FREE_BETA` (qui masque ce chemin) sur le site d'essai.

### 10. Textes et réglages payants
- **Moi + juriste** : retirer la bêta (voir étape 14), activer `/cgv` (les conditions de la bêta disparaissent), afficher les prix, la case de renonciation, mettre à jour la commission réelle (`FINANCE.paymentFeeRate`, 12 % provisoire contre 15,5 % affichés pour le compte Basic de Verotel), le taux de TVA, le numéro et les mentions du prestataire de paiement, le libellé qui apparaîtra sur le relevé bancaire du client.
- La politique de confidentialité payante doit citer Verotel, le cookie fonctionnel `nmb_pay` et la durée de conservation des paiements.
- Les rapports créés pendant la bêta restent accessibles (déjà débloqués) jusqu'à leur purge à 90 jours : décision à prendre (les laisser expirer, ou les purger à la bascule).

### 11. Domaine et ouverture publique de la bêta
- **Vous**, pas à pas : `docs/OUVERTURE.md`. Préalable : étape 6 (au moins la section « bêta gratuite » de `docs/JURISTE.md` validée). Cette étape peut précéder le payant : la bêta publique est une étape intermédiaire utile (elle fait tourner l'entonnoir de conversion).

### 12. Support, remboursement, contestation
- **Vous + moi** : adresse e-mail de support surveillée ; procédure écrite : qui rembourse (Control Center de Verotel), délai de réponse, texte de réponse type ; suivi du taux de contestations (au-delà de 1 % de contestations, Verotel applique une majoration de 2,5 % selon sa grille publique).
- Le site reverrouille automatiquement un rapport remboursé ou contesté (testé) ; l'administration affiche les remboursements.

### 13. Essai réel de bout en bout
- **Vous** : acheter vous-même un rapport à 2,99 € avec votre carte, vérifier le déblocage, le PDF, le reçu, puis demander un remboursement et vérifier le reverrouillage.

### 14. Bascule
- **Moi** : retirer `FREE_BETA` (variable Railway), vérifier que `/cgv` répond et que `/conditions` disparaît, que les prix s'affichent, que le paiement redirige vers Verotel ; relancer `npm run e2e:remote` adapté ; **vous** validez avant l'annonce.
- Retour arrière : remettre `FREE_BETA=on` (1 à 2 minutes).

### 15. Surveillance de la première semaine
- Entonnoir de l'administration (aperçu verrouillé → paiement lancé → payé), remboursements, contestations, erreurs du journal Railway, coût Railway réel, avis des premiers clients.

## Formules B et C (photo) : après la formule A

Chacune bloque l'ouverture des formules photo, **pas** celle de la formule A :

| Étape | Qui | Délai habituel |
|---|---|---|
| Vérification d'âge : AgeVerif et Yoti en parallèle, réponses écrites, critère d'indépendance (`docs/DEMANDES/ageverif.md`, `yoti.md`) ; adaptateur Yoti à écrire s'il est retenu | vous, puis moi | 2 à 6 semaines |
| Filtrage d'empreintes : éligibilité PhotoDNA (`docs/DEMANDES/microsoft-photodna.md`) ; adaptateur à écrire après accès à la documentation ; signalement tranché par le juriste | vous, juriste, puis moi | 4 à 12 semaines (accès sur approbation) |
| xAI : Zero Data Retention activé et confirmé par écrit, accord de traitement signé (`docs/DEMANDES/xai.md`) | vous | 1 à 3 semaines |
| Confirmation écrite de Railway pour les formules photo (`docs/DEMANDES/railway.md`) | vous | 1 à 2 semaines |
| Calibration de la précision avec des photos réelles (`docs/CALIBRATION.md`) | vous (prises de vue), moi | 1 semaine |
| ALTCHA : essai avec le composant officiel ou captcha de repli | moi | 1 jour |
| Verotel : accord écrit pour la vente des formules photo (le message de `docs/DEMANDES/verotel.md` annonce que ces offres ne s'ouvriront qu'avec son accord) | vous | avec la réponse de l'étape 4 |
