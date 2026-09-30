import { commentPrompt, MERGED_SCHEMA, PROMPT_VISION, SYSTEM_COMMENT, SYSTEM_VISION } from "./prompts";
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
    // Raisonnement réduit : essais du 30/09/2026, réduit fortement la durée. Vide = réglage par défaut du modèle.
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

export const xaiVision: VisionProvider = {
  id: "xai",

  async analyse(jpeg) {
    const content = [
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "high" } },
      { type: "text", text: PROMPT_VISION },
    ];
    const body = baseBody(SYSTEM_VISION, content);
    let resp: { json: ChatResponse; ms: number };
    try {
      resp = await chat({ ...body, response_format: { type: "json_schema", json_schema: { name: "recevabilite_reperage", strict: true, schema: MERGED_SCHEMA } } });
    } catch (e) {
      // Repli si le format strict est rejeté ; toute autre erreur remonte telle quelle.
      if (e instanceof VisionError && e.kind === "invalid" && /response_format|schema|json/i.test(e.message)) {
        resp = await chat({ ...body, response_format: { type: "json_object" } });
      } else throw e;
    }
    const choice = resp.json.choices?.[0];
    const usage = usageOf(resp.json, resp.ms);
    if (choice?.message?.refusal || choice?.finish_reason === "content_filter") {
      // Le prestataire refuse d'analyser l'image : on le traite comme une image non recevable, sans détail.
      return { recevable: false, motif: "sujet_non_conforme", reperage: null, usage } satisfies VisionResult;
    }
    const parsed = parseJson(choice?.message?.content ?? "") as { recevable?: unknown; motif?: unknown; reperage?: unknown } | null;
    if (!parsed || typeof parsed.recevable !== "boolean") throw new VisionError("invalid", "réponse non exploitable");
    const motif: Motif = (MOTIFS as readonly string[]).includes(parsed.motif as string) ? (parsed.motif as Motif) : "sujet_non_conforme";
    return { recevable: parsed.recevable, motif, reperage: parsed.reperage ?? null, usage };
  },

  async writeComment(input: CommentInput) {
    const resp = await chat(baseBody(SYSTEM_COMMENT, commentPrompt(input)));
    const text = resp.json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text: text || null, usage: usageOf(resp.json, resp.ms) };
  },
};
