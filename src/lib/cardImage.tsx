import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import type { CardContent } from "./share";

export const CARD_SIZES = {
  og: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
} as const;

// Palette de la charte (clair) : fond blanc, navy, bleu Bitomètre. Aucune image, aucune silhouette.
const C = { bg: "#ffffff", surface: "#f6f9ff", border: "#dce4ed", fg: "#10213f", muted: "#425778", accent: "#1769ff", warm: "#1769ff" };

/** Image d'une carte de partage : texte et chiffres uniquement. Jamais d'image du corps, jamais de silhouette. */
export function cardImage(content: CardContent, kind: keyof typeof CARD_SIZES): ImageResponse {
  const { width, height } = CARD_SIZES[kind];
  const story = kind === "story";
  const s = story ? 1.5 : 1; // échelle typographique
  // Format horizontal : hauteur limitée à 630 px, le contenu doit tenir en entier (pied de page compris).
  const scoreSize = story ? 390 : 170;
  const slashSize = story ? 105 : 56;
  const rowSize = story ? 60 : 32;
  const pad = story ? 90 : 44;

  const lines: { label: string; value: string }[] = [
    ...content.percentiles.map((p) => ({ label: p.label, value: `top ${p.topPct} %` })),
    ...(content.landmark ? [{ label: content.landmark.label, value: `${content.landmark.times.toLocaleString("fr-FR")} × moi` }] : []),
  ];
  const basis = content.basis === "declared" ? "Valeurs déclarées" : "Analyse de photo";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.bg,
          color: C.fg,
          padding: pad,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 28 * s, color: C.accent, letterSpacing: 4 }}>{`RAPPORT CLINIQUE N° ${content.dossier}`}</div>
          <div style={{ display: "flex", fontSize: 24 * s, color: C.muted, marginTop: 10 }}>{basis}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 30 * s, color: C.muted }}>Score</div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ display: "flex", fontSize: scoreSize, color: C.accent, fontWeight: 700, lineHeight: 1 }}>{String(content.score)}</div>
            <div style={{ display: "flex", fontSize: slashSize, color: C.muted, marginLeft: 12 }}>/ 100</div>
          </div>
          {lines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 45 : 18, background: C.surface, border: `2px solid ${C.border}`, borderRadius: 16, padding: story ? "30px 60px" : "10px 32px" }}>
              {lines.map((l) => (
                <div key={l.label} style={{ display: "flex", justifyContent: "space-between", fontSize: rowSize, padding: story ? "12px 0" : "4px 0", gap: story ? 90 : 60 }}>
                  <div style={{ display: "flex", color: C.muted }}>{l.label}</div>
                  <div style={{ display: "flex", color: C.warm }}>{l.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30 * s }}>
          <div style={{ display: "flex", color: C.fg }}>{SITE.name}</div>
          <div style={{ display: "flex", color: C.muted }}>{SITE.domain}</div>
        </div>
      </div>
    ),
    { width, height, headers: { "cache-control": "public, max-age=300" } },
  );
}

/** Image Open Graph neutre pour les pages privées : aucun score, aucune donnée personnelle. */
export function neutralImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg,
          color: C.fg,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, color: C.accent }}>{SITE.name}</div>
        <div style={{ display: "flex", fontSize: 36, color: C.muted, marginTop: 20 }}>{SITE.tagline}</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400" } },
  );
}
