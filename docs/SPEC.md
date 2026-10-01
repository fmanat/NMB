# CAHIER DES CHARGES : « BITOMÈTRE » (bitometre.com), site français d'analyse IA

Source de référence unique. Le dépôt garde le nom de travail NMB.

## 1. Objectif et positionnement
Construire un site web en français, pensé d'abord pour mobile, qui vend une analyse chiffrée du pénis de l'utilisateur, à partir d'une photo ou de mesures déclarées.
Nom de marque et de domaine : Bitomètre (bitometre.com).
Positionnement : un site drôle déguisé en site scientifique. Tout est présenté avec le sérieux d'un laboratoire ; l'humour naît du décalage, jamais d'une blague explicite. Ton pseudo-scientifique, clinique, technologique, zéro vulgarité dans l'interface.
Le code et les libellés restent fidèles au service réel : aucune présentation trompeuse du service auprès des prestataires (paiement, hébergement, vérification d'âge).
Référence de fonctionnement : ratemydick.ai. S'inspirer du parcours et du principe, mais ne reprendre ni leurs textes, ni leurs visuels, ni leur marque.
Objectif commercial : maximiser le revenu net par visiteur.
Public : adultes francophones (France, Belgique, Suisse, Luxembourg, Québec). Prix en euros partout. Interface et contenus en français uniquement.

## 2. Pile technique
- Next.js (App Router), TypeScript, Tailwind.
- PostgreSQL hébergé dans l'UE.
- Hébergement : **Railway** (région UE), service Next.js et base PostgreSQL Railway (décision du propriétaire, session de nuit n° 3, en remplacement de Clever Cloud). DNS de bitometre.com géré par **Cloudflare**. Voir docs/HEBERGEMENT.md et docs/OUVERTURE.md.
- Toutes les clés (xAI, paiement, vérification d'âge) côté serveur, en variables d'environnement, jamais exposées au navigateur.
- Mesure d'audience sans cookie, hébergée dans l'UE. Aucun pixel publicitaire (Meta, Google, TikTok).

## 3. Les trois formules
Tout résultat noté est payant. Paiement unique, sans abonnement, rapport accessible pendant au moins 3 ans (valeur `REPORT_ACCESS.minYears` dans la configuration, reportée dans les CGV, la FAQ et le paiement) et téléchargeable en PDF à tout moment. (Décision du propriétaire, session de nuit : remplace « accès à vie ».)
- A. Questionnaire : 2,99 € TTC. Mesures déclarées et questions de forme, rapport calculé.
- B. Photo : 4,99 € TTC. Analyse IA de la photo, rapport complet.
- C. Photo + mesures : 6,99 € TTC. Formule B, plus mesures déclarées et comparaison déclaré / estimé.
Prix stockés dans un fichier de configuration (src/config/site.ts). Aucun prix barré promotionnel.

## 4. Parcours

### Étape commune : fenêtre d'âge (toutes formules)
Au clic sur le bouton de scan : fenêtre modale demandant l'année de naissance (AAAA) et une case obligatoire confirmant la majorité et la compréhension des implications pénales liées aux mineurs. Mention : « Votre année est stockée localement sur cet appareil et n'est jamais transmise. » C'est une première barrière ; elle ne remplace pas la vérification par prestataire des formules photo (section 7).

### Formule A
1. Case obligatoire, non cochée par défaut : « J'ai 18 ans ou plus ». Pas de vérification par prestataire pour cette formule : elle ne reçoit aucune photo.
2. Questionnaire gratuit : état (repos ou érection), longueur et circonférence en cm, courbure approximative (aucune, légère, marquée) et sa direction.
3. Écran « Votre rapport est prêt », résultats verrouillés.
4. Paiement (section 8).
5. Rapport (section 6).

### Formules B et C
1. Vérification d'âge par prestataire tiers (section 7) AVANT tout envoi de photo. Sans jeton de majorité valide, l'écran d'envoi est inaccessible.
2. Trois cases obligatoires, non cochées par défaut : « J'ai 18 ans ou plus », « Cette photo est de moi », « Je consens au traitement de cette donnée sensible pour l'analyse, et à son envoi à un prestataire situé aux États-Unis qui la conserve 30 jours » (RGPD, art. 9 et art. 49).
3. Consignes photo, illustrées par un schéma neutre (aucune photo réelle) : carte au format bancaire (85,60 × 53,98 mm) posée à côté, côté verso pour masquer les numéros ; vue de profil ou de dessus, bien éclairée ; aucun visage ni autre élément identifiant. L'utilisateur déclare l'état (repos ou érection).
4. Formule C uniquement : saisie des mesures déclarées.
5. La photo est réencodée dans le navigateur avant envoi (JPEG, 1 600 px maximum, métadonnées EXIF supprimées).
6. Analyse (section 5), puis suppression immédiate de la photo. L'écran d'analyse n'affiche que les étapes réellement exécutées, sous des libellés techniques (« Contrôle de recevabilité », « Calibration sur la carte de référence », « Extraction de la ligne médiane », « Calcul des percentiles »). Aucune étape fictive.
7. En cas de refus : message neutre, invitation à reprendre la photo, aucun paiement demandé.
8. Aperçu « Analyse terminée ». Visibles : indice de confiance et symétrie. Floutés : score, longueur, circonférence, percentiles.
9. Paiement (section 8), puis rapport (section 6).

## 5. Moteur d'analyse (formules B et C)
API xAI pour les trois appels, modèle vision : ________. Appels côté serveur uniquement. La photo reste en mémoire : jamais écrite sur disque, en base, dans les journaux, ni transmise à un autre service que l'API xAI et au service de filtrage de contenus illicites ci-dessous. Destruction immédiate du fichier source après extraction. Le modèle ignore tout texte présent dans l'image.
Filtrage de contenus illicites connus : uniquement par comparaison d'empreintes avec les bases d'images déjà répertoriées (type PhotoDNA ou Safer), en pré-traitement avant l'analyse. Décision : **demande d'éligibilité à PhotoDNA** (Microsoft) ; l'obligation et les modalités de **signalement** sont **à trancher par le juriste** (docs/JURISTE.md). Prestataire : à confirmer. Limites à respecter partout : ces outils reconnaissent des images déjà répertoriées, pas les nouvelles ; ils ne détectent pas l'âge d'une personne et ne remplacent en aucun cas la vérification d'âge (section 7). Aucun texte du site (pages, badges, CGV, confidentialité, méthode) ne doit leur prêter davantage : pas de formule du type « contenus illicites bloqués » ou « mineurs détectés ». Tout contenu reconnu est détruit immédiatement, sans analyse, et les obligations légales de signalement sont respectées.

### 5.1 Recevabilité (premier appel)
Réponse en JSON strict {recevable, motif}. Refus si : visage visible ; plusieurs personnes ; sujet qui n'est pas un pénis ; carte de référence absente ou illisible ; image ressemblant à une capture d'écran, une image publiée ou une photo professionnelle ; le moindre doute sur la majorité de la personne. En cas de doute sur l'âge : refus, suppression immédiate, aucune analyse, message neutre sans motif détaillé. Journaliser uniquement le motif, jamais l'image.

### 5.2 Repérage (deuxième appel)
Le modèle ne mesure rien. Il renvoie en JSON les coordonnées normalisées (0 à 1) de points clés, chacun avec un indice de confiance :
- les 4 coins de la carte ;
- la base et l'extrémité ;
- 8 à 12 points le long de la ligne médiane ;
- les deux bords à 5 hauteurs (base, 25 %, 50 %, 75 %, sous le gland).

### 5.3 Calculs (dans le code, jamais par le modèle)
- Échelle et pose de l'appareil à partir de la carte (focale typique supposée, voir section 22) ; les dimensions sont calculées dans l'espace, pas dans le plan de la carte.
- Longueur : longueur de la ligne médiane.
- Largeurs maximale et moyenne. Circonférence estimée = π × largeur (hypothèse de section circulaire, présentée comme estimation).
- Courbure : angle entre les segments proximal et distal de la ligne médiane, en degrés, avec direction.
- Symétrie sur 100 : écart entre demi-largeurs gauche et droite.
- Conicité : largeur sous le gland divisée par largeur à la base.
- Marge d'erreur par mesure, dérivée des confiances, jamais inférieure à ± 10 %.
- Percentiles par loi normale, références Veale et al., BJU International, 2015 (moyenne et écart-type) : au repos, longueur 9,16 cm (1,57), circonférence 9,31 cm (0,90) ; en érection, longueur 13,12 cm (1,66), circonférence 11,66 cm (1,10). Valeurs à vérifier sur l'article, stockées en configuration.
- Score global sur 100 (note de présentation à biais flatteur) : `Score = 40 + 58 × P^0,85`, où P (entre 0 et 1) est la moyenne pondérée de : 35 % percentile longueur, 35 % percentile circonférence, 15 % symétrie, 15 % rectitude (100 à 0°, 0 à partir de 45°), chacune ramenée entre 0 et 1. Plancher 40, plafond 98, score médian visé d'environ 72. Tous les paramètres sont en configuration. Les percentiles exacts sont affichés tels quels ; le score n'est jamais présenté comme un percentile. La page « Précision et méthode » décrit publiquement cette formule et son caractère indulgent.
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
- Décision : prestataire tiers obligatoire pour B et C, en plus de la fenêtre d'âge (année de naissance) qui reste la première barrière. L'année de naissance seule ne suffit jamais pour l'envoi d'une photo.
- Module interchangeable (interface AgeVerificationProvider). Prestataire tiers : demandes envoyées **en parallèle à AgeVerif et à Yoti**, décision sur **réponses écrites**. Critère principal : **l'indépendance vis-à-vis des exploitants de sites pour adultes** (voir docs/PRESTATAIRES.md).
- Méthode en double anonymat : le prestataire ne sait pas quel site est consulté, le site ne connaît pas l'identité.
- Le site ne reçoit qu'un jeton « majeur : oui », conservé 30 minutes en session, sans aucune donnée d'identité.

## 8. Paiement
- **Stripe est exclu définitivement** (décision du propriétaire). Prestataire visé : **Verotel**, avec **CCBill** ou **Segpay** en repli ; à choisir en décrivant le service tel qu'il est. Module interchangeable (interface PaymentProvider) et mode simulation pour les tests. L'adaptateur Stripe reste dans le code, désactivé, sans être supprimé.
- Affichage prioritaire d'Apple Pay et Google Pay (check-out en un clic) si le prestataire les supporte. Paiement unique, aucun abonnement, aucun prix barré.
- Avant le paiement, case obligatoire : « Je demande l'accès immédiat à mon rapport et renonce à mon droit de rétractation » (Code de la consommation, art. L221-28, 13°).
- Rapport débloqué uniquement sur confirmation de paiement reçue côté serveur, jamais sur le simple retour du navigateur.

## 9. Carte de partage
Le partage crée une URL publique distincte (`/c/identifiant`) qui n'affiche que le contenu de la carte choisie, avec une image Open Graph générée à la volée (ex. « Rapport clinique n° 8492 : top 12 % »). L'URL privée du rapport garde une image OG neutre, sans score, pour éviter les fuites lors de copiés-collés accidentels.
Image générée côté serveur, formats 1080 × 1920 et 1200 × 630. Contenu choisi par l'utilisateur : score seul par défaut, jusqu'à deux percentiles ou une « mesure de référence » en option, plus nom et adresse du site. Aucune image, aucune silhouette.

## 10. Défi entre amis
- Depuis son rapport, l'utilisateur crée un lien de défi.
- L'ami suit le parcours complet de sa formule, vérification d'âge comprise pour les formules photo, et paie son propre rapport.
- Page de comparaison accessible uniquement par les liens privés des deux participants : scores et percentiles côte à côte, aucune image.
- Chacun peut retirer son rapport de la comparaison à tout moment.

## 11. Données et confidentialité
- Photo : jamais stockée chez nous (section 5). Politique de conservation de l'API xAI (documentation officielle consultée le 30/09/2026) : par défaut, requêtes et réponses, images comprises, conservées 30 jours sur serveurs chiffrés pour audit d'abus, sans entraînement sur ces données ; l'option Zero Data Retention (ZDR) les supprime, activable par l'administrateur de l'équipe dans la console xAI, au niveau de toute l'équipe, avec des fonctions désactivées (API Responses avec état, Files, Collections, Batch). Conséquences : (1) tant que ZDR n'est pas activé, le badge dit « Photo jamais stockée par Bitomètre » et la politique de confidentialité mentionne la conservation de 30 jours chez xAI (le badge d'origine sera rétabli si ZDR est activé) ; (2) utiliser l'endpoint sans état /v1/chat/completions ; (3) xAI est un prestataire hors UE : prévoir l'information RGPD sur le transfert hors UE et un accord de traitement des données (DPA).
- Données stockées : identifiant du rapport, formule, résultats chiffrés, commentaire, statut de paiement, date. Aucune donnée d'identité, pas d'e-mail, pas de compte.
- Adresse IP : uniquement hachée, pour la limitation de débit, effacée après 24 h.
- Limite : 5 analyses par appareil et par 24 h ; captcha respectueux de la vie privée à l'envoi : **ALTCHA auto-hébergé**, **Friendly Captcha en repli**.
- Rapports non payés effacés après 24 h.

## 12. Référencement naturel
Pages au lancement, 600 à 1 500 mots chacune (cible ajustée le 01/10/2026, sans rallonge artificielle), ton sérieux, sources fiables citées, aucune image explicite, balisage FAQ (schema.org), liens internes et appel vers l'analyse :
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
Thème « Dark Tech / IA cybersécurité » : fond noir/anthracite, chiffres en monospace, texte en sans-serif géométrique, accents bleu électrique et jaune/orange radar. Grilles de fond, jauges circulaires, faux sérieux assumé (numéros de dossier, horodatages). Aucune image explicite nulle part sur le site, aucune modélisation du corps (décor abstrait uniquement). Le site ne génère jamais d'image du corps de l'utilisateur.
- Bandeau fixe en haut de page : nombre total d'analyses, score moyen, meilleur score de la semaine. Chiffres réels calculés depuis la base, jamais inventés ni arrondis à la hausse. Masqué tant que le total est inférieur à un seuil en configuration.
- Badges de réassurance sous le bouton d'action, uniquement des affirmations vraies : « Connexion chiffrée », « Photo jamais stockée par Bitomètre », « Aucun compte ». (Le libellé d'origine « Photo supprimée après analyse » ne sera rétabli que lorsque Zero Data Retention sera activé chez xAI.)

## 15. Administration
Tableau de bord protégé : analyses lancées, refus par motif, conversion par formule, revenu brut et net (après TVA et commission du prestataire de paiement), défis créés et relevés, coût IA moyen par analyse.
Webhook : une fois par jour, envoi d'agrégats anonymes (nombre d'analyses, score moyen, répartition) vers une URL configurable (Make/n8n). Aucun envoi en temps réel, aucune donnée individuelle.

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

## 17. Mise en œuvre des formules photo (étape 3, décisions techniques)

- Flux : la photo est envoyée en une seule requête (`POST /api/analyse`), traitée en mémoire, et le serveur répond en flux (une ligne JSON par événement). L'écran affiche uniquement les étapes réellement exécutées : « Contrôle de recevabilité et extraction de la ligne médiane » (deux appels IA distincts lancés en parallèle : recevabilité et repérage), « Calibration sur la carte de référence » (calcul local), « Calcul des percentiles » (calcul local). Aucune tâche de fond, donc aucune photo conservée entre deux requêtes.
- Modèle : `grok-4.7`, raisonnement réduit (`XAI_EFFORT=low`), endpoint `/v1/chat/completions`, sortie JSON stricte. Mesures du 01/10/2026 (docs/DECISIONS.md, Bloc 3) : deux appels parallèles, image de 1 600 px, raisonnement réduit : attente médiane de 17,7 s avant l'aperçu, confiance de repérage de 0,92 à 0,93, environ 2 centimes de dollar par analyse. Un appel unique fusionné est plus rapide mais instable (confiance de 0,12 à 0,89) : écarté. `grok-4.3` écarté (plus rapide mais trop imprécis sur l'échantillon testé).
- Commentaire (troisième appel, texte seul) : lancé après l'aperçu. Un commentaire de repli déterministe est affiché tant que celui du modèle n'est pas prêt ; le commentaire du modèle n'est accepté que s'il compte 100 à 220 mots, et la phrase d'avis médical est ajoutée par le code si la courbure atteint 30° et que le modèle l'a omise. Conséquence d'hébergement : un serveur Node qui continue le traitement après la fermeture de la connexion (pas de plateforme qui coupe la fonction à la fin de la réponse).
- Ordre des contrôles avant toute analyse : jeton d'âge valide (cookie signé, 30 minutes, sans donnée d'identité) → trois cases de consentement → mesures déclarées plausibles (formule C) → captcha → limite de 5 tentatives par appareil et par 24 h (les refus et erreurs comptent) → réencodage serveur (format, taille, orientation, JPEG sans métadonnées) → filtrage d'empreintes → analyse.
- Refus : message unique et neutre, jamais de détail (en particulier sur l'âge), aucun paiement, motif journalisé (table `analysis_attempts`, sans image ni IP en clair).
- Résultats photo : longueur = ligne médiane ; circonférence = π × largeur maximale (mieux que la largeur moyenne aux essais) ; symétrie = 100 × (1 − écart relatif moyen des demi-largeurs) ; conicité = largeur sous le gland / largeur à la base ; marge = max(10 %, (1 − confiance) × 50 + (écart de perspective de la carte) × 20). Analyse jugée illisible si confiance moyenne < 0,5, structure incomplète, ou mesure hors plage plausible.
- Avant paiement, seuls l'indice de confiance et la symétrie sont visibles (formules B et C).
- Fournisseurs interchangeables avec mode simulation interdit en production : vérification d'âge, filtrage d'empreintes, captcha, vision. Aucun site en production tant que les vrais prestataires ne sont pas branchés.
- Validation de la précision : outil `npm run calibrate` (voir docs/CALIBRATION.md). La marge affichée reste une hypothèse tant que 15 à 20 photos de référence n'ont pas été évaluées.

## 18. Mise en œuvre de la carte de partage et du défi (étape 4, décisions)

- Carte : instantané de ce que l'utilisateur choisit (table `cards`). Jamais une copie du rapport. Options : score seul (défaut), ou score + un ou deux percentiles, ou score + une mesure de référence (jamais percentiles et mesure de référence ensemble). « Top X % » = 100 − percentile arrondi à l'entier SUPÉRIEUR (jamais flatté), minimum 1 %. Mention « Valeurs déclarées » pour la formule A, « Analyse de photo » pour B et C, sur la page et sur les images. Numéro de dossier à 4 chiffres, décoratif. Limite de 10 cartes par rapport. Création réservée aux rapports débloqués. Supprimer le rapport supprime ses cartes ; une carte peut aussi être retirée seule.
- Pages publiques : `/c/<16 caractères>` (noindex) avec métadonnées Open Graph ; images générées côté serveur en PNG, `/c/<id>/og` (1200 × 630) et `/c/<id>/story` (1080 × 1920), texte et chiffres uniquement. Les pages privées (rapport, paiement, partage, défi) ont une image Open Graph neutre (`/og/neutre`), sans score.
- Défi : un défi par rapport créateur (lien de 22 caractères qui ne révèle rien du créateur). L'ami accepte (cookie de 24 h, durée de vie d'un rapport non payé), suit son parcours complet (vérification d'âge comprise pour les protocoles photo) ; son rapport est rattaché au défi à sa création. Comparaison accessible uniquement depuis le lien privé du rapport de chaque participant (`/r/<id>/defi`), jamais par une adresse publique, et seulement quand les deux rapports sont payés. Elle affiche scores et percentiles (pas de mesures en cm, pas de commentaire, pas d'image) et la base de chaque valeur (déclarée / photo). Chaque participant peut se retirer à tout moment : la comparaison disparaît pour les deux. Un rapport non payé de l'ami, purgé après 24 h, rouvre le défi.

## 19. Structure SEO (étape 5, décisions)

- Contenu : un fichier Markdown par page dans `content/seo/<slug>.md` (8 slugs du lancement, section 12), avec en-tête (slug, title ≤ 60 caractères, metaDescription ≤ 155, targetKeyword, faq, sources). Les textes sont rédigés par le propriétaire du site et collés page par page ; le code ne contient aucun texte de contenu. Format et règles : `content/seo/README.md`.
- Validation au chargement (erreurs en français, nom du fichier cité) : H2 et H3 seulement dans le corps, ni image ni HTML brut, liens internes limités à `/analyse` et aux slugs des 8 pages, liens externes en `https://` avec `noopener nofollow`, sources en `http(s)`. Les liens vers une page du lancement pas encore présente sont signalés, pas refusés.
- Pages servies à l'adresse `/<slug>` (statiques, générées au build) avec : H1 = title, sommaire, FAQ repliable + balisage schema.org FAQPage (JSON-LD échappé), liste des sources, appel vers `/analyse`, liens « à lire aussi », avertissement « pas un avis médical », métadonnées Open Graph, adresse canonique.
- Publication : tant que `SEO_PUBLISH` n'est pas « on », chaque page affiche la mention interne « à relire avant publication », est en noindex, n'apparaît pas dans le sitemap et renvoie 404 en production. Réglage lu à la construction du site.
- `sitemap.xml` (accueil, méthode, contact, pages légales, pages de contenu publiées) et `robots.txt` (interdit /r/, /paiement/, /defi/, /api/, /analyse/, /verification-age/ ; /c/ et /og/ restent accessibles aux robots d'aperçu des réseaux sociaux, les cartes étant en noindex). Jamais de page privée dans le sitemap.
- Rapidité mobile : le bandeau de statistiques est chargé par le navigateur après l'affichage (`/api/stats`, mis en cache 60 s, sans aucun chiffre sous le seuil), pour que l'accueil et les pages de contenu restent statiques.
- Contrôle : `npm run seo:check` (format, longueur 600 à 1 500 mots, liens, sources) ; `-- --urls` vérifie aussi que chaque adresse de source répond. La vérification qu'un chiffre cité figure dans sa source se fait à la relecture, page par page.

## 20. Administration et statistiques (étape 6, décisions)

- Accès : `/admin`, protégé par un mot de passe dont seule l'empreinte (scrypt) est dans `.env` (`ADMIN_PASSWORD_HASH`, générée par `npm run admin:hash`) et un secret de session (`ADMIN_SESSION_SECRET`). Session signée, cookie httpOnly, sameSite strict, 8 heures. 5 échecs de connexion par 15 minutes et par adresse IP hachée, limitation en mémoire (à mutualiser si le site tourne sur plusieurs instances). Tant que les deux variables ne sont pas renseignées, l'administration est indisponible. Pages en noindex et interdites dans robots.txt.
- Indicateurs (période : 7, 30, 90 jours ou depuis le début) : analyses lancées par protocole (A : rapports créés ; photo : tentatives, avec abouties, refusées, bloquées, erreurs) ; refus par motif (le motif seul, jamais l'image) ; conversion par protocole (parmi les rapports créés sur la période, part de payés) ; revenus bruts et nets par protocole ; défis créés et relevés ; coût moyen d'analyse par le modèle (par appel et par analyse livrée, refus inclus, en dollars, au tarif configuré).
- Revenus : prix TTC. TVA = TTC − TTC / (1 + taux), 20 % par défaut. Commission du prestataire de paiement : 12 % PROVISOIRE, appliquée au TTC encaissé, plus des frais fixes éventuels par transaction (0 par défaut). Net = TTC − TVA − commission. Arrondis faits sur les totaux. Paramètres : `FINANCE` dans `src/config/site.ts`. Le coût d'analyse (dollars) n'est pas déduit du net.
- Durabilité (migration 004) : les statistiques ne dépendent pas des rapports, qui sont supprimés ou purgés. `report_log` (une ligne par rapport créé : empreinte SHA-256 de l'identifiant, formule, score, dates) et `stat_events` (défis créés, défis relevés) sont anonymes et conservés ; les paiements sont conservés même si le rapport est supprimé (`report_id` devient nul) pour la comptabilité. La politique de confidentialité l'indique. Le bandeau de statistiques du site lit désormais le journal (il ne baisse pas quand un rapport est supprimé).
- Webhook quotidien : `npm run stats:webhook` (à planifier une fois par jour à la mise en ligne), vers `STATS_WEBHOOK_URL` (https obligatoire, http toléré vers localhost seulement ; redirections refusées), signature optionnelle `x-bitometre-signature` (HMAC SHA-256 avec `STATS_WEBHOOK_SECRET`). Contenu : date (fuseau Europe/Paris), analyses lancées et payées par protocole, nombre de rapports photo payés, score moyen et répartition par tranches pour les rapports photo payés. Aucune donnée individuelle. Un groupe de moins de 5 rapports photo n'est jamais détaillé (moyenne et répartition masquées) et une tranche de 1 à 4 rapports s'affiche « <5 ». Un seul envoi réussi par jour ; un échec est réessayé au lancement suivant. `--dry-run` affiche sans envoyer.

## 21. Éditeur, textes juridiques et prestataire d'analyse (session du 01/10/2026)

- Éditeur : société de droit anglais (Ltd). **L'établissement en France n'est pas encore immatriculé : il n'est mentionné nulle part** (à ajouter le jour de l'immatriculation). Mentions légales : raison sociale, numéro Companies House, siège, directeur de la publication, numéro d'enregistrement ICO, hébergeur (Railway Corporation). Les informations de la Ltd sont dans `src/config/company.ts` ; tant que ce fichier contient des marqueurs `[À COMPLÉTER : ...]`, le site refuse de s'ouvrir au public sans mot de passe (503). CGV régies par le droit anglais, avec préservation des dispositions impératives de la loi du pays de résidence habituelle du consommateur. Renonciation au droit de rétractation fondée sur le règlement 37 des CCR 2013 et l'article L221-28, 13° du Code de la consommation (texte de l'article à faire relire par un juriste).
- Prestataire d'analyse : **SpaceXAI LLC** (Nevada ; siège 800 W Cesar Chavez St., Austin, TX 78701, États-Unis), connue sous le nom xAI, anciennement X.AI Corp. ; ses conditions « Enterprise » régissent l'usage de l'API. Les textes destinés aux utilisateurs (consentement avant envoi, confidentialité) nomment cette raison sociale. Un accord de traitement des données (DPA) est proposé par le prestataire : à signer avant la mise en ligne.

## 22. Géométrie des mesures photo (session du 01/10/2026)

- Calcul : pose de l'appareil déduite des 4 coins de la carte avec une focale supposée de `CAMERA.focalFactor` (0,9) × le grand côté de l'image et un point principal au centre ; ligne médiane placée sur un plan horizontal à une hauteur égale au rayon du sujet ; rayon déduit de l'écart angulaire entre les deux rayons tangents aux bords (r = distance × sin(angle / 2)) ; circonférence = π × largeur maximale. Hypothèses : sujet posé sur la même surface que la carte, section circulaire, objectif principal sans zoom.
- Refus : inclinaison de l'appareil supérieure à 50°, ou grand côté de la carte inférieur à 15 % du grand côté de l'image (message neutre, motifs `inclinaison_trop_forte` et `carte_trop_petite`).
- Marge : max(10 %, √(confiance² + taille de la carte² + inclinaison²)), voir `MARGIN` dans `src/config/site.ts`. Le bruit de repérage supposé (2 px par point) est à régler par la calibration sur de vraies photos (docs/CALIBRATION.md).
- Validation sur prises de vue simulées (`npm run geometry:report`, tests `tests/geometry.test.ts`) : repérage parfait, erreur maximale 6,1 % et 100 % des cas dans la marge jusqu'à 50° d'inclinaison et pour une focale réelle de ±20 % de la focale supposée ; repérage bruité (2 px), 94 % des cas dans la marge. Non validé sur des photos réelles.

## 23. Bêta gratuite et décisions de la session de nuit n° 3 (01/10/2026)

- **Mode bêta gratuite** (variable `FREE_BETA=on`, `src/lib/mode.ts`) : formule A uniquement ; les formules B et C, la vérification d'âge par prestataire, le captcha, le paiement et les CGV n'existent pas (404, aucune mention ailleurs) ; le rapport est débloqué sans paiement avec la mention « Bêta gratuite » ; le code de paiement reste en place, désactivé, réactivé en retirant la variable. Carte de partage et défi fonctionnent. Case de consentement explicite (RGPD art. 9) au traitement des valeurs saisies. Rapports de la bêta effacés au plus tard après 90 jours (`BETA.reportTtlDays`), sans garantie de conservation ; exclus des statistiques de conversion et de revenu (colonne `free_beta`, migration 006).
- **Textes de la bêta** : conditions d'utilisation de la bêta (`/conditions`) à la place des CGV (qui restent prêtes pour la version payante) ; mentions légales au nom de la Ltd ; politique de confidentialité limitée à ce que fait la bêta (mesures déclarées, IP hachée effacée après 24 h, aucun envoi à xAI, hébergeur Railway).
- **Protection du site de test** : authentification HTTP gérée par l'application (`SITE_PASSWORD`, `SITE_USER`, `src/proxy.ts`) ; seul `/api/health` reste libre.
- **Relecture juridique complète** par un juriste **avant le passage au payant** (et avant l'ouverture au public de la bêta : voir docs/JURISTE.md, section bêta).
- **Comptes et demandes** : Claude prépare les demandes (docs/DEMANDES/), le propriétaire les envoie. Aucun compte n'est ouvert par Claude.
