import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";
import { profileById } from "./profiles";
import type { CardContent } from "./share";

export const CARD_SIZES = {
  og: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
} as const;

// Palette de la charte, version « résultat » (fond nuit, comme la carte publique et le bloc de résultat). Aucune image, aucune silhouette.
const C = { bg: "#ffffff", fg: "#10213f", muted: "#425778", accent: "#1769ff" }; // image neutre des pages privées
const N = { bg: "#10213f", tile: "#1b2d4f", line: "#2c4168", fg: "#ffffff", soft: "#c9d6ea", muted: "#9fb3d1", accent: "#9fc2ff" };

/**
 * Image d'une carte de partage : texte et chiffres uniquement. Jamais d'image du corps, jamais de silhouette.
 * Chiffre principal : le premier percentile choisi (« top X % ») s'il y en a un, sinon le score ; le score reste toujours affiché, à part.
 */
export function cardImage(content: CardContent, kind: keyof typeof CARD_SIZES): ImageResponse {
  const { width, height } = CARD_SIZES[kind];
  const story = kind === "story";
  const s = story ? 1.5 : 1; // échelle typographique
  const pad = story ? 90 : 48;
  const lead = content.percentiles[0];
  const rest = content.percentiles.slice(1);
  const lines: { label: string; value: string }[] = [
    ...rest.map((p) => ({ label: p.label, value: `top ${p.topPct} %` })),
    ...(content.landmark ? [{ label: content.landmark.label, value: `${content.landmark.times.toLocaleString("fr-FR")} × moi` }] : []),
    // Profil morphologique : seulement si l'utilisateur l'a choisi (champ absent des cartes plus anciennes ; identifiant inconnu : rien).
    ...(profileById(content.profile) ? [{ label: "Profil", value: profileById(content.profile)!.name }] : []),
  ];
  const basis = content.basis === "declared" ? "Valeurs déclarées" : "Analyse de photo";
  const big = story ? 300 : 150;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: N.bg, color: N.fg, padding: pad, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26 * s, color: N.accent, letterSpacing: 4 }}>{`RAPPORT CLINIQUE N° ${content.dossier}`}</div>
            <div style={{ display: "flex", fontSize: 22 * s, color: N.muted, marginTop: 8 }}>{basis}</div>
          </div>
          {!story && lead && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontSize: 22, color: N.muted }}>Score</div>
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>{String(content.score)}</div>
                <div style={{ display: "flex", fontSize: 26, color: N.muted, marginLeft: 6 }}>/ 100</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: story ? "center" : "flex-start" }}>
          <div style={{ display: "flex", fontSize: 30 * s, color: N.soft }}>{lead ? (story ? `${lead.label} · top` : lead.label) : "Score"}</div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ display: "flex", fontSize: big, fontWeight: 800, lineHeight: 1, letterSpacing: -4 }}>{lead ? (story ? `${lead.topPct} %` : `top ${lead.topPct} %`) : String(content.score)}</div>
            {!lead && <div style={{ display: "flex", fontSize: 50 * s, color: N.muted, marginLeft: 12 }}>/ 100</div>}
          </div>
          {story && lead && (
            <div style={{ display: "flex", fontSize: 54, color: N.soft, marginTop: 30 }}>{`Score ${content.score} / 100`}</div>
          )}
          {lines.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 50 : 18, background: N.tile, border: `2px solid ${N.line}`, borderRadius: 18, padding: story ? "26px 50px" : "8px 28px", minWidth: story ? 760 : 520 }}>
              {lines.map((l) => (
                <div key={l.label} style={{ display: "flex", justifyContent: "space-between", fontSize: story ? 52 : 28, padding: story ? "10px 0" : "3px 0", gap: 60 }}>
                  <div style={{ display: "flex", color: N.muted }}>{l.label}</div>
                  <div style={{ display: "flex", color: N.fg, fontWeight: 700 }}>{l.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 30 * s }}>
          <div style={{ display: "flex", color: N.fg, fontWeight: 700 }}>{SITE.name}</div>
          <div style={{ display: "flex", color: N.accent }}>{`Et vous ? ${SITE.domain}`}</div>
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
