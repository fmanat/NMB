import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAnalysis, type FlowDeps, type FlowEvent, type FlowInput } from "@/lib/analyseFlow";
import { pool } from "@/lib/db";
import { disabledCaptcha, disabledScreening, simulatedCaptcha, SIMULATED_CAPTCHA_TOKEN, simulatedScreening } from "@/lib/providers/simulated";
import { createSimulatedVision, type Scenario } from "@/lib/vision/simulation";

async function photo(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: "#8a8a8a" } }).jpeg().toBuffer();
}

const deps = (scenario: Scenario = "ok"): FlowDeps => ({ vision: createSimulatedVision(scenario), screening: simulatedScreening, captcha: simulatedCaptcha });

async function input(over: Partial<FlowInput> = {}): Promise<FlowInput> {
  return {
    formula: "B",
    state: "erect",
    consents: { adult: true, mine: true, sensitive: true },
    ageTokenValid: true,
    captchaToken: SIMULATED_CAPTCHA_TOKEN,
    ip: "203.0.113.50",
    photo: await photo(),
    ...over,
  };
}

async function drain(i: FlowInput, d: FlowDeps): Promise<FlowEvent[]> {
  const out: FlowEvent[] = [];
  for await (const e of runAnalysis(i, d)) out.push(e);
  return out;
}

const clean = () => pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
beforeEach(clean);
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await clean();
  await pool().end();
});

describe("suppression de la photo", () => {
  it("la photo est abandonnée après une analyse réussie", async () => {
    const i = await input();
    expect(i.photo).not.toBeNull();
    const ev = await drain(i, deps());
    expect(ev[ev.length - 1].type).toBe("ready");
    expect(i.photo).toBeNull();
  });

  it("… après un refus, une erreur de fournisseur et un échec de contrôle préalable", async () => {
    for (const scenario of ["refuse_face", "no_card", "garbage"] as Scenario[]) {
      const i = await input();
      await drain(i, deps(scenario));
      expect(i.photo, scenario).toBeNull();
    }
    const failing = { ...deps(), vision: { ...createSimulatedVision(), analyse: async () => Promise.reject(new Error("panne")) } } as FlowDeps;
    const e = await input();
    await drain(e, failing);
    expect(e.photo).toBeNull();
    const noAge = await input({ ageTokenValid: false });
    await drain(noAge, deps());
    expect(noAge.photo).toBeNull();
  });

  it("… et même si le consommateur des événements s'interrompt en cours de route", async () => {
    const i = await input();
    const gen = runAnalysis(i, deps());
    await gen.next(); // première étape
    await gen.return(undefined); // interruption (client parti)
    expect(i.photo).toBeNull();
  });
});

describe("la photo n'est écrite nulle part", () => {
  it("aucun fichier créé dans le dossier temporaire (isolé pour le test) ni à la racine du projet pendant une analyse", async () => {
    // Dossier temporaire dédié : toute écriture de fichier temporaire par le traitement y apparaîtrait.
    const env = process.env as Record<string, string | undefined>;
    const saved = { TEMP: env.TEMP, TMP: env.TMP, TMPDIR: env.TMPDIR };
    const isolated = mkdtempSync(join(tmpdir(), "nmb-photo-"));
    env.TEMP = env.TMP = env.TMPDIR = isolated;
    const names = (d: string) => new Set(readdirSync(d));
    const rootBefore = names(process.cwd());
    const photosDir = join(process.cwd(), "photos-test");
    const photosBefore = existsSync(photosDir) ? names(photosDir) : new Set<string>();
    try {
      expect(tmpdir()).toBe(isolated);
      await drain(await input(), deps());
      await drain(await input(), deps("refuse_face"));
      await drain(await input(), deps("garbage"));
      expect(readdirSync(isolated)).toEqual([]);
    } finally {
      Object.assign(env, saved);
      for (const k of Object.keys(saved) as (keyof typeof saved)[]) if (saved[k] === undefined) delete env[k];
      rmSync(isolated, { recursive: true, force: true });
    }
    const added = [...names(process.cwd())].filter((n) => !rootBefore.has(n));
    expect(added).toEqual([]);
    const addedPhotos = existsSync(photosDir) ? [...names(photosDir)].filter((n) => !photosBefore.has(n)) : [];
    expect(addedPhotos).toEqual([]);
  });

  it("rien dans les journaux : uniquement des lignes {event, motif}, jamais l'image", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const p = await photo();
    await drain(await input({ photo: p }), deps());
    await drain(await input({ photo: p }), deps("refuse_face"));
    await drain(await input({ photo: p }), deps("doute_majorite"));
    const lines = spies.flatMap((s) => s.mock.calls.map((c) => c.join(" ")));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l).toMatch(/^\{"event":"analysis_(refused|blocked|error)","motif":"[a-z_]+"/);
      expect(l).not.toContain(p.toString("base64").slice(0, 30));
      expect(l).not.toContain("203.0.113.50");
    }
  });

  it("aucune trace en base : pas de colonne binaire, pas de contenu d'image dans les tables", async () => {
    const p = await photo();
    await drain(await input({ photo: p }), deps());
    const cols = (
      await pool().query(
        "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('bytea', 'oid')",
      )
    ).rows;
    expect(cols).toEqual([]);
    const dump = JSON.stringify((await pool().query("SELECT * FROM reports")).rows) + JSON.stringify((await pool().query("SELECT * FROM analysis_attempts")).rows) + JSON.stringify((await pool().query("SELECT * FROM report_log")).rows);
    expect(dump).not.toContain("/9j/"); // début d'un JPEG en base64
    expect(dump).not.toContain(p.toString("base64").slice(0, 40));
  });
});

describe("contrôles désactivables, jamais en production", () => {
  it("captcha et filtrage « off » acceptent tout en développement", async () => {
    expect(await disabledCaptcha.verify(null, "1.2.3.4")).toBe(true);
    expect(await disabledScreening.screen(Buffer.from("x"))).toEqual({ blocked: false });
  });

  it("… mais refusent de fonctionner en production, comme les fournisseurs simulés", async () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      await expect(disabledCaptcha.verify(null, "1.2.3.4")).rejects.toThrow(/interdit en production/);
      await expect(disabledScreening.screen(Buffer.from("x"))).rejects.toThrow(/interdit en production/);
      await expect(simulatedCaptcha.verify(SIMULATED_CAPTCHA_TOKEN, "1.2.3.4")).rejects.toThrow(/interdit en production/);
      await expect(simulatedScreening.screen(Buffer.from("x"))).rejects.toThrow(/interdit en production/);
      await expect(createSimulatedVision().analyse(await photo())).rejects.toThrow(/interdit en production/);
    } finally {
      env.NODE_ENV = previous;
    }
  });

  it("captcha simulé : refuse un mauvais jeton", async () => {
    expect(await simulatedCaptcha.verify("faux", "1.2.3.4")).toBe(false);
    expect(await simulatedCaptcha.verify(null, "1.2.3.4")).toBe(false);
  });
});
