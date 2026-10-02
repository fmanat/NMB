# BITOMÈTRE — CHARTE GRAPHIQUE UI/UX
## Version 1.0 — Web desktop + mobile

Document de référence pour l’implémentation front-end par Claude.

## 1. ADN DE MARQUE

**Concept : Statistical Lab**

Bitomètre doit ressembler à un outil d’analyse statistique moderne, pas à un site pour adultes.

Piliers :
- Science : données, mesures, percentiles, graphiques.
- Technologie : IA, computer vision, traitement automatisé.
- Confiance : confidentialité, sobriété, transparence.

L’humour vient uniquement du contraste entre le sujet intime et le sérieux de l’interface.

À rechercher : premium, scientifique, précis, contemporain, rassurant, légèrement décalé mais jamais vulgaire.

À éviter : esthétique pornographique, rouge/rose sexy, silhouettes suggestives, humour potache, emojis dans l’interface, cyberpunk, excès de néon, gaming, faux codes médicaux, esthétique de site de rencontre, copie d’un concurrent.

## 2. DIRECTION ARTISTIQUE

### « Statistical Lab »

Références conceptuelles : laboratoire de données, quantified-self, outil de mesure scientifique, dashboard data moderne, startup IA premium.

**Impression recherchée :**
1. « C’est sérieux et technologiquement avancé. »
2. « Ils analysent vraiment ça ? »
3. « Je veux voir mon résultat. »

Le design doit être propriétaire et ne pas reproduire la composition ou les éléments reconnaissables d’un concurrent.

## 3. PALETTE

### Marque
- Bleu Bitomètre : `#1769FF`
- Bleu clair : `#4D8DFF`

### Neutres
- Navy : `#10213F`
- Texte secondaire : `#425778`
- Gris clair : `#EEF3F8`
- Bordure : `#DCE4ED`
- Blanc : `#FFFFFF`

### Fonctionnel
- Succès : `#159570`
- Attention : `#D99000`
- Erreur : `#D64545`

Les couleurs fonctionnelles ne sont pas des couleurs de marque.

## 4. DARK MODE

Le produit est **light-first**. Le dark mode est secondaire.

Dark background : `#08111F`
Dark surface : `#0E1B2D`
Dark border : `#21344E`
Dark text : `#F5F8FC`
Dark secondary : `#9EACC0`
Accent : `#3D8BFF`

Un écran sombre peut être utilisé pour l’animation d’analyse, mais ne doit pas définir toute l’identité.

## 5. TYPOGRAPHIE

Police principale : **Inter**

Fallback :
`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Police technique : **IBM Plex Mono**, uniquement pour identifiants, références, timestamps et données techniques courtes.

### Desktop
- H1 : 48px / 1.05 / 700
- H2 : 36px / 1.10 / 700
- H3 : 24px / 1.20 / 650
- H4 : 18px / 1.30 / 650
- Body large : 18px / 1.55
- Body : 16px / 1.55
- Small : 14px / 1.45
- Caption : 12px / 1.35

### Mobile
- H1 : 34px / 1.08
- H2 : 28px / 1.12
- H3 : 21px / 1.20
- Body : 16px / 1.50
- Small : 14px / 1.40

Ne jamais descendre sous 12px pour du contenu utilisateur.

## 6. ESPACEMENT

Grille de 4px.

Valeurs : 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px.

## 7. LAYOUT

Desktop : container max 1200px, padding 32px.
Tablet : padding 24px.
Mobile : padding 20px ; 16px sous 390px.

Mobile = conception spécifique, pas desktop simplement réduit.

## 8. RAYONS ET OMBRES

Rayons :
- small : 6px
- standard : 10px
- card : 14px
- large : 18px
- pill : 999px

Ombres :
- card : `0 2px 10px rgba(16,33,63,0.06)`
- élevée : `0 8px 30px rgba(16,33,63,0.10)`

Éviter les grosses ombres, glow permanents et effets 3D.

## 9. BOUTONS

### Primaire
- fond `#1769FF`
- texte blanc
- hauteur desktop 48px
- hauteur mobile 52px
- radius 10px
- font 16px / 600

Exemple : **Démarrer mon analyse →**

Hover : `#0F5BE0`
Active : `#0B4EC5`

### Secondaire
Fond blanc/transparent, bordure `#DCE4ED`, texte `#10213F`.

### Tertiaire
Sans bordure, texte `#1769FF`.

## 10. NAVIGATION

Desktop : header blanc, 72px de haut, logo à gauche, navigation légère, CTA à droite.

Mobile : header 56–64px, logo à gauche, hamburger à droite.

Logo : **Bitomètre**, typographique, éventuellement accompagné d’un petit symbole data/mesure. Aucun symbole anatomique explicite.

## 11. ICONOGRAPHIE

Line icons, stroke 1.5–2px, géométriques et simples.

Par défaut `#425778`, actif `#1769FF`.

Icônes adaptées : Camera, Ruler, BarChart3, ShieldCheck, Lock, Activity, ScanLine, ArrowRight, Download, Share2, Copy, Info, CheckCircle.

Pas d’emojis dans l’interface.

## 12. ILLUSTRATIONS

Ne pas montrer une anatomie réaliste.

Préférer :
- nuages de points
- contours
- lignes de mesure
- formes géométriques
- grilles
- courbes
- diagrammes
- données

L’illustration doit communiquer « nous mesurons quelque chose », pas « regardez un sexe ».

## 13. GRAPHIQUES

Le rapport est le cœur du produit.

### Percentile
Barre horizontale :
`0% ─────────●──────── 100%`
avec valeur numérique et position précise.

### Distribution
Courbe de distribution légère, position de l’utilisateur indiquée par une ligne verticale bleue.

### Score
Anneau/cercle :
**72**
`/100`

Puis :
**Au-dessus de 71 % de la population de référence**

Le score est l’élément le plus visible.

## 14. CARDS

Card standard :
- fond blanc
- border 1px `#DCE4ED`
- radius 14px
- padding 24px desktop / 20px mobile

Card statistique :
LABEL → valeur → percentile → graphique → courte interprétation.

## 15. LANDING PAGE

Hero desktop en deux colonnes.

### Gauche
Eyebrow :
`SCIENCE · IA · STATISTIQUES`

H1 :
**Votre profil morphologique en données.**

Sous-titre :
> Une analyse automatisée et confidentielle, comparée à des références statistiques.

CTA :
**Démarrer mon analyse →**

Secondaire :
**Voir un exemple de rapport**

### Droite
Visualisation abstraite de données : grille, contours, mesures, courbes, percentiles. Pas de photographie anatomique réaliste.

Sous le hero, 3–4 preuves de confiance :
- 100 % confidentiel
- Analyse automatisée
- Données statistiques
- Aucun abonnement

Ces promesses doivent rester cohérentes avec l’implémentation réelle.

## 16. ÉCRAN CHOIX DE L’ANALYSE

Titre :
**Comment souhaitez-vous faire votre analyse ?**

Deux cards :

**Analyser une photo**
Badge : **Recommandé**

**Saisir mes mesures manuellement**

Card sélectionnée :
- border bleu
- fond bleu très pâle
- icône bleue

## 17. ÉCRAN ANALYSE

Titre :
**Analyse en cours…**

Visualisation centrale :
- grille
- contour abstrait
- scan horizontal
- points de données

Étapes :
- ✓ Détection des contours
- ✓ Mesures dimensionnelles
- ◌ Analyse de la symétrie
- ◌ Calcul de la courbure
- ◌ Comparaison statistique

Afficher la progression uniquement si elle reflète réellement le traitement. Sinon utiliser des étapes qualitatives.

## 18. PAYWALL

Titre :
**Votre analyse est prête.**

Sous-titre :
> Votre rapport détaillé est disponible.

Afficher un aperçu flouté du score/percentiles.

Bloc :
**Rapport complet**
**4,90 €**
**Paiement unique**

CTA :
**Payer maintenant →**

Sous le CTA : paiement sécurisé + moyens réellement disponibles.

## 19. RAPPORT FINAL

Ordre :
1. Score global
2. Position statistique
3. Indicateurs
4. Visualisations
5. Synthèse
6. Méthodologie

Exemple :
**72 / 100**
**Au-dessus de 71 % de la population de référence**

Indicateurs :
- longueur
- circonférence
- symétrie
- courbure

Ne jamais faire passer un long texte avant les données.

## 20. PARTAGE SOCIAL

Créer une carte dédiée, pas une capture du dashboard.

Format recommandé : `1200 × 630`.

Structure :
BITOMÈTRE
Rapport morphologique

**72 / 100**

**Au-dessus de 71 % de la population de référence**

petit graphique statistique

`bitometre.com/c/XXXXXX`

Aucune photo ni donnée personnelle.

## 21. RESPONSIVE

### ≥1200px
Hero 2 colonnes, dashboard en grille.

### 768–1199px
Réduire les colonnes, cards en 2 colonnes.

### <768px
Une colonne, CTA pleine largeur, cards compactes, padding 20px.

### <390px
Padding 16px, H1 30–32px, graphiques réduits mais valeurs conservées.

CTA transactionnel mobile éventuellement fixé en bas avec respect de la safe area.

## 22. MICRO-INTERACTIONS

Transitions :
- boutons : 150–200ms
- cards : ~200ms
- progression : 300–500ms
- graphiques : 600–900ms

L’animation d’analyse peut être plus travaillée, mais reste scientifique.

Éviter bounce, confettis, gaming et glow permanent.

## 23. ACCESSIBILITÉ

Viser WCAG AA.

- contraste suffisant
- focus clavier visible
- zones tactiles minimum 44×44px
- ne jamais communiquer une information uniquement par la couleur

## 24. FORMULAIRES

Inputs :
- hauteur mobile 52px
- border 1px `#DCE4ED`
- radius 10px
- focus `#1769FF` + halo léger

Labels toujours visibles. Ne pas dépendre uniquement des placeholders.

## 25. TON UI

Vocabulaire recommandé :
analyse, mesure, percentile, référence, comparaison, données, traitement, résultat, indicateur, statistique.

Éviter dans l’interface :
termes vulgaires, blagues sexuelles, formulations provocantes, promesses médicales.

## 26. COMPOSANTS À CONSTRUIRE

`Header`
`MobileHeader`
`Button`
`IconButton`
`Card`
`StatCard`
`PercentileBar`
`DistributionChart`
`ScoreRing`
`ProgressStepper`
`AnalysisProgress`
`UploadCard`
`MeasurementForm`
`PaymentCard`
`TrustBadge`
`ReportHeader`
`ReportMetric`
`ReportSummary`
`ShareCard`
`ShareButtons`
`Modal`
`Toast`
`Tooltip`
`Accordion`
`Footer`

Tous doivent prévoir : default, hover, active, focus, disabled, loading, success, error.

## 27. ARBORESCENCE VISUELLE

`/` — Landing

`/analyse` — Choix du mode

`/analyse/photo` — Upload/capture

`/analyse/processing` — Analyse

`/resultat/preview` — Aperçu + paywall

`/resultat` — Rapport complet

`/c/:id` — Rapport public partageable

## 28. RÈGLE D’OR UX

Chaque écran répond à une seule question :

Landing → Pourquoi essayer ?
Choix → Comment être analysé ?
Analyse → Est-ce que ça fonctionne ?
Paywall → Qu’est-ce que j’obtiens ?
Rapport → Quel est mon résultat ?
Partage → Comment puis-je le montrer ?

## 29. TOKENS CSS

```css
:root {
  --color-primary: #1769FF;
  --color-primary-hover: #0F5BE0;
  --color-primary-soft: #EEF5FF;

  --color-navy: #10213F;
  --color-text: #10213F;
  --color-text-secondary: #425778;

  --color-background: #FFFFFF;
  --color-surface: #FFFFFF;
  --color-surface-soft: #F6F9FC;
  --color-border: #DCE4ED;

  --color-success: #159570;
  --color-warning: #D99000;
  --color-error: #D64545;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

## 30. INSTRUCTION FINALE POUR CLAUDE

Cette charte est la source de vérité visuelle.

Quand une décision graphique n’est pas définie :
1. privilégier la simplicité ;
2. privilégier la lisibilité mobile ;
3. privilégier la hiérarchie des données ;
4. privilégier les espaces blancs ;
5. utiliser le bleu Bitomètre comme accent ;
6. éviter tout élément sexuel explicite ;
7. éviter tout élément ressemblant à une copie identifiable d’un concurrent.

Le résultat doit évoquer :

**« une startup française de data/IA qui aurait construit un laboratoire statistique grand public »**

et jamais :

**« un site pour adultes maquillé en dashboard ».**
