import sharp from "sharp";
import { assertNotProduction } from "../providers/guard";
import type { CommentInput, Motif, VisionProvider, VisionResult } from "./types";

export type Scenario = "ok" | "refuse_face" | "doute_majorite" | "no_card" | "low_confidence" | "implausible" | "garbage";

const VW = 1200;
const VH = 800;
const PX_PER_MM = 342 / 85.6; // carte de 342 px de large dans la scène virtuelle

const n = (x: number, y: number, c: number) => ({ x: x / VW, y: y / VH, confiance: c });

/** Scène virtuelle : une carte de référence et un objet cylindrique, vue de face. Coordonnées normalisées. */
function scene(lengthMm: number, widthMm: number, confidence: number) {
  const cardW = 85.6 * PX_PER_MM;
  const cardH = 53.98 * PX_PER_MM;
  const cx = 140;
  const cy = 500;
  const x0 = 500;
  const y0 = 350;
  const L = lengthMm * PX_PER_MM;
  const W = widthMm * PX_PER_MM;
  return {
    coins_carte: [n(cx, cy, confidence), n(cx + cardW, cy, confidence), n(cx + cardW, cy + cardH, confidence), n(cx, cy + cardH, confidence)],
    base: n(x0, y0, confidence),
    extremite: n(x0 + L, y0, confidence),
    ligne_mediane: Array.from({ length: 9 }, (_, i) => n(x0 + (L * (i + 1)) / 10, y0, confidence)),
    bords: (["base", "25", "50", "75", "sous_gland"] as const).map((hauteur, i) => {
      const x = x0 + L * [0, 0.25, 0.5, 0.75, 0.95][i];
      return { hauteur, gauche: n(x, y0 - W / 2, confidence), droite: n(x, y0 + W / 2, confidence) };
    }),
  };
}

const REFUSALS: Partial<Record<Scenario, Motif>> = {
  refuse_face: "visage_visible",
  doute_majorite: "doute_majorite",
  no_card: "carte_absente_ou_illisible",
};

/**
 * Fournisseur de vision simulé : aucun appel réseau, aucun coût, résultats déterministes.
 * Scénario choisi par SIM_VISION_SCENARIO ou par le paramètre (tests).
 */
export function createSimulatedVision(scenario?: Scenario, opts: { lengthMm?: number; widthMm?: number } = {}): VisionProvider {
  return {
    id: "simulation",

    async analyse(jpeg): Promise<VisionResult> {
      assertNotProduction("vision");
      await sharp(jpeg).metadata(); // vérifie que l'image est lisible, comme le ferait le vrai modèle
      const s = scenario ?? ((process.env.SIM_VISION_SCENARIO as Scenario) || "ok");
      const usage = { tokensIn: 0, tokensOut: 0, ms: 5 };
      const refusal = REFUSALS[s];
      if (refusal) return { recevable: false, motif: refusal, reperage: null, usage };
      if (s === "garbage") return { recevable: true, motif: "ok", reperage: { coins_carte: [] }, usage };
      if (s === "low_confidence") return { recevable: true, motif: "ok", reperage: scene(130, 40, 0.3), usage };
      if (s === "implausible") return { recevable: true, motif: "ok", reperage: scene(15, 4, 0.9), usage };
      return { recevable: true, motif: "ok", reperage: scene(opts.lengthMm ?? 130, opts.widthMm ?? 40, 0.9), usage };
    },

    async writeComment(i: CommentInput) {
      assertNotProduction("vision");
      const words = Array.from({ length: 130 }, (_, k) => (k % 13 === 12 ? "estimation." : "mesure"));
      return {
        text: `Commentaire simulé (score ${i.score}). ${words.join(" ")}`,
        usage: { tokensIn: 0, tokensOut: 0, ms: 5 },
      };
    },
  };
}
