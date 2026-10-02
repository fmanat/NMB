import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateRecevabilite } from "@/lib/vision/schema";
import { xaiVision } from "@/lib/vision/xai";
import { VisionError, type CommentInput } from "@/lib/vision/types";

const JPEG = Buffer.from("faux-octets-de-jpeg-pour-le-test");
const B64 = JPEG.toString("base64");

const reply = (content: unknown, extra: Record<string, unknown> = {}, usage = { prompt_tokens: 2500, completion_tokens: 400 }) => ({
  choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: "stop", ...extra }],
  usage,
});
const V = "photo-report/1";
const RECEVABLE = { schemaVersion: V, recevable: true, motif: "ok" };
const REPERAGE = { schemaVersion: V, coins_carte: [], base: { x: 0, y: 0, confiance: 1 } };
const COMMENTAIRE = { schemaVersion: V, observations: ["a", "b", "c"], verdict: "d" };

type Call = { url: string; init: RequestInit; body: Record<string, unknown>; kind: "recevabilite" | "reperage" | "commentaire" };

/**
 * Simule l'API : la réponse dépend de la nature de l'appel (recevabilité, repérage, commentaire), reconnue à son prompt,
 * pas à l'ordre d'arrivée (les deux appels d'analyse partent en parallèle).
 */
function stubApi(handlers: { recevabilite?: { status?: number; json: unknown }[]; reperage?: { status?: number; json: unknown }[]; commentaire?: { status?: number; json: unknown }[] }) {
  const calls: Call[] = [];
  const idx = { recevabilite: 0, reperage: 0, commentaire: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const userContent = (body.messages as { content: unknown }[])[1].content;
      const text = Array.isArray(userContent) ? (userContent.find((c: { type: string }) => c.type === "text") as { text: string }).text : String(userContent);
      const kind: Call["kind"] = !Array.isArray(userContent) ? "commentaire" : text.startsWith("Contrôle de recevabilité") ? "recevabilite" : "reperage";
      calls.push({ url: String(url), init, body, kind });
      const list = handlers[kind] ?? [];
      const r = list[Math.min(idx[kind]++, list.length - 1)];
      return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
    }),
  );
  return calls;
}

const comment: CommentInput = {
  formula: "B",
  state: "erect",
  score: 80,
  lengthPercentile: 60,
  girthPercentile: 55,
  marginPct: 12,
  symmetry: 92,
  curvatureDeg: 8,
  confidence: 88,
  cardFraction: 0.3,
  tiltDeg: 10,
  declaredGapFlagged: false,
};

beforeEach(() => {
  process.env.XAI_API_KEY = "cle-de-test";
  delete process.env.XAI_MODEL;
  delete process.env.XAI_EFFORT;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fournisseur xAI réel (fetch simulé, aucun appel réseau)", () => {
  it("envoie deux requêtes distinctes, recevabilité et repérage : modèle, raisonnement réduit, JSON strict, image en base64", async () => {
    const calls = stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ json: reply(REPERAGE) }] });
    const r = await xaiVision.analyse(JPEG);
    expect(calls.map((c) => c.kind).sort()).toEqual(["recevabilite", "reperage"]);
    for (const { url, init, body } of calls) {
      expect(url).toBe("https://api.x.ai/v1/chat/completions");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer cle-de-test");
      expect(body.model).toBe("grok-4.7");
      expect(body.reasoning_effort).toBe("low");
      expect(body.temperature).toBe(0);
      const rf = body.response_format as { type: string; json_schema: { strict: boolean; name: string } };
      expect(rf.type).toBe("json_schema");
      expect(rf.json_schema.strict).toBe(true);
      const user = (body.messages as { content: unknown }[])[1].content as { type: string; image_url?: { url: string; detail: string } }[];
      const image = user.find((c) => c.type === "image_url")!;
      expect(image.image_url!.url).toBe(`data:image/jpeg;base64,${B64}`);
      expect(image.image_url!.detail).toBe("high");
      expect(JSON.stringify(body)).not.toContain("store"); // pas d'historique conservé côté serveur
    }
    expect(calls.find((c) => c.kind === "recevabilite")!.body.response_format).toMatchObject({ json_schema: { name: "recevabilite" } });
    expect(calls.find((c) => c.kind === "reperage")!.body.response_format).toMatchObject({ json_schema: { name: "reperage" } });
    expect(r.refused).toBe(false);
    expect(r.recevabilite).toEqual(RECEVABLE); // réponses brutes : validées par le flux d'analyse contre le schéma versionné
    expect(r.reperage).toEqual(REPERAGE);
    // jetons et appels additionnés sur les deux appels
    expect(r.usage.tokensIn).toBe(5000);
    expect(r.usage.tokensOut).toBe(800);
    expect(r.usage.calls).toBe(2);
    // le schéma envoyé impose la version
    for (const c of calls) expect((c.body.response_format as { json_schema: { schema: { properties: { schemaVersion: { enum: string[] } } } } }).json_schema.schema.properties.schemaVersion.enum).toEqual([V]);
  });

  it("les deux appels partent en même temps (aucun n'attend la réponse de l'autre)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: unknown, init: RequestInit) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 30));
        inFlight--;
        const body = JSON.parse(String(init.body));
        const text = (body.messages[1].content.find((c: { type: string }) => c.type === "text") as { text: string }).text;
        return new Response(JSON.stringify(reply(text.startsWith("Contrôle") ? RECEVABLE : REPERAGE)), { status: 200 });
      }),
    );
    await xaiVision.analyse(JPEG);
    expect(maxInFlight).toBe(2);
  });

  it("réglages modifiables : modèle, raisonnement, ou raisonnement par défaut du modèle", async () => {
    process.env.XAI_MODEL = "grok-test";
    process.env.XAI_EFFORT = "minimal";
    let calls = stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ json: reply(REPERAGE) }] });
    await xaiVision.analyse(JPEG);
    expect(calls.every((c) => c.body.model === "grok-test" && c.body.reasoning_effort === "minimal")).toBe(true);

    process.env.XAI_EFFORT = "";
    calls = stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ json: reply(REPERAGE) }] });
    await xaiVision.analyse(JPEG);
    expect(calls.every((c) => !("reasoning_effort" in c.body))).toBe(true);
  });

  it("image non recevable : la panne du repérage est ignorée", async () => {
    stubApi({ recevabilite: [{ json: reply({ ...RECEVABLE, recevable: false, motif: "visage_visible" }) }], reperage: [{ status: 500, json: { error: { message: "panne" } } }] });
    const r = await xaiVision.analyse(JPEG);
    expect(r).toMatchObject({ refused: false, recevabilite: { recevable: false, motif: "visage_visible" }, reperage: null });
  });

  it("un refus du prestataire (refusal ou filtre de contenu), sur l'un ou l'autre appel, devient une image non recevable sans détail", async () => {
    stubApi({
      recevabilite: [{ json: { choices: [{ message: { content: "", refusal: "politique" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 1 } } }],
      reperage: [{ json: reply(REPERAGE) }],
    });
    expect(await xaiVision.analyse(JPEG)).toMatchObject({ refused: true, recevabilite: null, reperage: null });
    stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ json: reply("", { finish_reason: "content_filter" }) }] });
    expect(await xaiVision.analyse(JPEG)).toMatchObject({ refused: true });
  });

  it("un motif inconnu ou une version absente sont renvoyés tels quels : c'est le flux qui les rejette (puis relance une fois)", async () => {
    stubApi({ recevabilite: [{ json: reply({ recevable: false, motif: "motif_invente" }) }], reperage: [{ json: reply(REPERAGE) }] });
    const r = await xaiVision.analyse(JPEG);
    expect(r.recevabilite).toEqual({ recevable: false, motif: "motif_invente" });
    expect(validateRecevabilite(r.recevabilite)).toBeNull();
  });

  it("si le format JSON strict est rejeté, une requête moins stricte est envoyée pour cet appel", async () => {
    const calls = stubApi({
      recevabilite: [{ json: reply(RECEVABLE) }],
      reperage: [
        { status: 400, json: { error: { message: "response_format json_schema is not supported with images" } } },
        { json: reply(REPERAGE) },
      ],
    });
    const r = await xaiVision.analyse(JPEG);
    const reperageCalls = calls.filter((c) => c.kind === "reperage");
    expect(reperageCalls).toHaveLength(2);
    expect((reperageCalls[1].body.response_format as { type: string }).type).toBe("json_object");
    expect(r.reperage).toEqual(REPERAGE);
    expect(r.usage.calls).toBe(3);
  });

  it("erreurs : clé refusée, accès refusé, réponse illisible, repérage en panne sur une photo recevable, panne réseau, clé absente", async () => {
    stubApi({ recevabilite: [{ status: 401, json: { error: { message: "Incorrect API key provided" } } }], reperage: [{ json: reply(REPERAGE) }] });
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "auth" });
    stubApi({ recevabilite: [{ status: 403, json: { error: "interdit" } }], reperage: [{ json: reply(REPERAGE) }] });
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "policy" });
    stubApi({ recevabilite: [{ json: reply("ceci n'est pas du JSON") }], reperage: [{ json: reply(REPERAGE) }] });
    expect((await xaiVision.analyse(JPEG)).recevabilite).toBeNull(); // illisible : rejeté puis relancé par le flux
    stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ status: 500, json: { error: { message: "panne" } } }] });
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "invalid" });
    stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ json: reply("pas du JSON non plus") }] });
    expect((await xaiVision.analyse(JPEG)).reperage).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("réseau coupé"))));
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "network" });
    delete process.env.XAI_API_KEY;
    await expect(xaiVision.analyse(JPEG)).rejects.toBeInstanceOf(VisionError);
  });

  it("n'écrit jamais l'image ni la clé dans les journaux", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    stubApi({ recevabilite: [{ json: reply(RECEVABLE) }], reperage: [{ json: reply(REPERAGE) }] });
    await xaiVision.analyse(JPEG);
    stubApi({ recevabilite: [{ status: 401, json: { error: { message: "Incorrect API key provided" } } }], reperage: [{ json: reply(REPERAGE) }] });
    await xaiVision.analyse(JPEG).catch(() => {});
    const logged = spies.flatMap((s) => s.mock.calls.map((c) => c.join(" "))).join("\n");
    expect(logged).not.toContain(B64);
    expect(logged).not.toContain("data:image");
    expect(logged).not.toContain("cle-de-test");
  });

  it("le message d'erreur ne contient ni l'image ni la clé", async () => {
    stubApi({ recevabilite: [{ status: 401, json: { error: { message: "Incorrect API key provided" } } }], reperage: [{ json: reply(REPERAGE) }] });
    const e = (await xaiVision.analyse(JPEG).catch((x) => x)) as Error;
    expect(e.message).not.toContain("cle-de-test");
    expect(e.message).not.toContain(B64);
  });

  it("la rédaction est un appel texte seul en JSON strict (schéma versionné « commentaire ») : des indicateurs en mots, jamais la photo ni une mesure", async () => {
    const calls = stubApi({ commentaire: [{ json: reply(COMMENTAIRE) }] });
    const r = await xaiVision.writeComment(comment);
    expect(r.json).toEqual(COMMENTAIRE);
    expect(r.usage.calls).toBe(1);
    expect(calls).toHaveLength(1);
    const body = JSON.stringify(calls[0].body);
    expect(body).not.toContain("image_url");
    expect(body).not.toContain("base64");
    expect(body).not.toMatch(/\bcm\b/);
    expect(body).toContain("zone médiane");
    const rf = calls[0].body.response_format as { type: string; json_schema: { name: string; strict: boolean; schema: { required: string[] } } };
    expect(rf.type).toBe("json_schema");
    expect(rf.json_schema.name).toBe("commentaire");
    expect(rf.json_schema.strict).toBe(true);
    expect(rf.json_schema.schema.required).toEqual(["schemaVersion", "observations", "verdict"]);
  });

  it("rédaction refusée par le prestataire ou illisible : json nul (le flux relance une fois, puis refuse)", async () => {
    stubApi({ commentaire: [{ json: { choices: [{ message: { content: "", refusal: "politique" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 1 } } }] });
    expect((await xaiVision.writeComment(comment)).json).toBeNull();
    stubApi({ commentaire: [{ json: reply("du texte libre, pas du JSON") }] });
    expect((await xaiVision.writeComment(comment)).json).toBeNull();
  });
});
