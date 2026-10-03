import { PROMPT_VISION_V2, SYSTEM_TEXT_V2, SYSTEM_VISION_V2, textPrompt } from "./prompts";
import { reportTextJsonSchema } from "./reportText";
import { VISION_SCHEMA_V2 } from "./schema2";
import { VisionError, type ReportTextInput, type Usage, type VisionProvider } from "./types";

const API_URL = "https://api.x.ai/v1/chat/completions";
const TIMEOUT_MS = 150_000;
/** Modèle de rédaction par défaut : sans raisonnement (réglable par XAI_TEXT_MODEL). */
export const DEFAULT_TEXT_MODEL = "grok-4.20-0309-non-reasoning";

type ChatResponse = {
  choices?: { message?: { content?: string; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  error?: { message?: string } | string;
};

function config() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new VisionError("auth", "XAI_API_KEY manquant");
  return {
    key,
    model: process.env.XAI_MODEL || "grok-4.7",
    // Modèle de la rédaction (appel texte, sans la photo) : sans raisonnement par défaut. Mesuré le 03/10/2026 avec grok-4.7
    // (raisonnement « low ») : 199 s et environ 0,11 $ pour une rédaction, ce qui dépasse le délai de la page d'analyse.
    textModel: process.env.XAI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
    // Raisonnement réduit : mesuré le 01/10/2026 (docs/DECISIONS.md). Vide = réglage par défaut du modèle, beaucoup plus lent.
    effort: process.env.XAI_EFFORT === undefined ? "low" : process.env.XAI_EFFORT,
  };
}

async function chat(body: Record<string, unknown>): Promise<{ json: ChatResponse; ms: number }> {
  const { key } = config();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } catch (e) {
    throw new VisionError(ctl.signal.aborted ? "timeout" : "network", String((e as Error).message ?? e));
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: ChatResponse;
  try {
    json = JSON.parse(text) as ChatResponse;
  } catch {
    json = {};
  }
  if (!res.ok) {
    const msg = typeof json.error === "string" ? json.error : (json.error?.message ?? text.slice(0, 200));
    if (res.status === 401 || /api key/i.test(msg)) throw new VisionError("auth", "clé API refusée");
    if (res.status === 403) throw new VisionError("policy", "accès refusé par le prestataire");
    throw new VisionError("invalid", `HTTP ${res.status} : ${msg.slice(0, 200)}`);
  }
  return { json, ms: Date.now() - t0 };
}

function usageOf(json: ChatResponse, ms: number, calls: number): Usage {
  // Les jetons de raisonnement sont facturés comme des jetons de sortie (documentation xAI) : ils sont comptés avec eux.
  // Mesuré le 03/10/2026 : 16 132 jetons de raisonnement pour 1 487 jetons de texte sur une rédaction, soit l'essentiel du coût.
  const out = (json.usage?.completion_tokens ?? 0) + (json.usage?.completion_tokens_details?.reasoning_tokens ?? 0);
  return { tokensIn: json.usage?.prompt_tokens ?? 0, tokensOut: out, ms, calls };
}

function baseBody(system: string, content: unknown) {
  const { model, effort } = config();
  return {
    model,
    temperature: 0,
    ...(effort ? { reasoning_effort: effort } : {}),
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

type Parsed = { json: unknown; refused: boolean; usage: Usage };

/**
 * Un appel en JSON strict (sortie structurée : schéma JSON versionné) ; si le format strict est rejeté par l'API, une requête
 * en « json_object » est tentée (la validation zod du flux d'analyse reste la garantie finale).
 */
async function structuredCall(body: ReturnType<typeof baseBody> & { temperature?: number }, name: string, schema: object): Promise<Parsed> {
  let resp: { json: ChatResponse; ms: number };
  let calls = 1;
  try {
    resp = await chat({ ...body, response_format: { type: "json_schema", json_schema: { name, strict: true, schema } } });
  } catch (e) {
    if (e instanceof VisionError && e.kind === "invalid" && /response_format|schema|json/i.test(e.message)) {
      calls = 2;
      resp = await chat({ ...body, response_format: { type: "json_object" } });
    } else throw e;
  }
  const choice = resp.json.choices?.[0];
  const usage = usageOf(resp.json, resp.ms, calls);
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter") return { json: null, refused: true, usage };
  return { json: parseJson(choice?.message?.content ?? ""), refused: false, usage };
}

function visionCall(jpeg: Buffer): Promise<Parsed> {
  const content = [
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "high" } },
    { type: "text", text: PROMPT_VISION_V2 },
  ];
  return structuredCall(baseBody(SYSTEM_VISION_V2, content), "analyse_photo", VISION_SCHEMA_V2);
}

/** Température de la rédaction : un peu de variété dans le vocabulaire (et une relance qui ne recopie pas la première réponse). */
const TEXT_TEMPERATURE = 0.4;

export const xaiVision: VisionProvider = {
  id: "xai",

  /**
   * Appel vision unique (photo-report/2) : recevabilité, estimations, observations et, si la carte est lisible, points de repérage.
   * Un refus du prestataire d'analyser l'image est signalé (`refused`) : le flux le traite comme une image non recevable, sans détail.
   */
  async analyse(jpeg) {
    const r = await visionCall(jpeg);
    return { refused: r.refused, json: r.refused ? null : r.json, usage: r.usage };
  },

  /** Appel texte (sans la photo) : rédaction du rapport en JSON strict, vérifiée ensuite par le flux d'analyse. */
  async writeReport(input: ReportTextInput) {
    const { textModel } = config();
    const base = baseBody(SYSTEM_TEXT_V2, textPrompt(input));
    // Un modèle sans raisonnement n'accepte pas de réglage de raisonnement : il n'est envoyé qu'aux modèles qui raisonnent.
    const { reasoning_effort: effort, ...rest } = base as typeof base & { reasoning_effort?: string };
    const body = { ...rest, model: textModel, temperature: TEXT_TEMPERATURE, ...(effort && !/non-reasoning/.test(textModel) ? { reasoning_effort: effort } : {}) };
    const r = await structuredCall(body, "rapport", reportTextJsonSchema(input.allowedHighlights));
    return { refused: r.refused, json: r.refused ? null : r.json, usage: r.usage };
  },
};
