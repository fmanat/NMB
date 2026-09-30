import sharp from "sharp";
import { CAMERA } from "@/config/site";
import { assertNotProduction } from "../providers/guard";
import { DEFAULT_SHOT, simulateShot } from "./camera-sim";
import type { CommentInput, Motif, VisionProvider, VisionResult } from "./types";

export type Scenario =
  | "ok"
  | "refuse_face"
  | "doute_majorite"
  | "no_card"
  | "low_confidence"
  | "implausible"
  | "garbage"
  | "tilt_too_strong"
  | "card_too_small";

const REFUSALS: Partial<Record<Scenario, Motif>> = {
  refuse_face: "visage_visible",
  doute_majorite: "doute_majorite",
  no_card: "carte_absente_ou_illisible",
};

/**
 * Fournisseur de vision simulé : aucun appel réseau, aucun coût, résultats déterministes.
 * Les points repérés viennent d'un vrai modèle de prise de vue (caméra sténopé, carte et cylindre posés sur une table),
 * cohérent avec le calcul de mesure ; la focale simulée est celle que le calcul suppose (CAMERA.focalFactor).
 * Scénario choisi par SIM_VISION_SCENARIO ou par le paramètre (tests).
 */
export function createSimulatedVision(scenario?: Scenario, opts: { lengthMm?: number; widthMm?: number } = {}): VisionProvider {
  return {
    id: "simulation",

    async analyse(jpeg): Promise<VisionResult> {
      assertNotProduction("vision");
      const meta = await sharp(jpeg).metadata(); // vérifie que l'image est lisible, comme le ferait le vrai modèle
      const width = meta.width ?? 1200;
      const height = meta.height ?? 800;
      const longSide = Math.max(width, height);
      const s = scenario ?? ((process.env.SIM_VISION_SCENARIO as Scenario) || "ok");
      const usage = { tokensIn: 0, tokensOut: 0, ms: 5 };
      const refusal = REFUSALS[s];
      if (refusal) return { recevable: false, motif: refusal, reperage: null, usage };
      if (s === "garbage") return { recevable: true, motif: "ok", reperage: { coins_carte: [] }, usage };

      const shot = (over: Parameters<typeof simulateShot>[0] = {}) =>
        simulateShot({
          ...DEFAULT_SHOT,
          width,
          height,
          focalPx: CAMERA.focalFactor * longSide,
          cardWidthPx: 0.3 * longSide,
          azimuthDeg: -90, // l'axe X de la scène suit la largeur de l'image
          lengthMm: opts.lengthMm ?? 130,
          diameterMm: opts.widthMm ?? 40,
          ...over,
        }).reperage;

      if (s === "low_confidence") return { recevable: true, motif: "ok", reperage: shot({ confidence: 0.3 }), usage };
      if (s === "implausible") return { recevable: true, motif: "ok", reperage: shot({ lengthMm: 15, diameterMm: 4 }), usage };
      if (s === "tilt_too_strong") return { recevable: true, motif: "ok", reperage: shot({ tiltDeg: 62 }), usage };
      if (s === "card_too_small") return { recevable: true, motif: "ok", reperage: shot({ cardWidthPx: 0.06 * longSide }), usage };
      return { recevable: true, motif: "ok", reperage: shot(), usage };
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
