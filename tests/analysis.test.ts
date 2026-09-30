import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { acceptComment, NEUTRAL_REFUSAL, runAnalysis, type FlowDeps, type FlowEvent, type FlowInput } from "@/lib/analyseFlow";
import { prepareImage } from "@/lib/image";
import { isAgeTokenValid, issueAgeToken } from "@/lib/age/token";
import { simulatedCaptcha, SIMULATED_CAPTCHA_TOKEN } from "@/lib/providers/simulated";
import type { ImageScreeningProvider } from "@/lib/providers/types";
import { getReport } from "@/lib/repo";
import { getReportView } from "@/lib/view";
import { createSimulatedVision, type Scenario } from "@/lib/vision/simulation";
import { VisionError, type VisionProvider } from "@/lib/vision/types";

// Image neutre : aplat gris 1200×800. Aucune personne, aucun corps. Le fournisseur simulé fournit les points.
async function neutralPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: "#8a8a8a" } }).jpeg().toBuffer();
}

const passScreening: ImageScreeningProvider = { id: "test", screen: async () => ({ blocked: false }) };

function deps(over: Partial<FlowDeps> & { scenario?: Scenario } = {}): FlowDeps {
  return {
    vision: over.vision ?? createSimulatedVision(over.scenario ?? "ok"),
    screening: over.screening ?? passScreening,
    captcha: over.captcha ?? simulatedCaptcha,
  };
}

async function input(over: Partial<FlowInput> = {}): Promise<FlowInput> {
  return {
    formula: "B",
    state: "erect",
    consents: { adult: true, mine: true, sensitive: true },
    ageTokenValid: true,
    captchaToken: SIMULATED_CAPTCHA_TOKEN,
    ip: "203.0.113.9",
    photo: await neutralPhoto(),
    ...over,
  };
}

async function run(i: FlowInput, d: FlowDeps): Promise<FlowEvent[]> {
  const events: FlowEvent[] = [];
  for await (const e of runAnalysis(i, d)) events.push(e);
  return events;
}

function spyVision(inner: VisionProvider) {
  const calls = { analyse: 0 };
  const vision: VisionProvider = {
    id: "spy",
    analyse: async (j) => {
      calls.analyse++;
      return inner.analyse(j);
    },
    writeComment: (x) => inner.writeComment(x),
  };
  return { vision, calls };
}

// Mots isolés (lettres Unicode) : « âge » ou « age », pas « image ».
const AGE_WORDS = /(?<!\p{L})âges?(?!\p{L})|(?<!\p{L})ages?(?!\p{L})|majeur|mineur|majorit/iu;

const lastOf = (ev: FlowEvent[]) => ev[ev.length - 1];
const count = async (table: string) => (await pool().query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts CASCADE");
});
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts CASCADE");
  await pool().end();
});

describe("analyse d'une photo : chemin nominal", () => {
  it("affiche uniquement les étapes réellement exécutées, puis crée un rapport non payé", async () => {
    const ev = await run(await input(), deps());
    expect(ev.filter((e) => e.type === "step").map((e) => (e as { id: string }).id)).toEqual(["recevabilite", "calibration", "percentiles"]);
    const ready = lastOf(ev);
    expect(ready.type).toBe("ready");
    const id = (ready as { reportId: string }).reportId;
    const row = await getReport(id);
    expect(row?.paid).toBe(false);
    expect(row?.formula).toBe("B");
    expect(id.length).toBeGreaterThanOrEqual(32);
  });

  it("retrouve la scène simulée (13 cm de long, 4 cm de large) avec marge, symétrie et confiance", async () => {
    const ev = await run(await input(), deps());
    const row = await getReport((lastOf(ev) as { reportId: string }).reportId);
    const r = row!.results;
    expect(r.length.value).toBeGreaterThan(12.6);
    expect(r.length.value).toBeLessThan(13.4);
    expect(r.girth.value).toBeGreaterThan(12.2); // π × 4 cm = 12,57
    expect(r.girth.value).toBeLessThan(12.9);
    expect(r.length.marginPct).toBeGreaterThanOrEqual(10);
    expect(r.girth.marginPct).toBeGreaterThanOrEqual(10);
    expect(r.symmetry).toBeGreaterThan(95);
    expect(r.confidence).toBe(90);
    expect(r.score).toBeGreaterThanOrEqual(40);
    expect(r.score).toBeLessThanOrEqual(98);
  });

  it("avant paiement, seuls l'indice de confiance et la symétrie sont visibles", async () => {
    const ev = await run(await input(), deps());
    const view = await getReportView((lastOf(ev) as { reportId: string }).reportId);
    expect(view.status).toBe("locked");
    const json = JSON.stringify(view);
    expect(json).toContain("confidence");
    expect(json).toContain("symmetry");
    for (const hidden of ["score", "percentile", "length", "girth", "comment", "curvature", "marginPct"]) {
      expect(json).not.toContain(hidden);
    }
  });

  it("le commentaire rédigé remplace le commentaire de repli", async () => {
    const ev = await run(await input(), deps());
    const row = await getReport((lastOf(ev) as { reportId: string }).reportId);
    expect(row!.results.comment).toContain("Commentaire simulé");
  });

  it("aucune trace de la photo en base (rapports et tentatives)", async () => {
    const photo = await neutralPhoto();
    await run(await input({ photo }), deps());
    const all = JSON.stringify((await pool().query("SELECT * FROM reports")).rows) + JSON.stringify((await pool().query("SELECT * FROM analysis_attempts")).rows);
    expect(all).not.toContain(photo.toString("base64").slice(0, 40));
    expect(all).not.toContain("/9j/"); // début d'un JPEG en base64
  });

  it("journalise la tentative avec durée et jetons, sans adresse IP en clair", async () => {
    await run(await input(), deps());
    const { rows } = await pool().query("SELECT * FROM analysis_attempts");
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("ok");
    expect(rows[0].vision_ms).toBe(5);
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.9");
  });
});

describe("formule C : comparaison déclaré / estimé", () => {
  it("exige des mesures déclarées plausibles", async () => {
    let ev = await run(await input({ formula: "C" }), deps());
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "declared" });
    ev = await run(await input({ formula: "C", declared: { length: 40, girth: 12 } }), deps());
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "declared" });
    expect(await count("reports")).toBe(0);
  });

  it("signale un écart supérieur à 20 %, pas en dessous", async () => {
    let ev = await run(await input({ formula: "C", declared: { length: 13, girth: 12.5 } }), deps());
    let d = (await getReport((lastOf(ev) as { reportId: string }).reportId))!.results.declared!;
    expect(d.flagged).toBe(false);
    expect(Math.abs(d.lengthGapPct)).toBeLessThan(5);

    ev = await run(await input({ formula: "C", declared: { length: 10, girth: 12.5 } }), deps());
    d = (await getReport((lastOf(ev) as { reportId: string }).reportId))!.results.declared!;
    expect(d.flagged).toBe(true);
    expect(d.lengthGapPct).toBeGreaterThan(20);
  });
});

describe("contrôles avant toute analyse", () => {
  it("sans jeton d'âge valide : refus, l'analyse n'est pas appelée, aucune tentative enregistrée", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    const ev = await run(await input({ ageTokenValid: false }), deps({ vision }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "age" });
    expect(calls.analyse).toBe(0);
    expect(await count("analysis_attempts")).toBe(0);
  });

  it("les trois cases sont obligatoires", async () => {
    for (const k of ["adult", "mine", "sensitive"] as const) {
      const ev = await run(await input({ consents: { adult: true, mine: true, sensitive: true, [k]: false } }), deps());
      expect(lastOf(ev)).toMatchObject({ type: "error", code: "consent" });
    }
    expect(await count("analysis_attempts")).toBe(0);
  });

  it("captcha invalide : refus", async () => {
    const ev = await run(await input({ captchaToken: "faux" }), deps());
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "captcha" });
  });

  it("limite de 5 analyses par période : la sixième est refusée, refus et erreurs comptés aussi", async () => {
    for (let k = 0; k < 5; k++) await run(await input(), deps({ scenario: k % 2 ? "ok" : "no_card" }));
    const ev = await run(await input(), deps());
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "rate" });
  });

  it("image invalide ou trop lourde : erreur, aucune analyse", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    let ev = await run(await input({ photo: Buffer.from("ceci n'est pas une image") }), deps({ vision }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "image" });
    ev = await run(await input({ photo: null }), deps({ vision }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "image" });
    expect(calls.analyse).toBe(0);
  });
});

describe("refus : message neutre, aucun paiement, motif journalisé", () => {
  const refusals: [Scenario, string][] = [
    ["refuse_face", "visage_visible"],
    ["doute_majorite", "doute_majorite"],
    ["no_card", "carte_absente_ou_illisible"],
    ["garbage", "reperage_incomplet"],
    ["low_confidence", "confiance_faible"],
    ["implausible", "mesure_invraisemblable"],
  ];
  for (const [scenario, motif] of refusals) {
    it(`${scenario} → refus neutre, motif « ${motif} », aucun rapport`, async () => {
      const ev = await run(await input(), deps({ scenario }));
      expect(lastOf(ev)).toEqual({ type: "refused", message: NEUTRAL_REFUSAL });
      const { rows } = await pool().query("SELECT outcome, motif FROM analysis_attempts");
      expect(rows[0]).toEqual({ outcome: "refused", motif });
      expect(await count("reports")).toBe(0);
    });
  }

  it("le message ne mentionne jamais l'âge ni la majorité, y compris en cas de doute", () => {
    expect(NEUTRAL_REFUSAL).not.toMatch(AGE_WORDS);
    // garde-fou du test lui-même : le motif détecte bien ces mots isolés
    expect("Vous devez être majeur").toMatch(AGE_WORDS);
    expect("l'âge est douteux").toMatch(AGE_WORDS);
  });

  it("image reconnue par le filtrage d'empreintes : détruite sans analyse", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    const blocking: ImageScreeningProvider = { id: "test", screen: async () => ({ blocked: true }) };
    const ev = await run(await input(), deps({ vision, screening: blocking }));
    expect(lastOf(ev)).toEqual({ type: "refused", message: NEUTRAL_REFUSAL });
    expect(calls.analyse).toBe(0);
    const { rows } = await pool().query("SELECT outcome, motif FROM analysis_attempts");
    expect(rows[0]).toEqual({ outcome: "blocked", motif: "empreinte_connue" });
    expect(await count("reports")).toBe(0);
  });

  it("panne du prestataire d'analyse : erreur claire, aucun rapport, aucun paiement demandé", async () => {
    const failing: VisionProvider = {
      id: "panne",
      analyse: async () => {
        throw new VisionError("timeout", "délai dépassé");
      },
      writeComment: async () => ({ text: null, usage: { tokensIn: 0, tokensOut: 0, ms: 0 } }),
    };
    const ev = await run(await input(), deps({ vision: failing }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "provider" });
    expect(await count("reports")).toBe(0);
  });

  it("commentaire indisponible : le commentaire de repli reste en place", async () => {
    const noComment: VisionProvider = { ...createSimulatedVision("ok"), writeComment: async () => ({ text: null, usage: { tokensIn: 0, tokensOut: 0, ms: 0 } }) };
    const ev = await run(await input(), deps({ vision: noComment }));
    const row = await getReport((lastOf(ev) as { reportId: string }).reportId);
    expect(row!.results.comment).toContain("estimations");
  });
});

describe("commentaire du modèle", () => {
  it("refuse un texte trop court ou trop long", () => {
    expect(acceptComment(null, 0)).toBeNull();
    expect(acceptComment("trop court", 0)).toBeNull();
    expect(acceptComment(Array(300).fill("mot").join(" "), 0)).toBeNull();
  });
  it("ajoute la phrase d'avis médical si la courbure atteint 30° et qu'elle manque", () => {
    const text = Array(130).fill("mot").join(" ");
    expect(acceptComment(text, 10)).not.toContain("avis médical");
    expect(acceptComment(text, 35)).toContain("avis médical");
    expect(acceptComment(text + " avis médical", 35)!.match(/avis médical/g)).toHaveLength(1);
  });
});

describe("jeton d'âge et réencodage d'image", () => {
  it("jeton valide 30 minutes, invalide ensuite ou si modifié", () => {
    const t0 = 1_700_000_000_000;
    const token = issueAgeToken(t0);
    expect(isAgeTokenValid(token, t0 + 29 * 60_000)).toBe(true);
    expect(isAgeTokenValid(token, t0 + 31 * 60_000)).toBe(false);
    const [exp, nonce, sig] = token.split(".");
    expect(isAgeTokenValid(`${Number(exp) + 600000}.${nonce}.${sig}`, t0)).toBe(false);
    expect(isAgeTokenValid("n'importe quoi", t0)).toBe(false);
    expect(isAgeTokenValid(null, t0)).toBe(false);
  });

  it("le jeton ne contient aucune donnée d'identité (expiration, nonce, signature)", () => {
    expect(issueAgeToken().split(".")).toHaveLength(3);
  });

  it("supprime les métadonnées (EXIF, GPS) et borne la taille à 1 600 px", async () => {
    const big = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: "#777" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret-gps-test" } })
      .toBuffer();
    expect((await sharp(big).metadata()).exif).toBeDefined();
    const { jpeg, width, height } = await prepareImage(big);
    expect(Math.max(width, height)).toBe(1600);
    expect((await sharp(jpeg).metadata()).exif).toBeUndefined();
    expect(jpeg.includes(Buffer.from("secret-gps-test"))).toBe(false);
  });

  it("refuse un format non autorisé", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
    await expect(prepareImage(gif)).rejects.toThrow();
  });
});
