import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { isPublished, loadSeoPages, sitemapEntries } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.SITE_URL ?? `https://${SITE.domain}`).replace(/\/$/, "");
  return sitemapEntries(base, loadSeoPages(), isPublished());
}
