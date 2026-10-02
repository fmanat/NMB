import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SITE } from "@/config/site";
import { isFreeBeta } from "@/lib/mode";
import { Header } from "@/components/navigation/Header";
import { Footer } from "@/components/navigation/Footer";
import { RevealOnView } from "@/components/RevealOnView";

const sans = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

const beta = isFreeBeta();

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s — ${SITE.name}` },
  description:
    "Analyse biométrique chiffrée : score, percentiles, courbure, symétrie. " + (beta ? "Bêta gratuite, aucun compte." : "Paiement unique, aucun compte."),
  metadataBase: new URL(process.env.SITE_URL ?? `https://${SITE.domain}`),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a href="#contenu" className="skip-link">Aller au contenu</a>
        <Header />
        <main id="contenu" tabIndex={-1} className="flex-1">{children}</main>
        <Footer />
        <RevealOnView />
      </body>
    </html>
  );
}
