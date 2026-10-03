import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SITE } from "@/config/site";
import { isFreeBeta } from "@/lib/mode";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { RevealOnView } from "@/components/RevealOnView";
import { siteGraph, toJsonLd } from "@/lib/structuredData";

const sans = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

const beta = isFreeBeta();

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s — ${SITE.name}` },
  description:
    "Analyse biométrique chiffrée : score, percentiles, courbure, symétrie. " + (beta ? "Bêta gratuite, aucun compte." : "Paiement unique, aucun compte."),
  metadataBase: new URL(process.env.SITE_URL ?? `https://${SITE.domain}`),
  // Image de partage par défaut (pages légales) ; les pages publiques de contenu et l'accueil ont la leur (titre et chiffre clé).
  openGraph: { siteName: SITE.name, locale: "fr_FR", images: [{ url: "/og/neutre", width: 1200, height: 630 }] },
};

export default function RootLayout({ children, bandeau }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a href="#contenu" className="skip-link">Aller au contenu</a>
        {/* Bandeau défilant : tout en haut de l'accueil seulement (route parallèle src/app/@bandeau) ; vide ailleurs. */}
        {bandeau}
        <Header />
        <main id="contenu" tabIndex={-1} className="flex-1">{children}</main>
        <Footer />
        <RevealOnView />
        {/* Données structurées du site (WebSite, Organization) : nom de marque seulement. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(siteGraph()) }} />
      </body>
    </html>
  );
}
