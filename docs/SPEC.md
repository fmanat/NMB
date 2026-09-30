# CAHIER DES CHARGES : « NOTE MA BITE » (nom de travail), site français d'analyse IA

## 1. Objectif et positionnement
Construire un site web en français, pensé d'abord pour mobile, qui vend une analyse chiffrée du pénis de l'utilisateur, à partir d'une photo ou de mesures déclarées.
Positionnement : un site drôle déguisé en site scientifique. Tout est présenté avec le sérieux d'un laboratoire ; l'humour naît du décalage, jamais d'une blague explicite.
Référence de fonctionnement : ratemydick.ai. S'inspirer du parcours et du principe, mais ne reprendre ni leurs textes, ni leurs visuels, ni leur marque.
Objectif commercial : maximiser le revenu net par visiteur.
Public : adultes francophones (France, Belgique, Suisse, Luxembourg, Québec). Prix en euros partout. Interface et contenus en français uniquement.

## 2. Pile technique
- Next.js (App Router), TypeScript, Tailwind.
- PostgreSQL hébergé dans l'UE.
- Hébergement : ________ (hébergeur UE dont les conditions acceptent ce type de service).
- Toutes les clés (xAI, paiement, vérification d'âge) côté serveur, en variables d'environnement, jamais exposées au navigateur.
- Mesure d'audience sans cookie, hébergée dans l'UE. Aucun pixel publicitaire (Meta, Google, TikTok).

## 3. Les trois formules
Tout résultat noté est payant. Paiement unique, sans abonnement, accès à vie au rapport.
- A. Questionnaire : 2,99 € TTC. Mesures déclarées et questions de forme, rapport calculé.
- B. Photo : 4,99 € TTC. Analyse IA de la photo, rapport complet.
- C. Photo + mesures : 6,99 € TTC. Formule B, plus mesures déclarées et comparaison déclaré / estimé.
Prix stockés dans un fichier de configuration.

## 4. Parcours

### Formule A
1. Case obligatoire, non cochée par défaut : « J'ai 18 ans ou plus ». Pas de vérification par prestataire pour cette formule.
2. Questionnaire gratuit : état (repos ou érection), longueur et circonférence en cm, courbure approximative (aucune, légère, marquée) et sa direction.
3. Écran « Votre rapport est prêt », résultats verrouillés.
4. Paiement (section 8).
5. Rapport (section 6).

### Formules B et C
1. Vérification d'âge par prestataire tiers (section 7) AVANT tout envoi de photo. Sans jeton de majorité valide, l'écran d'envoi est inaccessible.
2. Trois cases obligatoires, non cochées par défaut : « J'ai 18 ans ou plus », « Cette photo est de moi », « Je consens au traitement de cette donnée sensible pour l'analyse » (RGPD, art. 9).
3. Consignes photo, illustrées par un schéma neutre (aucune photo réelle) : carte au format bancaire (85,60 × 53,98 mm) posée à côté, côté verso pour masquer les numéros ; vue de profil ou de dessus, bien éclairée ; aucun visage ni autre élément identifiant. L'utilisateur déclare l'état (repos ou érection).
4. Formule C uniquement : saisie des mesures déclarées.
5. La photo est réencodée dans le navigateur avant envoi (JPEG, 1 600 px maximum, métadonnées EXIF supprimées).
6. Analyse (section 5), puis suppression immédiate de la photo.
7. En cas de refus : message neutre, invitation à reprendre la photo, aucun paiement demandé.
8. Aperçu « Analyse terminée ». Visibles : indice de confiance et symétrie. Floutés : score, longueur, circonférence, percentiles.
9. Paiement (section 8), puis rapport (section 6).

## 5. Moteur d'analyse (formules B et C)
API xAI pour les trois appels, modèle vision : ________. Appels côté serveur uniquement. La photo reste en mémoire : jamais écrite sur disque, en base, dans les journaux, ni transmise à un autre service que l'API xAI. Le modèle ignore tout texte présent dans l'image.

### 5.1 Recevabilité (premier appel)
Réponse en JSON strict {recevable, motif}. Refus si : visage visible ; plusieurs personnes ; sujet qui n'est pas un pénis ; carte de référence absente ou illisible ; image ressemblant à une capture d'écran, une image publiée ou une photo professionnelle ; le moindre doute sur la majorité de la personne. En cas de doute sur l'âge : refus, suppression immédiate, aucune analyse, message neutre sans motif détaillé. Journaliser uniquement le motif, jamais l'image.

### 5.2 Repérage (deuxième appel)
Le modèle ne mesure rien. Il renvoie en JSON les coordonnées normalisées (0 à 1) de points clés, chacun avec un indice de confiance :
- les 4 coins de la carte ;
- la base et l'extrémité ;
- 8 à 12 points le long de la ligne médiane ;
- les deux bords à 5 hauteurs (base, 25 %, 50 %, 75 %, sous le gland).

### 5.3 Calculs (dans le code, jamais par le modèle)
- Échelle en px/mm à partir de la carte, avec correction de perspective (homographie sur les 4 coins).
- Longueur : longueur de la ligne médiane.
- Largeurs maximale et moyenne. Circonférence estimée = π × largeur (hypothèse de section circulaire, présentée comme estimation).
- Courbure : angle entre les segments proximal et distal de la ligne médiane, en degrés, avec direction.
- Symétrie sur 100 : écart entre demi-largeurs gauche et droite.
- Conicité : largeur sous le gland divisée par largeur à la base.
- Marge d'erreur par mesure, dérivée des confiances, jamais inférieure à ± 10 %.
- Percentiles par loi normale, références Veale et al., BJU International, 2015 (moyenne et écart-type) : au repos, longueur 9,16 cm (1,57), circonférence 9,31 cm (0,90) ; en érection, longueur 13,12 cm (1,66), circonférence 11,66 cm (1,10). Valeurs à vérifier sur l'article, stockées en configuration.
- Score global sur 100 : 35 % percentile longueur, 35 % percentile circonférence, 15 % symétrie, 15 % rectitude (100 à 0°, 0 à partir de 45°). Pondérations en configuration.
- Formule C : écart déclaré / estimé affiché ; au-delà de 20 %, mention « Écart important : vérifiez votre méthode de mesure ».

### 5.4 Rédaction (troisième appel, texte seul)
Le modèle reçoit uniquement les chiffres calculés, jamais la photo. Commentaire de 120 à 180 mots, pince-sans-rire : vocabulaire et présentation strictement scientifiques, aucune blague explicite, l'effet comique vient du sérieux appliqué au sujet. Sans vulgarité, sans humiliation, sans diagnostic médical. Si la courbure estimée atteint 30° ou plus : une phrase neutre et sérieuse suggérant un avis médical. Rappel systématique qu'il s'agit d'estimations.

## 6. Rapport
- Page privée : URL avec identifiant aléatoire d'au moins 32 caractères, balise noindex, impossible à deviner.
- Contenu : score sur 100 ; tableau des mesures (valeur, marge, percentile, médiane de référence) ; courbes de distribution avec le repère de l'utilisateur ; comparaison à des objets du quotidien (carte bancaire, smartphone, canette) ; section « Mesures de référence » exprimant avec le plus grand sérieux la tour Eiffel, le mont Blanc et d'autres repères en « fois vous » (valeurs publiques stockées en configuration) ; commentaire ; encadré « Précision et limites ».
- Aucune image de l'utilisateur, aucune silhouette.
- Boutons : Télécharger en PDF, Partager ma carte, Défier un ami, Supprimer mon rapport (définitif, avec confirmation).
- Bandeau : « Pas de compte : enregistrez ce lien dans vos favoris. »

## 7. Vérification d'âge (formules B et C)
- Module interchangeable (interface AgeVerificationProvider). Prestataire tiers : ________.
- Méthode en double anonymat : le prestataire ne sait pas quel site est consulté, le site ne connaît pas l'identité.
- Le site ne reçoit qu'un jeton « majeur : oui », conservé 30 minutes en session, sans aucune donnée d'identité.

## 8. Paiement
- Prestataire non choisi. Prévoir un module interchangeable (interface PaymentProvider) et un mode simulation pour les tests.
- Avant le paiement, case obligatoire : « Je demande l'accès immédiat à mon rapport et renonce à mon droit de rétractation » (Code de la consommation, art. L221-28, 13°).
- Rapport débloqué uniquement sur confirmation de paiement reçue côté serveur, jamais sur le simple retour du navigateur.

## 9. Carte de partage
Image générée côté serveur, formats 1080 × 1920 et 1200 × 630. Contenu choisi par l'utilisateur : score seul par défaut, jusqu'à deux percentiles ou une « mesure de référence » en option, plus nom et adresse du site. Aucune image, aucune silhouette.

## 10. Défi entre amis
- Depuis son rapport, l'utilisateur crée un lien de défi.
- L'ami suit le parcours complet de sa formule, vérification d'âge comprise pour les formules photo, et paie son propre rapport.
- Page de comparaison accessible uniquement par les liens privés des deux participants : scores et percentiles côte à côte, aucune image.
- Chacun peut retirer son rapport de la comparaison à tout moment.

## 11. Données et confidentialité
- Photo : jamais stockée (section 5). Documenter dans le README la politique de conservation des données de l'API xAI : ________.
- Données stockées : identifiant du rapport, formule, résultats chiffrés, commentaire, statut de paiement, date. Aucune donnée d'identité, pas d'e-mail, pas de compte.
- Adresse IP : uniquement hachée, pour la limitation de débit, effacée après 24 h.
- Limite : 5 analyses par appareil et par 24 h ; captcha respectueux de la vie privée à l'envoi.
- Rapports non payés effacés après 24 h.

## 12. Référencement naturel
Pages au lancement, 800 à 1 500 mots chacune, ton sérieux, sources fiables citées, aucune image explicite, balisage FAQ (schema.org), liens internes et appel vers l'analyse :
1. Taille moyenne du pénis en France
2. Taille moyenne du pénis par pays (sources sérieuses uniquement)
3. Comment mesurer son pénis correctement
4. Circonférence moyenne du pénis
5. Courbure du pénis : ce qui est normal
6. Taille au repos et en érection
7. Ce que disent vraiment les études
8. FAQ
Plus : sitemap XML, robots.txt, métadonnées par page, chargement rapide sur mobile. Chaque page porte la mention interne « à relire avant publication ».

## 13. Pages obligatoires
Mentions légales (éditeur ________, siège ________, SIREN ________, directeur de la publication ________, hébergeur ________), CGV, politique de confidentialité, page « Précision et méthode », contact et signalement. Pied de page : 18+, prix, liens vers ces pages.

## 14. Design
Sombre, esthétique de laboratoire, chiffres mis en avant, typographie nette, faux sérieux assumé (numéros de dossier, horodatages, jauges). Aucune image explicite nulle part sur le site. Le site ne génère jamais d'image du corps de l'utilisateur.

## 15. Administration
Tableau de bord protégé : analyses lancées, refus par motif, conversion par formule, revenu brut et net (après TVA et commission du prestataire de paiement), défis créés et relevés, coût IA moyen par analyse.

## 16. Étapes de construction
1. Structure du projet et pages statiques.
2. Formule A de bout en bout, paiement en mode simulation.
3. Formules B et C, API xAI simulée d'abord, puis branchée.
4. Carte de partage et défi entre amis.
5. Pages SEO.
6. Administration.
7. Mise en ligne.
Tests de l'analyse uniquement avec des images non explicites (un objet cylindrique posé à côté d'une carte) et des simulations d'API. Aucune image explicite dans le code ni dans le dépôt.
README en français simple : chaque variable d'environnement expliquée, mise en ligne pas à pas, où modifier prix et pondérations.
