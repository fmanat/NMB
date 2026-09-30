import type { Metadata } from "next";
import { Sora, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE } from "@/config/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const sans = Sora({ variable: "--font-sans-geo", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s — ${SITE.name}` },
  description:
    "Analyse biométrique chiffrée : score, percentiles, courbure, symétrie. Paiement unique, aucun compte.",
  metadataBase: new URL(process.env.SITE_URL ?? `https://${SITE.domain}`),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
