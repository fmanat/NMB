import { ImageResponse } from "next/og";
import { REFERENCE_SOURCE, SITE } from "@/config/site";
import { getSeoPage, loadSeoPages, SIZE_AXES } from "./seo";
import { evalFigure, rankLabel, rawPercentile } from "./seoFigures";

// Image de partage propre à chaque page publique : titre et un chiffre clé calculé par le site. Texte uniquement, aucune silhouette.

const C = { bg: "#ffffff", surface: "#f6f9ff", border: "#dce4ed", fg: "#10213f", muted: "#425778", accent: "#1769ff" };

export type PageImageContent = { title: string; figure: string; label: string };

/** Pages hors contenu Markdown qui ont leur image. */
const FIXED: Record<string, () => PageImageContent> = {
  accueil: () => ({ title: "À quel percentile êtes-vous ?", figure: evalFigure("moyenne:erect-length"), label: `longueur moyenne en érection (${REFERENCE_SOURCE})` }),
  presse: () => ({ title: "Graphiques et chiffres pour la presse", figure: evalFigure("effectif-total"), label: `hommes mesurés dans la synthèse de référence (${REFERENCE_SOURCE})` }),
};

export const pageImageSlugs = () => [...Object.keys(FIXED), ...loadSeoPages().map((p) => p.slug)];

/** Contenu de l'image d'une page, ou null si la page n'existe pas. */
export function pageImageContent(slug: string): PageImageContent | null {
  if (FIXED[slug]) return FIXED[slug]();
  const page = getSeoPage(slug);
  if (!page) return null;
  if (page.size) {
    const { axis, cm } = page.size;
    const rank = rankLabel(rawPercentile(SIZE_AXES[axis].series, cm));
    const what = axis === "girth" ? `circonférence de ${cm} cm en érection` : `${cm} cm en érection`;
    return { title: page.h1, figure: rank.charAt(0).toUpperCase() + rank.slice(1), label: `${what} (${REFERENCE_SOURCE})` };
  }
  if (page.ogFigure && page.ogLabel) return { title: page.h1, figure: page.ogFigure, label: page.ogLabel };
  return { title: page.h1, figure: evalFigure("moyenne:erect-length"), label: `longueur moyenne en érection (${REFERENCE_SOURCE})` };
}

export function pageImage(c: PageImageContent): ImageResponse {
  const long = c.figure.length > 14;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: C.bg, color: C.fg, padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, color: C.accent, letterSpacing: 3 }}>{SITE.name.toUpperCase()}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: c.title.length > 48 ? 50 : 60, fontWeight: 700, lineHeight: 1.15 }}>{c.title}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 36, background: C.surface, border: `2px solid ${C.border}`, borderRadius: 18, padding: "22px 32px" }}>
            <div style={{ display: "flex", fontSize: long ? 56 : 76, color: C.accent, fontWeight: 700, lineHeight: 1.1 }}>{c.figure}</div>
            <div style={{ display: "flex", fontSize: 26, color: C.muted, marginTop: 8 }}>{c.label}</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: C.muted }}>{`${SITE.domain} · statistiques, pas un avis médical`}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400" } },
  );
}
