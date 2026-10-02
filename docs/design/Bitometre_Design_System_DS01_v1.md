# BITOMÈTRE — DESIGN SYSTEM
## DS-01 · Version 1.0 · Web + Mobile

Document d'implémentation destiné à Claude.
La charte graphique précédente définit l'identité ; ce document définit les composants, tokens, états, comportements et règles d'assemblage.

---

# 00 — PRINCIPES NON NÉGOCIABLES

### Identité
Bitomètre = **Statistical Lab** :
- scientifique
- data-driven
- technologique
- premium
- sobre
- grand public
- jamais vulgaire

### Hiérarchie
Chaque écran possède :
1. une action principale ;
2. une information principale ;
3. des informations secondaires.

### Design
- Light-first.
- Blanc et navy dominants.
- Bleu Bitomètre comme accent.
- Beaucoup d'espace.
- Bordures fines.
- Ombres discrètes.
- Animations courtes.
- Aucun effet cyberpunk permanent.
- Aucune anatomie réaliste ou explicite dans l'UI.

### Mobile
Le mobile est une expérience conçue spécifiquement, pas un desktop réduit.

---

# 01 — DESIGN TOKENS

## 1.1 Couleurs

```css
:root {
  --bm-blue-500: #1769FF;
  --bm-blue-400: #4D8DFF;
  --bm-blue-100: #EEF5FF;
  --bm-blue-050: #F6F9FF;

  --bm-navy-900: #10213F;
  --bm-navy-700: #425778;

  --bm-gray-050: #F8FAFC;
  --bm-gray-100: #F1F5F9;
  --bm-gray-200: #EEF3F8;
  --bm-gray-300: #DCE4ED;
  --bm-gray-500: #8A9AB0;

  --bm-white: #FFFFFF;

  --bm-success: #159570;
  --bm-success-soft: #EAF8F3;

  --bm-warning: #D99000;
  --bm-warning-soft: #FFF6E5;

  --bm-error: #D64545;
  --bm-error-soft: #FCEEEE;

  --bm-dark-bg: #08111F;
  --bm-dark-surface: #0E1B2D;
  --bm-dark-border: #21344E;
  --bm-dark-text: #F5F8FC;
  --bm-dark-secondary: #9EACC0;
}
```

### Règles
- `#1769FF` est la couleur d'action.
- `#10213F` est la couleur de lecture.
- Ne pas utiliser le bleu principal pour des blocs décoratifs massifs.
- Vert = succès uniquement.
- Orange = attention uniquement.
- Rouge = erreur uniquement.

---

## 1.2 Typographie

```css
--font-sans:
  Inter, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;

--font-mono:
  "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

### Styles

| Token | Desktop | Mobile | Weight |
|---|---:|---:|---:|
| Display | 56/58 | 36/39 | 700 |
| H1 | 48/50 | 34/37 | 700 |
| H2 | 36/40 | 28/32 | 700 |
| H3 | 24/29 | 21/25 | 650 |
| H4 | 18/24 | 18/24 | 650 |
| Body L | 18/28 | 17/26 | 400 |
| Body | 16/25 | 16/24 | 400 |
| Small | 14/20 | 14/20 | 400 |
| Caption | 12/16 | 12/16 | 500 |
| Data XL | 56/60 | 44/48 | 700 |
| Data L | 32/36 | 28/32 | 700 |

Ne jamais utiliser IBM Plex Mono pour les paragraphes.

---

## 1.3 Espacement

Base = 4px.

```css
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
```

---

## 1.4 Radius

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 18px;
--radius-pill: 999px;
```

---

## 1.5 Bordures

```css
--border-default: 1px solid #DCE4ED;
--border-active: 1px solid #1769FF;
```

---

## 1.6 Ombres

```css
--shadow-card:
  0 2px 10px rgba(16,33,63,.06);

--shadow-elevated:
  0 8px 30px rgba(16,33,63,.10);

--shadow-modal:
  0 20px 60px rgba(16,33,63,.18);
```

---

## 1.7 Z-index

```css
--z-base: 0;
--z-header: 100;
--z-sticky: 200;
--z-dropdown: 300;
--z-modal: 500;
--z-toast: 600;
```

---

# 02 — CONTAINER & GRID

## Desktop

```css
max-width: 1200px;
margin-inline: auto;
padding-inline: 32px;
```

## Tablet

```css
padding-inline: 24px;
```

## Mobile

```css
padding-inline: 20px;
```

<390px :

```css
padding-inline: 16px;
```

### Breakpoints

```css
--bp-mobile: 767px;
--bp-tablet: 1023px;
--bp-desktop: 1200px;
```

---

# 03 — BUTTONS

## BM Button

Variantes :
- Primary
- Secondary
- Tertiary
- Destructive
- Loading

### Primary

```text
[ Démarrer mon analyse  → ]
```

Style :
- hauteur desktop : 48px
- hauteur mobile : 52px
- padding horizontal : 20px
- radius : 10px
- background : `#1769FF`
- texte : blanc
- weight : 600

### États

Default : `#1769FF`

Hover : `#0F5BE0`

Active : `#0B4EC5`

Disabled :
- background `#DCE4ED`
- texte `#8A9AB0`
- cursor non interactif

Focus :
- border/outline visible
- halo bleu léger

### Secondary

Fond blanc.
Border `#DCE4ED`.
Texte `#10213F`.

Hover :
fond `#F8FAFC`.

### Tertiary

Pas de fond.
Pas de border.
Texte `#1769FF`.

### Loading

```text
[ ◌ Analyse en cours… ]
```

Le bouton conserve sa largeur pendant le loading.

---

# 04 — ICON BUTTON

Dimensions :
- 40×40 desktop
- 44×44 mobile

Radius :
10px.

Usage :
- téléchargement
- fermeture
- menu
- copie
- partage

Toujours prévoir un tooltip desktop si l'action n'est pas évidente.

---

# 05 — HEADER

## Desktop

Hauteur : 72px.

Structure :

```text
[ Logo ]        [ Navigation ]        [ FAQ ] [ CTA ]
```

Fond blanc.
Border bottom `#EEF3F8`.

## Mobile

Hauteur : 60px.

```text
[ Logo ]                         [ ☰ ]
```

Menu plein écran ou drawer.

Le header ne doit jamais devenir visuellement dominant.

---

# 06 — LOGO

Nom :

**Bitomètre**

Style :
- wordmark
- navy
- éventuellement symbole data composé de 3 barres

Le symbole ne doit pas représenter directement l'anatomie.

Versions :
- full
- compact
- favicon

---

# 07 — BADGES

## Badge standard

Exemples :

`RECOMMANDÉ`

`NOUVEAU`

`PAIEMENT UNIQUE`

`ANALYSE TERMINÉE`

Style :
- 12px
- weight 600
- radius pill
- padding 4px 8px

### Recommended

Background `#EEF5FF`
Text `#1769FF`.

### Success

Background `#EAF8F3`
Text `#159570`.

---

# 08 — CARD

## Anatomy

```text
┌──────────────────────────────┐
│ Eyebrow                      │
│                              │
│ Title                        │
│ Description                  │
│                              │
│ Content                      │
└──────────────────────────────┘
```

Default :
- background white
- border
- radius 14px
- padding 24px

Mobile :
- padding 20px

### Hover
Border devient légèrement bleue.
Ombre légère.

### Selected
- border `#1769FF`
- background `#F6F9FF`

---

# 09 — ANALYSIS METHOD CARD

Deux cartes principales :

## Photo

```text
[ Camera ]

Analyser une photo
Plus précis et recommandé

                    →
```

Badge `RECOMMANDÉ`.

## Manuel

```text
[ Ruler ]

Saisir mes mesures manuellement
Longueur, circonférence…

                    →
```

La carte sélectionnée utilise l'état Selected.

---

# 10 — INPUT

Hauteur :
52px mobile / 48px desktop.

Radius :
10px.

Structure :

```text
Label
[ valeur                         unité ]
Helper text
```

### Focus

Border bleu + halo discret.

### Error

Border rouge.

Message sous l'input avec icône.

### Number input

Les unités doivent être visuellement séparées :

```text
[ 15,2                         cm ]
```

---

# 11 — UPLOAD CARD

```text
┌──────────────────────────────┐
│                              │
│          [ Camera ]          │
│                              │
│       Ajouter une photo      │
│                              │
│     JPG / PNG · sécurisé     │
│                              │
└──────────────────────────────┘
```

Drag & drop desktop.
Sélection/capture mobile.

Prévoir :
- empty
- uploading
- processing
- success
- error

---

# 12 — PROGRESS STEPPER

Pour le parcours principal :

```text
●────○────○────○
1    2    3    4
```

Étapes :

1. Méthode
2. Analyse
3. Résultats
4. Rapport

Actif :
bleu.

Terminé :
bleu + check.

À venir :
gris.

Mobile : conserver le stepper mais réduire le texte.

---

# 13 — ANALYSIS PROGRESS

Écran dédié.

### Header

**Analyse en cours…**

### Visualisation

Utiliser une représentation abstraite :
- grille
- nuage de points
- contour
- scan
- repères de mesure

### Liste

```text
✓ Détection des contours
✓ Mesures dimensionnelles
◌ Analyse de la symétrie
◌ Calcul de la courbure
◌ Comparaison statistique
```

Ne pas simuler une progression numérique si le backend ne fournit pas réellement cette information.

---

# 14 — PROGRESS BAR

Hauteur :
6px.

Radius :
999px.

Track :
`#E5EBF2`

Fill :
`#1769FF`

Version fine pour les percentiles.

---

# 15 — SCORE RING

Composant central du rapport.

### Desktop

diamètre :
180–200px.

### Mobile

diamètre :
150–170px.

Structure :

```text
       ╭────────╮
     ╱            ╲
    │     72       │
    │    /100      │
     ╲            ╱
       ╰────────╯
```

Sous le cercle :

**Au-dessus de 71 % de la population de référence**

### Couleur

Ring principal = `#1769FF`.

Le score doit rester très lisible en monochrome si nécessaire.

---

# 16 — METRIC CARD

Structure :

```text
LONGUEUR EN ÉRECTION             15,2 cm

78e percentile

0 cm ─────────────●──────────── 25 cm

                    distribution
```

Éléments :
1. label
2. valeur
3. percentile
4. visualisation
5. borne / unité

### Ordre mobile

Valeur avant graphique.

---

# 17 — PERCENTILE BAR

Composant réutilisable.

```text
78e percentile

0% ─────────────●────────── 100%
```

Le point doit être précisément positionné.

Utiliser le même composant partout.

---

# 18 — DISTRIBUTION CHART

Courbe simple, très légère.

```text
          ╭───╮
       ╭──╯   ╰──╮
───────╯──────────╰────────
              │
             YOU
```

Le graphique doit expliquer la position statistique, pas décorer.

Couleurs :
- distribution : gris/bleu très clair
- utilisateur : bleu Bitomètre

---

# 19 — CURVATURE INDICATOR

Pour la courbure :

```text
Courbure

7,2°

   ╭──────────────╮
  /                \
0°                  30°
```

Valeur numérique dominante.

Interprétation sous la valeur.

---

# 20 — RESULT SUMMARY

Card légèrement bleutée.

```text
SYNTHÈSE

Profil statistique
Votre position se situe au-dessus
de la tendance centrale de la
population de référence.
```

La formulation réelle doit provenir du contenu validé ; le composant ne doit pas inventer d'interprétation médicale.

---

# 21 — PAYWALL CARD

## Structure

```text
Votre analyse est prête.

[ aperçu flouté du rapport ]

RAPPORT COMPLET

4,90 €
Paiement unique

[ Payer maintenant → ]

Paiement sécurisé
```

### Règles

Le prix doit être très visible.
Le mot **abonnement** ne doit pas apparaître si le produit est réellement one-shot.
Ne pas surcharger avec des arguments marketing.

---

# 22 — PAYMENT TRUST

Sous le CTA :

```text
Paiement sécurisé
[ moyens réellement disponibles ]
```

Ne montrer que les moyens effectivement intégrés.

---

# 23 — SHARE CARD

Format social :
1200×630.

Structure :

```text
BITOMÈTRE

Rapport morphologique

72 / 100

Au-dessus de 71 %
de la population de référence

[ mini graphique ]

bitometre.com/c/XXXXXX
```

Design :
- fond blanc ou navy très léger
- grand score
- graphique minimal
- branding discret

Aucune photo.

---

# 24 — SHARE BUTTONS

Actions :

- Copier le lien
- Partager
- Télécharger
- Réseau social si réellement disponible

Mobile :
boutons pleine largeur ou grille 2 colonnes.

---

# 25 — TOAST

Position :
haut droit desktop.
bas de l'écran mobile.

Exemples :

**Lien copié**

**Rapport téléchargé**

**Une erreur est survenue**

Durée :
3–4 secondes.

Ne jamais utiliser un toast pour une information critique.

---

# 26 — MODAL

Usage :
- confirmation
- informations méthodologiques
- détails confidentialité

Structure :

```text
┌──────────────────────────┐
│ Titre                 ×  │
│                          │
│ Contenu                  │
│                          │
│ [ Action ]               │
└──────────────────────────┘
```

Overlay sombre très léger.

Mobile :
bottom sheet possible pour les informations secondaires.

---

# 27 — TOOLTIP

Uniquement pour :
- termes techniques
- icônes non évidentes
- méthodologie

Ne jamais cacher une information essentielle dans un tooltip.

---

# 28 — ACCORDION

Utilisation :
- méthodologie
- FAQ
- confidentialité
- explications statistiques

Closed par défaut sur mobile.

---

# 29 — FOOTER

Desktop :

```text
Bitomètre

Analyse statistique
Confidentialité
CGU
FAQ
Contact

© Bitomètre
```

Sobre.

Pas de footer gigantesque.

---

# 30 — LANDING PAGE COMPOSITION

```text
HEADER
────────────────────────────────

EYEBROW

Votre profil morphologique
en données.

Texte explicatif.

[ Démarrer mon analyse ]
[ Voir un exemple ]

                 VISUALISATION
                 STATISTIQUE

────────────────────────────────
4 TRUST ITEMS

────────────────────────────────
COMMENT ÇA MARCHE ?

01 Choisir
02 Analyser
03 Découvrir

────────────────────────────────
EXEMPLE DE RAPPORT

────────────────────────────────
CONFIDENTIALITÉ

────────────────────────────────
FOOTER
```

---

# 31 — MOBILE LANDING

Ordre strict :

1. Logo/header
2. Eyebrow
3. H1
4. sous-titre
5. visualisation
6. CTA
7. preuves de confiance
8. comment ça marche
9. exemple
10. confidentialité
11. footer

Le CTA principal doit apparaître rapidement sans scroll excessif.

---

# 32 — RAPPORT DESKTOP

Structure recommandée :

```text
HEADER

RAPPORT MORPHOLOGIQUE
Référence #B78492

┌──────────────────────────────────────┐
│ SCORE GLOBAL                         │
│                                      │
│             72 /100                 │
│        Au-dessus de 71 %            │
└──────────────────────────────────────┘

INDICATEURS

┌────────────┐ ┌────────────┐
│ Longueur   │ │ Circonf.   │
└────────────┘ └────────────┘

┌────────────┐ ┌────────────┐
│ Symétrie   │ │ Courbure   │
└────────────┘ └────────────┘

SYNTHÈSE

MÉTHODOLOGIE
```

---

# 33 — RAPPORT MOBILE

Tout devient vertical :

```text
Score
↓
Position statistique
↓
Longueur
↓
Circonférence
↓
Symétrie
↓
Courbure
↓
Synthèse
↓
Méthodologie
↓
Partager
```

Le score reste sticky uniquement si cela améliore réellement la navigation.

---

# 34 — TABLEAUX DE DONNÉES

Pour les données techniques :

- header gris très léger
- lignes 48px minimum
- chiffres alignés à droite
- labels à gauche
- monospace uniquement pour valeurs techniques

Mobile :
transformer les tableaux complexes en cards.

---

# 35 — ÉTATS GLOBAUX

Tous les composants interactifs doivent implémenter :

```text
default
hover
active
focus
disabled
loading
success
error
```

Les composants de données doivent aussi prévoir :

```text
empty
not available
processing
```

---

# 36 — ACCESSIBILITÉ

Minimum :
- contraste WCAG AA lorsque possible
- focus clavier visible
- zone tactile ≥44×44px
- labels explicites
- aria-label pour les icon buttons
- navigation clavier
- ne jamais transmettre une information uniquement par la couleur

---

# 37 — ANIMATION SYSTEM

```css
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 400ms;
--duration-data: 700ms;

--ease-standard: cubic-bezier(.2,.8,.2,1);
```

### Règles
- interface : rapide
- données : progressive
- analyse : immersive mais sobre

Respecter `prefers-reduced-motion`.

---

# 38 — RESPONSIVE COMPONENT RULES

## Button
Desktop : auto width.
Mobile : full width pour CTA principal.

## Card
Desktop : padding 24.
Mobile : padding 20.

## Grid
Desktop : 2–4 colonnes.
Mobile : 1 colonne.

## Score
Desktop : grand.
Mobile : toujours dominant mais réduit.

## Charts
Desktop : hauteur confortable.
Mobile : largeur 100 %, hauteur réduite.

---

# 39 — SÉMANTIQUE DES COMPOSANTS

Les composants doivent avoir des noms fonctionnels et réutilisables.

Bon :

```tsx
<ScoreRing score={72} />
<PercentileBar percentile={78} />
<MetricCard />
<PaymentCard />
```

Mauvais :

```tsx
<BlueCircle />
<BigBox />
<PrettyChart />
```

---

# 40 — ARCHITECTURE REACT RECOMMANDÉE

```text
/components
  /ui
    Button
    Card
    Badge
    Input
    Modal
    Toast
    Tooltip

  /navigation
    Header
    MobileHeader
    Footer

  /analysis
    AnalysisMethodCard
    UploadCard
    ProgressStepper
    AnalysisProgress

  /report
    ScoreRing
    MetricCard
    PercentileBar
    DistributionChart
    CurvatureIndicator
    ReportSummary

  /payment
    PaymentCard
    PaymentTrust

  /sharing
    ShareCard
    ShareButtons
```

Les composants UI ne doivent pas contenir la logique métier.

---

# 41 — RESPONSABILITÉ DES COMPOSANTS

### Button
Gère uniquement interaction et apparence.

### ScoreRing
Reçoit un score et l'affiche.

### PercentileBar
Reçoit un percentile.

### MetricCard
Reçoit label, valeur, unité, percentile et visualisation.

### PaymentCard
Reçoit prix et état de paiement.

### ShareCard
Reçoit les données publiques autorisées.

Aucun composant visuel ne doit recalculer les statistiques métier.

---

# 42 — DONNÉES DU RAPPORT

Exemple d'interface :

```ts
interface ReportMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  percentile: number;
  description?: string;
  chart?: "distribution" | "bar" | "curvature";
}

interface Report {
  id: string;
  score: number;
  populationPercentile: number;
  metrics: ReportMetric[];
  createdAt: string;
}
```

Le front-end reçoit les résultats calculés par le backend.

---

# 43 — SCORE

Le composant visuel ne doit pas connaître la formule de calcul.

Il reçoit :

```ts
score: number
```

et affiche :

```text
72 / 100
```

La logique statistique reste dans le backend.

---

# 44 — PRIVACY UI

Créer un composant réutilisable :

```text
🔒 Traitement confidentiel

Votre photo est traitée temporairement
pour l'analyse puis supprimée selon
le fonctionnement prévu du service.
```

Ne jamais promettre techniquement quelque chose que l'infrastructure ne garantit pas.

---

# 45 — COPY PRINCIPALE

### Hero
**Votre profil morphologique en données.**

### CTA
**Démarrer mon analyse →**

### Méthode
**Comment souhaitez-vous faire votre analyse ?**

### Analyse
**Analyse en cours…**

### Résultat
**Votre analyse est prête.**

### Rapport
**Rapport morphologique**

### Partage
**Votre rapport est prêt à être partagé.**

Le vocabulaire doit rester scientifique et sobre.

---

# 46 — DO / DON'T

## DO

✓ blanc
✓ navy
✓ bleu
✓ data
✓ graphiques
✓ whitespace
✓ typographie nette
✓ chiffres très lisibles
✓ UI mobile-first
✓ animations discrètes
✓ illustrations abstraites

## DON'T

✗ pornographie visuelle
✗ anatomie réaliste
✗ néon permanent
✗ cyberpunk
✗ gaming
✗ rouge/rose sexy
✗ humour vulgaire
✗ emojis
✗ dashboard surchargé
✗ copies de concurrents

---

# 47 — CHECKLIST AVANT LIVRAISON

### Visual
- [ ] Inter chargée
- [ ] palette respectée
- [ ] radii cohérents
- [ ] shadows cohérentes
- [ ] spacing sur grille 4px
- [ ] aucun composant visuellement isolé

### UX
- [ ] une action principale par écran
- [ ] CTA visible mobile
- [ ] états loading/error/success
- [ ] navigation retour cohérente
- [ ] formulaires utilisables au pouce

### Report
- [ ] score dominant
- [ ] percentiles lisibles
- [ ] graphiques non décoratifs
- [ ] unités toujours visibles
- [ ] partage sans données privées

### Technique
- [ ] composants réutilisables
- [ ] tokens centralisés
- [ ] logique métier hors composants UI
- [ ] responsive testé 320 / 375 / 390 / 768 / 1024 / 1440px
- [ ] reduced-motion
- [ ] clavier
- [ ] contrastes

---

# 48 — INSTRUCTION FINALE À CLAUDE

Construire Bitomètre comme un **Design System cohérent**, pas comme une succession de pages.

Toute nouvelle interface doit :
1. réutiliser les tokens ;
2. réutiliser les composants ;
3. respecter la hiérarchie typographique ;
4. respecter les états ;
5. fonctionner mobile et desktop ;
6. rester scientifique, premium et sobre ;
7. ne jamais introduire une esthétique sexuelle explicite ;
8. ne jamais copier une interface concurrente.

**Priorité absolue :**
lisibilité → confiance → compréhension des données → conversion.

Le produit doit donner l'impression d'un **laboratoire statistique grand public construit par une startup IA**, avec une expérience extrêmement simple à utiliser.
