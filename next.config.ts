import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Mise à niveau automatique http → https : seulement si l'adresse publique du site (SITE_URL) est en https, pour ne pas
// casser un essai local du site compilé en http://localhost.
const httpsSite = (process.env.SITE_URL ?? "https://bitometre.com").startsWith("https://");

// Politique de sécurité du contenu (CSP), variante sans nonces : les pages restent statiques (chargement rapide sur mobile).
// Elle bloque malgré tout les scripts, cadres, objets et formulaires venant d'autres sites. Les scripts « inline » sont
// autorisés car Next.js en injecte pour démarrer l'application ; un nonce obligerait à rendre toutes les pages dynamiques.
// Si un prestataire de paiement ou de vérification d'âge charge un script ou un cadre, ajouter son domaine ici (script-src,
// frame-src, connect-src), et nulle part ailleurs.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // Les formulaires renvoient vers la page de paiement (Verotel, FlexPay) et de vérification d'âge (AgeVerif) : seulement ces deux origines
  // en plus du site. Stripe, exclu définitivement par le propriétaire, n'est plus autorisé (son adaptateur reste désactivé dans le code).
  "form-action 'self' https://secure.verotel.com https://api.ageverif.com",
  "frame-ancestors 'none'",
  ...(!isDev && httpsSite ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Date de construction du site, calculée au moment du build (ou au démarrage de `next dev`) : affichée « Version du <date> » dans le
// bandeau défilant de l'accueil. Remplacée dans le code par sa valeur (clé `env` de Next.js), jamais écrite à la main.
const buildDate = new Date().toISOString();

const nextConfig: NextConfig = {
  env: { BITOMETRE_BUILD_DATE: buildDate },
  // Tests de bout en bout : chaque copie du site de test a son propre dossier de travail (voir playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false, // ne pas annoncer la technologie du serveur
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Les adresses privées des rapports ne doivent jamais fuiter dans le Referer : seule l'origine est transmise hors du site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
