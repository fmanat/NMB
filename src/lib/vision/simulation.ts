import sharp from "sharp";
import { CAMERA } from "@/config/site";
import { assertNotProduction } from "../providers/guard";
import { DEFAULT_SHOT, simulateShot } from "./camera-sim";
import { PHOTO_REPORT_SCHEMA_VERSION } from "./schema";
import type { Motif, Usage, VisionProvider, VisionResult } from "./types";

export type Scenario =
  | "ok"
  | "refuse_face"
  | "doute_majorite"
  | "no_card"
  | "low_confidence"
  | "implausible"
  | "garbage"
  | "garbage_once"
  | "tilt_too_strong"
  | "card_too_small"
  | "comment_digit"
  | "comment_two"
  | "comment_four"
  | "comment_invalid_once"
  | "comment_refused";

const REFUSALS: Partial<Record<Scenario, Motif>> = {
  refuse_face: "visage_visible",
  doute_majorite: "doute_majorite",
  no_card: "carte_absente_ou_illisible",
};

/** Commentaire simulé conforme au schéma : trois observations courtes et un verdict, sans chiffre ni terme interdit. */
export const SIMULATED_OBSERVATIONS: readonly [string, string, string] = [
  "Le repérage des points présente une qualité élevée, la carte de référence étant entière et nettement lisible.",
  "Le cadrage et l'inclinaison de la prise de vue restent dans la plage où le calcul conserve une marge d'erreur proche du plancher.",
  "Les estimations de longueur et de circonférence sont cohérentes et se situent dans la zone médiane de la population de référence.",
];
export const SIMULATED_VERDICT = "Le laboratoire conclut à une analyse exploitable, dont les valeurs restent des estimations issues d'une photographie.";

const noTokens = (calls: number): Usage => ({ tokensIn: 0, tokensOut: 0, ms: 5, calls });

/**
 * Fournisseur de vision simulé : aucun appel réseau, aucun coût, résultats déterministes.
 * Les points repérés viennent d'un vrai modèle de prise de vue (caméra sténopé, carte et cylindre posés sur une table),
 * cohérent avec le calcul de mesure ; la focale simulée est celle que le calcul suppose (CAMERA.focalFactor).
 * Scénario choisi par SIM_VISION_SCENARIO ou par le paramètre (tests). Une instance par analyse : les scénarios « _once »
 * (réponse invalide une fois, puis valide à la relance) comptent les appels de l'instance.
 */
export function createSimulatedVision(scenario?: Scenario, opts: { lengthMm?: number; widthMm?: number } = {}): VisionProvider {
  let analyseCalls = 0;
  let commentCalls = 0;
  const pick = (): Scenario => scenario ?? ((process.env.SIM_VISION_SCENARIO as Scenario) || "ok");
  return {
    id: "simulation",

    async analyse(jpeg): Promise<VisionResult> {
      assertNotProduction("vision");
      analyseCalls++;
      const meta = await sharp(jpeg).metadata(); // vérifie que l'image est lisible, comme le ferait le vrai modèle
      const width = meta.width ?? 1200;
      const height = meta.height ?? 800;
      const longSide = Math.max(width, height);
      const s = pick();
      const usage = noTokens(2);
      const refusal = REFUSALS[s];
      const ok = (reperage: unknown): VisionResult => ({ refused: false, recevabilite: { schemaVersion: PHOTO_REPORT_SCHEMA_VERSION, recevable: true, motif: "ok" }, reperage, usage });
      if (refusal) return { refused: false, recevabilite: { schemaVersion: PHOTO_REPORT_SCHEMA_VERSION, recevable: false, motif: refusal }, reperage: null, usage };
      if (s === "garbage" || (s === "garbage_once" && analyseCalls === 1)) return ok({ schemaVersion: PHOTO_REPORT_SCHEMA_VERSION, coins_carte: [] });

      const shot = (over: Parameters<typeof simulateShot>[0] = {}) => ({
        schemaVersion: PHOTO_REPORT_SCHEMA_VERSION,
        ...simulateShot({
          ...DEFAULT_SHOT,
          width,
          height,
          focalPx: CAMERA.focalFactor * longSide,
          cardWidthPx: 0.3 * longSide,
          azimuthDeg: -90, // l'axe X de la scène suit la largeur de l'image
          lengthMm: opts.lengthMm ?? 130,
          diameterMm: opts.widthMm ?? 40,
          ...over,
        }).reperage,
      });

      if (s === "low_confidence") return ok(shot({ confidence: 0.3 }));
      if (s === "implausible") return ok(shot({ lengthMm: 15, diameterMm: 4 }));
      if (s === "tilt_too_strong") return ok(shot({ tiltDeg: 62 }));
      if (s === "card_too_small") return ok(shot({ cardWidthPx: 0.06 * longSide }));
      return ok(shot());
    },

    async writeComment() {
      assertNotProduction("vision");
      commentCalls++;
      const s = pick();
      const usage = noTokens(1);
      const valid = { schemaVersion: PHOTO_REPORT_SCHEMA_VERSION, observations: [...SIMULATED_OBSERVATIONS], verdict: SIMULATED_VERDICT };
      if (s === "comment_refused") return { json: null, usage };
      if (s === "comment_digit" || (s === "comment_invalid_once" && commentCalls === 1)) {
        return { json: { ...valid, observations: [valid.observations[0], "La carte occupe 30 % du grand côté de l'image.", valid.observations[2]] }, usage };
      }
      if (s === "comment_two") return { json: { ...valid, observations: valid.observations.slice(0, 2) }, usage };
      if (s === "comment_four") return { json: { ...valid, observations: [...valid.observations, valid.observations[0]] }, usage };
      return { json: valid, usage };
    },
  };
}
