import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

// Pages privées ou sans intérêt pour un moteur de recherche. /c/ et /og/ restent accessibles aux robots d'aperçu des
// réseaux sociaux (les cartes sont en noindex par leurs balises).
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL ?? `https://${SITE.domain}`).replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/r/", "/paiement/", "/defi/", "/api/", "/analyse/", "/verification-age/", "/admin/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
