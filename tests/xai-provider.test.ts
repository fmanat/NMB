import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeIndicators, favourableIndicators } from "@/lib/morpho";
import { PHOTO_REPORT_V2, validateVisionV2 } from "@/lib/vision/schema2";
import { SIMULATED_ESTIMATES, SIMULATED_OBSERVATIONS } from "@/lib/vision/simulation";
import { VisionError, type ReportTextInput } from "@/lib/vision/types";
import { xaiVision } from "@/lib/vision/xai";

// Fournisseur xAI réel, version photo-report/2 : deux appels (vision avec la photo, puis texte sans la photo). fetch simulé, aucun réseau.

const JPEG = Buffer.from("faux-octets-de-jpeg-pour-le-test");
const B64 = JPEG.toString("base64");

const reply = (content: unknown, extra: Record<string, unknown> = {}, usage = { prompt_tokens: 2500, completion_tokens: 400 }) => ({
  choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: "stop", ...extra }],
  usage,
});
const zero = { x: 0, y: 0, confiance: 0 };
const VISION = {
  schemaVersion: PHOTO_REPORT_V2,
  recevabilite: { recevable: true, motif: "ok" },
  estimations: { ...SIMULATED_ESTIMATES },
  observations: { ...SIMULATED_OBSERVATIONS },
  reperage: { coins_carte: [], base: zero, extremite: zero, ligne_mediane: [], bords: [] },
};
const TEXT = { schemaVersion: PHOTO_REPORT_V2, synthese: "…" };

type Call = { url: string; init: RequestInit; body: Record<string, unknown>; kind: "vision" | "texte" };

/** Simule l'API : la réponse dépend de la nature de l'appel (avec image : vision ; sans image : texte). */
function stubApi(handlers: { vision?: { status?: number; json: unknown }[]; texte?: { status?: number; json: unknown }[] }) {
  const calls: Call[] = [];
  const idx = { vision: 0, texte: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      const userContent = (body.messages as { content: unknown }[])[1].content;
      const kind: Call["kind"] = Array.isArray(userContent) ? "vision" : "texte";
      calls.push({ url: String(url), init, body, kind });
      const list = handlers[kind] ?? [];
      const r = list[Math.min(idx[kind]++, list.length - 1)];
      return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
    }),
  );
  return calls;
}

const ind = computeIndicators({ state: "erect", lengthCm: 14.2, girthCm: 12.1, curvatureDeg: 8, direction: "left", symmetry: 93, glansRatio: 0.24, taperRatio: 0.92 });
const textInput: ReportTextInput = { indicators: ind, method: "visuelle", observations: SIMULATED_OBSERVATIONS, allowedHighlights: favourableIndicators(ind) };

beforeEach(() => {
  process.env.XAI_API_KEY = "cle-de-test";
  delete process.env.XAI_MODEL;
  delete process.env.XAI_EFFORT;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("appel vision (avec la photo)", () => {
  it("UNE requête : modèle, raisonnement réduit, température 0, JSON strict versionné, image en base64, aucun historique", async () => {
    const calls = stubApi({ vision: [{ json: reply(VISION) }] });
    const r = await xaiVision.analyse(JPEG);
    expect(calls).toHaveLength(1);
    const { url, init, body } = calls[0];
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer cle-de-test");
    expect(body).toMatchObject({ model: "grok-4.7", reasoning_effort: "low", temperature: 0 });
    const rf = body.response_format as { type: string; json_schema: { strict: boolean; name: string; schema: { properties: { schemaVersion: { enum: string[] } } } } };
    expect(rf).toMatchObject({ type: "json_schema", json_schema: { strict: true, name: "analyse_photo" } });
    expect(rf.json_schema.schema.properties.schemaVersion.enum).toEqual([PHOTO_REPORT_V2]);
    const user = (body.messages as { content: unknown }[])[1].content as { type: string; image_url?: { url: string; detail: string }; text?: string }[];
    expect(user.find((c) => c.type === "image_url")!.image_url).toEqual({ url: `data:image/jpeg;base64,${B64}`, detail: "high" });
    expect(user.find((c) => c.type === "text")!.text).toMatch(/^ANALYSE MORPHOMÉTRIQUE/);
    expect(JSON.stringify(body)).not.toContain("store");
    expect(r).toEqual({ refused: false, json: VISION, usage: { tokensIn: 2500, tokensOut: 400, ms: expect.any(Number), calls: 1 } });
    expect(validateVisionV2(r.json)?.recevable).toBe(true); // réponse brute : validée par le flux d'analyse
  });

  it("réglages modifiables : modèle, raisonnement, ou raisonnement par défaut du modèle", async () => {
    process.env.XAI_MODEL = "grok-test";
    process.env.XAI_EFFORT = "minimal";
    let calls = stubApi({ vision: [{ json: reply(VISION) }] });
    await xaiVision.analyse(JPEG);
    expect(calls[0].body).toMatchObject({ model: "grok-test", reasoning_effort: "minimal" });
    process.env.XAI_EFFORT = "";
    calls = stubApi({ vision: [{ json: reply(VISION) }] });
    await xaiVision.analyse(JPEG);
    expect("reasoning_effort" in calls[0].body).toBe(false);
  });

  it("un refus du prestataire (refusal ou filtre de contenu) est signalé sans détail", async () => {
    stubApi({ vision: [{ json: { choices: [{ message: { content: "", refusal: "politique" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 1 } } }] });
    expect(await xaiVision.analyse(JPEG)).toMatchObject({ refused: true, json: null });
    stubApi({ vision: [{ json: reply("", { finish_reason: "content_filter" }) }] });
    expect(await xaiVision.analyse(JPEG)).toMatchObject({ refused: true, json: null });
  });

  it("si le format JSON strict est rejeté, une requête moins stricte est envoyée (deux appels comptés)", async () => {
    const calls = stubApi({ vision: [{ status: 400, json: { error: { message: "response_format json_schema is not supported with images" } } }, { json: reply(VISION) }] });
    const r = await xaiVision.analyse(JPEG);
    expect(calls).toHaveLength(2);
    expect((calls[1].body.response_format as { type: string }).type).toBe("json_object");
    expect(r.json).toEqual(VISION);
    expect(r.usage.calls).toBe(2);
  });

  it("erreurs : clé refusée, accès refusé, HTTP 500, réponse illisible, panne réseau, clé absente", async () => {
    stubApi({ vision: [{ status: 401, json: { error: { message: "Incorrect API key provided" } } }] });
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "auth" });
    stubApi({ vision: [{ status: 403, json: { error: "interdit" } }] });
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "policy" });
    stubApi({ vision: [{ status: 500, json: { error: { message: "panne" } } }] });
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "invalid" });
    stubApi({ vision: [{ json: reply("ceci n'est pas du JSON") }] });
    expect((await xaiVision.analyse(JPEG)).json).toBeNull(); // rejeté puis relancé une fois par le flux
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("réseau coupé"))));
    await expect(xaiVision.analyse(JPEG)).rejects.toMatchObject({ kind: "network" });
    delete process.env.XAI_API_KEY;
    await expect(xaiVision.analyse(JPEG)).rejects.toBeInstanceOf(VisionError);
  });

  it("n'écrit jamais l'image ni la clé dans les journaux ni dans les messages d'erreur", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    stubApi({ vision: [{ json: reply(VISION) }] });
    await xaiVision.analyse(JPEG);
    stubApi({ vision: [{ status: 401, json: { error: { message: "Incorrect API key provided" } } }] });
    const e = (await xaiVision.analyse(JPEG).catch((x) => x)) as Error;
    const logged = spies.flatMap((s) => s.mock.calls.map((c) => c.join(" "))).join("\n");
    for (const secret of [B64, "data:image", "cle-de-test"]) {
      expect(logged).not.toContain(secret);
      expect(e.message).not.toContain(secret);
    }
  });
});

describe("appel texte (sans la photo)", () => {
  it("texte seul en JSON strict : schéma « rapport » avec les indicateurs admis, valeurs et observations transmises, jamais la photo", async () => {
    const calls = stubApi({ texte: [{ json: reply(TEXT) }] });
    const r = await xaiVision.writeReport(textInput);
    expect(r).toMatchObject({ refused: false, json: TEXT, usage: { calls: 1 } });
    expect(calls).toHaveLength(1);
    const body = JSON.stringify(calls[0].body);
    expect(body).not.toContain("image_url");
    expect(body).not.toContain("base64");
    expect(body).toContain("14,2 cm");
    expect(body).toContain(SIMULATED_OBSERVATIONS.gland_couronne.replace(/"/g, '\\"'));
    expect(calls[0].body.temperature).toBe(0.4);
    // Rédaction : modèle sans raisonnement par défaut (mesuré : 9 s au lieu de 199 s), donc sans réglage de raisonnement.
    expect(calls[0].body.model).toBe("grok-4.20-0309-non-reasoning");
    expect("reasoning_effort" in calls[0].body).toBe(false);
    const rf = calls[0].body.response_format as { json_schema: { name: string; strict: boolean; schema: { properties: { points_remarquables: { items: { properties: { indicateur: { enum: string[] } } } } } } } };
    expect(rf.json_schema).toMatchObject({ name: "rapport", strict: true });
    expect(rf.json_schema.schema.properties.points_remarquables.items.properties.indicateur.enum).toEqual(textInput.allowedHighlights);
  });

  it("modèle de rédaction réglable (XAI_TEXT_MODEL) ; un modèle qui raisonne reçoit le réglage de raisonnement", async () => {
    process.env.XAI_TEXT_MODEL = "grok-4.7";
    try {
      const calls = stubApi({ texte: [{ json: reply(TEXT) }] });
      await xaiVision.writeReport(textInput);
      expect(calls[0].body).toMatchObject({ model: "grok-4.7", reasoning_effort: "low" });
    } finally {
      delete process.env.XAI_TEXT_MODEL;
    }
  });

  it("les jetons de raisonnement, facturés, sont comptés avec les jetons de sortie", async () => {
    stubApi({ texte: [{ json: { ...reply(TEXT), usage: { prompt_tokens: 3096, completion_tokens: 1487, completion_tokens_details: { reasoning_tokens: 16132 } } } }] });
    expect((await xaiVision.writeReport(textInput)).usage).toMatchObject({ tokensIn: 3096, tokensOut: 17619 });
  });

  it("relance : les règles violées sont transmises au modèle", async () => {
    const calls = stubApi({ texte: [{ json: reply(TEXT) }] });
    await xaiVision.writeReport({ ...textInput, previousViolations: ["interdit : couleur ou teinte (« teinte »)"] });
    expect(JSON.stringify(calls[0].body)).toContain("RÉÉCRIS LE RAPPORT");
  });

  it("rédaction refusée par le prestataire ou illisible : signalée (le flux relance une fois, puis rapport partiel)", async () => {
    stubApi({ texte: [{ json: { choices: [{ message: { content: "", refusal: "politique" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 1 } } }] });
    expect(await xaiVision.writeReport(textInput)).toMatchObject({ refused: true, json: null });
    stubApi({ texte: [{ json: reply("du texte libre, pas du JSON") }] });
    expect(await xaiVision.writeReport(textInput)).toMatchObject({ refused: false, json: null });
  });
});
