import {
  PROMPT_RECEVABILITE,
  PROMPT_REPERAGE,
  RECEVABILITE_SCHEMA,
  REPERAGE_SCHEMA,
  SYSTEM_COMMENT,
  SYSTEM_VISION,
  commentPrompt,
} from "./prompts";
import { MOTIFS, VisionError, type CommentInput, type Motif, type Usage, type VisionProvider, type VisionResult } from "./types";

const API_URL = "https://api.x.ai/v1/chat/completions";
const TIMEOUT_MS = 150_000;

type ChatResponse = {
  choices?: { message?: { content?: string; refusal?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
};

function config() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new VisionError("auth", "XAI_API_KEY manquant");
  return {
    key,
    model: process.env.XAI_MODEL || "grok-4.7",
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

function usageOf(json: ChatResponse, ms: number): Usage {
  return { tokensIn: json.usage?.prompt_tokens ?? 0, tokensOut: json.usage?.completion_tokens ?? 0, ms };
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

/** Un appel de vision en JSON strict ; si le format strict est rejeté, une requête moins stricte est tentée. */
async function visionCall(jpeg: Buffer, prompt: string, name: string, schema: object): Promise<Parsed> {
  const content = [
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "high" } },
    { type: "text", text: prompt },
  ];
  const body = baseBody(SYSTEM_VISION, content);
  let resp: { json: ChatResponse; ms: number };
  try {
    resp = await chat({ ...body, response_format: { type: "json_schema", json_schema: { name, strict: true, schema } } });
  } catch (e) {
    if (e instanceof VisionError && e.kind === "invalid" && /response_format|schema|json/i.test(e.message)) {
      resp = await chat({ ...body, response_format: { type: "json_object" } });
    } else throw e;
  }
  const choice = resp.json.choices?.[0];
  const usage = usageOf(resp.json, resp.ms);
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter") return { json: null, refused: true, usage };
  return { json: parseJson(choice?.message?.content ?? ""), refused: false, usage };
}

export const xaiVision: VisionProvider = {
  id: "xai",

  /**
   * Recevabilité et repérage : deux appels distincts lancés EN MÊME TEMPS. Mesuré le 01/10/2026 : attente médiane de 17,7 s
   * avec une confiance de repérage de 0,92 à 0,93, contre 34 s pour les mêmes appels à la suite et des confiances très
   * instables (0,12 à 0,89) pour un appel unique fusionné. Inconvénient accepté : le repérage est payé même si la photo est refusée.
   */
  async analyse(jpeg) {
    const t0 = Date.now();
    const [a, b] = await Promise.allSettled([
      visionCall(jpeg, PROMPT_RECEVABILITE, "recevabilite", RECEVABILITE_SCHEMA),
      visionCall(jpeg, PROMPT_REPERAGE, "reperage", REPERAGE_SCHEMA),
    ]);
    if (a.status === "rejected") throw a.reason;
    const usage = (): Usage => {
      const sum = (f: (u: Usage) => number) => f(a.value.usage) + (b.status === "fulfilled" ? f(b.value.usage) : 0);
      return { tokensIn: sum((u) => u.tokensIn), tokensOut: sum((u) => u.tokensOut), ms: Date.now() - t0 };
    };

    // Un refus du prestataire d'analyser l'image est traité comme une image non recevable, sans détail.
    if (a.value.refused || (b.status === "fulfilled" && b.value.refused)) {
      return { recevable: false, motif: "sujet_non_conforme", reperage: null, usage: usage() } satisfies VisionResult;
    }
    const parsed = a.value.json as { recevable?: unknown; motif?: unknown } | null;
    if (!parsed || typeof parsed.recevable !== "boolean") throw new VisionError("invalid", "réponse non exploitable");
    const motif: Motif = (MOTIFS as readonly string[]).includes(parsed.motif as string) ? (parsed.motif as Motif) : "sujet_non_conforme";
    if (!parsed.recevable) return { recevable: false, motif, reperage: null, usage: usage() };

    // Photo recevable : le repérage est indispensable.
    if (b.status === "rejected") throw b.reason;
    if (!b.value.json) throw new VisionError("invalid", "réponse non exploitable");
    return { recevable: true, motif, reperage: b.value.json, usage: usage() };
  },

  async writeComment(input: CommentInput) {
    const resp = await chat(baseBody(SYSTEM_COMMENT, commentPrompt(input)));
    const text = resp.json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text: text || null, usage: usageOf(resp.json, resp.ms) };
  },
};
