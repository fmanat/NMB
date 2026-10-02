import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/lib/db";
import { CAP_MESSAGE, NEUTRAL_REFUSAL, STANDARD_VERSIONS, UNREADABLE_MESSAGE, runAnalysis, type FlowDeps, type FlowEvent, type FlowInput } from "@/lib/analyseFlow";
import { prepareImage } from "@/lib/image";
import { isAgeTokenValid, issueAgeToken } from "@/lib/age/token";
import { profileFor } from "@/lib/profiles";
import { simulatedCaptcha, SIMULATED_CAPTCHA_TOKEN } from "@/lib/providers/simulated";
import type { ImageScreeningProvider } from "@/lib/providers/types";
import { getReport } from "@/lib/repo";
import { getReportView } from "@/lib/view";
import { createSimulatedVision, SIMULATED_OBSERVATIONS, SIMULATED_VERDICT, type Scenario } from "@/lib/vision/simulation";
import { VisionError, type VisionProvider } from "@/lib/vision/types";
import type { SpendGate } from "@/lib/xaiSpend";
import { flatImage } from "./fixtures/neutralImage";

// Image neutre : aplat gris 1200×800. Aucune personne, aucun corps. Le fournisseur simulé fournit les points.
const neutralPhoto = () => flatImage();

const passScreening: ImageScreeningProvider = { id: "test", screen: async () => ({ blocked: false }) };
const NO_USAGE = { tokensIn: 0, tokensOut: 0, ms: 0, calls: 1 };

/** Porte de dépense de test : toujours ouverte, mémorise les règlements. */
function spendGate(open = true) {
  const settled: { costMicros: number; calls: number }[] = [];
  const gate: SpendGate = {
    reserve: async () => (open ? { ok: true, day: "2026-01-01", estimateMicros: 30_000 } : { ok: false, day: "2026-01-01" }),
    settle: async (_r, actual) => {
      settled.push(actual);
    },
  };
  return { gate, settled };
}

function deps(over: Partial<FlowDeps> & { scenario?: Scenario } = {}): FlowDeps {
  return {
    vision: over.vision ?? createSimulatedVision(over.scenario ?? "ok"),
    screening: over.screening ?? passScreening,
    captcha: over.captcha ?? simulatedCaptcha,
    spend: over.spend ?? spendGate().gate,
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
  const calls = { analyse: 0, comment: 0 };
  const vision: VisionProvider = {
    id: "spy",
    analyse: async (j) => {
      calls.analyse++;
      return inner.analyse(j);
    },
    writeComment: (x) => {
      calls.comment++;
      return inner.writeComment(x);
    },
  };
  return { vision, calls };
}

// Mots isolés (lettres Unicode) : « âge » ou « age », pas « image ».
const AGE_WORDS = /(?<!\p{L})âges?(?!\p{L})|(?<!\p{L})ages?(?!\p{L})|majeur|mineur|majorit/iu;

const lastOf = (ev: FlowEvent[]) => ev[ev.length - 1];
const stepsOf = (ev: FlowEvent[]) => ev.filter((e) => e.type === "step").map((e) => (e as { id: string }).id);
const count = async (table: string) => (await pool().query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n as number;
const readyId = (ev: FlowEvent[]) => (lastOf(ev) as { reportId: string }).reportId;

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, xai_daily_spend CASCADE");
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, xai_daily_spend CASCADE");
  await pool().end();
});

describe("analyse d'une photo : chemin nominal", () => {
  it("affiche uniquement les étapes réellement exécutées (rédaction comprise), puis crée un rapport non payé", async () => {
    const ev = await run(await input(), deps());
    expect(stepsOf(ev)).toEqual(["recevabilite", "calibration", "percentiles", "redaction"]);
    const ready = lastOf(ev);
    expect(ready.type).toBe("ready");
    const id = (ready as { reportId: string }).reportId;
    const row = await getReport(id);
    expect(row?.paid).toBe(false);
    expect(row?.free_beta).toBe(false);
    expect(row?.formula).toBe("B");
    expect(id.length).toBeGreaterThanOrEqual(32);
  });

  it("retrouve la scène simulée (13 cm de long, 4 cm de large) avec marge, symétrie et confiance", async () => {
    const ev = await run(await input(), deps());
    const row = await getReport(readyId(ev));
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
    const view = await getReportView(readyId(ev));
    expect(view.status).toBe("locked");
    const json = JSON.stringify(view);
    expect(json).toContain("confidence");
    expect(json).toContain("symmetry");
    for (const hidden of ["score", "percentile", "length", "girth", "comment", "curvature", "marginPct", "observations", "verdict"]) {
      expect(json).not.toContain(hidden);
    }
  });

  it("le rapport contient le commentaire STANDARDISÉ (trois observations, un verdict, versions) et sa version texte", async () => {
    const ev = await run(await input(), deps());
    const row = await getReport(readyId(ev));
    const s = row!.results.standard!;
    expect(s).toEqual({ ...STANDARD_VERSIONS, observations: [...SIMULATED_OBSERVATIONS], verdict: SIMULATED_VERDICT });
    expect(row!.results.comment).toBe([...SIMULATED_OBSERVATIONS, SIMULATED_VERDICT].join(" "));
    expect(row!.results.comment).not.toMatch(/\d/);
  });

  it("le profil morphologique d'un rapport photo se calcule sur ses percentiles estimés (comme pour le questionnaire)", async () => {
    const ev = await run(await input(), deps());
    const r = (await getReport(readyId(ev)))!.results;
    const p = profileFor(r.length.percentile, r.girth.percentile);
    expect(p.id).toMatch(/^l[123]c[123]$/);
    // 13 cm × 12,6 cm en érection : longueur juste sous la médiane (classe moyenne), circonférence haute.
    expect(p.lengthClass).toBe("mid");
    expect(p.girthClass).toBe("high");
  });

  it("bêta photo : le rapport est créé débloqué et marqué bêta gratuite, sans paiement", async () => {
    const ev = await run(await input({ freeBeta: true }), deps());
    const row = await getReport(readyId(ev));
    expect(row).toMatchObject({ paid: true, free_beta: true, paid_at: null });
    expect((await getReportView(readyId(ev))).status).toBe("unlocked");
    expect(await count("payments")).toBe(0);
  });

  it("aucune trace de la photo en base (rapports et tentatives)", async () => {
    const photo = await neutralPhoto();
    await run(await input({ photo }), deps());
    const all = JSON.stringify((await pool().query("SELECT * FROM reports")).rows) + JSON.stringify((await pool().query("SELECT * FROM analysis_attempts")).rows);
    expect(all).not.toContain(photo.toString("base64").slice(0, 40));
    expect(all).not.toContain("/9j/"); // début d'un JPEG en base64
  });

  it("journalise la tentative avec durée et jetons, sans adresse IP en clair, et règle la dépense (3 appels simulés)", async () => {
    const { gate, settled } = spendGate();
    await run(await input(), deps({ spend: gate }));
    const { rows } = await pool().query("SELECT * FROM analysis_attempts");
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("ok");
    expect(rows[0].vision_ms).toBeGreaterThanOrEqual(0);
    expect(rows[0].tokens_in).toBe(0);
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.9");
    expect(settled).toEqual([{ costMicros: 0, calls: 3 }]); // recevabilité + repérage (2) et rédaction (1)
  });

  it("les lignes de journal portent la version du schéma et des prompts", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await run(await input(), deps());
    await run(await input(), deps({ scenario: "no_card" }));
    const lines = info.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, string>);
    expect(lines.map((l) => l.event)).toEqual(["analysis_ok", "analysis_refused"]);
    for (const l of lines) expect(l).toMatchObject(STANDARD_VERSIONS);
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
    let d = (await getReport(readyId(ev)))!.results.declared!;
    expect(d.flagged).toBe(false);
    expect(Math.abs(d.lengthGapPct)).toBeLessThan(5);

    ev = await run(await input({ formula: "C", declared: { length: 10, girth: 12.5 } }), deps());
    d = (await getReport(readyId(ev)))!.results.declared!;
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

  it("plafond de dépense du jour atteint : message « Capacité du jour atteinte », zéro appel au modèle, tentative non comptée", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    const { gate, settled } = spendGate(false);
    const i = await input();
    const ev = await run(i, deps({ vision, spend: gate }));
    expect(lastOf(ev)).toEqual({ type: "error", code: "cap", message: CAP_MESSAGE });
    expect(CAP_MESSAGE).toBe("Capacité du jour atteinte, revenez demain.");
    expect(stepsOf(ev)).toEqual([]);
    expect(calls.analyse).toBe(0);
    expect(calls.comment).toBe(0);
    expect(await count("analysis_attempts")).toBe(0); // ne compte pas dans la limite de 5 par adresse
    expect(await count("reports")).toBe(0);
    expect(settled).toEqual([]);
    expect(i.photo).toBeNull();
  });

  it("image invalide ou trop lourde : erreur, aucune analyse, réservation rendue sans appel", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    const { gate, settled } = spendGate();
    let ev = await run(await input({ photo: Buffer.from("ceci n'est pas une image") }), deps({ vision, spend: gate }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "image" });
    ev = await run(await input({ photo: null }), deps({ vision, spend: gate }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "image" });
    expect(calls.analyse).toBe(0);
    expect(settled).toEqual([
      { costMicros: 0, calls: 0 },
      { costMicros: 0, calls: 0 },
    ]);
  });
});

describe("refus : message neutre, aucun paiement, motif journalisé", () => {
  const refusals: [Scenario, string][] = [
    ["refuse_face", "visage_visible"],
    ["doute_majorite", "doute_majorite"],
    ["no_card", "carte_absente_ou_illisible"],
    ["low_confidence", "confiance_faible"],
    ["implausible", "mesure_invraisemblable"],
    ["tilt_too_strong", "inclinaison_trop_forte"],
    ["card_too_small", "carte_trop_petite"],
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

  it("les messages ne mentionnent jamais l'âge ni la majorité, y compris en cas de doute, et ne promettent aucun remboursement", () => {
    for (const m of [NEUTRAL_REFUSAL, UNREADABLE_MESSAGE, CAP_MESSAGE]) {
      expect(m).not.toMatch(AGE_WORDS);
      expect(m).not.toMatch(/rembours/i);
    }
    expect(UNREADABLE_MESSAGE).toMatch(/^Nous n'avons pas pu analyser cette photo\. Reprenez-la en suivant les conseils/);
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
      writeComment: async () => ({ json: null, usage: NO_USAGE }),
    };
    const ev = await run(await input(), deps({ vision: failing }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "provider" });
    expect(await count("reports")).toBe(0);
  });

  it("panne du prestataire pendant la rédaction : erreur claire, aucun rapport", async () => {
    const failing: VisionProvider = {
      ...createSimulatedVision("ok"),
      writeComment: async () => {
        throw new VisionError("network", "réseau coupé");
      },
    };
    const ev = await run(await input(), deps({ vision: failing }));
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "provider" });
    expect(await count("reports")).toBe(0);
    expect((await pool().query("SELECT motif FROM analysis_attempts")).rows[0].motif).toBe("fournisseur_network");
  });
});

describe("réponses du modèle non conformes au schéma : une seule relance, puis message neutre", () => {
  it("repérage invalide une fois puis valide : la relance aboutit (deux appels d'analyse, un rapport)", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("garbage_once"));
    const ev = await run(await input(), deps({ vision }));
    expect(lastOf(ev).type).toBe("ready");
    expect(calls.analyse).toBe(2);
    expect(calls.comment).toBe(1);
    expect(await count("reports")).toBe(1);
  });

  it("repérage invalide deux fois : message neutre « reprenez la photo », motif journalisé, aucun rapport, photo abandonnée", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("garbage"));
    const i = await input();
    const ev = await run(i, deps({ vision }));
    expect(lastOf(ev)).toEqual({ type: "refused", message: UNREADABLE_MESSAGE });
    expect(calls.analyse).toBe(2);
    expect(calls.comment).toBe(0);
    expect((await pool().query("SELECT outcome, motif FROM analysis_attempts")).rows[0]).toEqual({ outcome: "refused", motif: "reperage_incomplet" });
    expect(await count("reports")).toBe(0);
    expect(i.photo).toBeNull();
  });

  it("recevabilité non conforme (version absente) deux fois : même traitement, motif distinct", async () => {
    const inner = createSimulatedVision("ok");
    const bad: VisionProvider = { ...inner, analyse: async (j) => ({ ...(await inner.analyse(j)), recevabilite: { recevable: true, motif: "ok" } }) };
    const ev = await run(await input(), deps({ vision: bad }));
    expect(lastOf(ev)).toEqual({ type: "refused", message: UNREADABLE_MESSAGE });
    expect((await pool().query("SELECT motif FROM analysis_attempts")).rows[0].motif).toBe("recevabilite_invalide");
  });

  it("commentaire invalide une fois puis valide : la relance aboutit (deux appels de rédaction)", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("comment_invalid_once"));
    const ev = await run(await input(), deps({ vision }));
    expect(lastOf(ev).type).toBe("ready");
    expect(calls.comment).toBe(2);
    expect((await getReport(readyId(ev)))!.results.standard!.observations).toEqual([...SIMULATED_OBSERVATIONS]);
  });

  for (const [scenario, why] of [
    ["comment_digit", "un chiffre dans une observation"],
    ["comment_two", "deux observations"],
    ["comment_four", "quatre observations"],
    ["comment_refused", "réponse refusée par le prestataire"],
  ] as [Scenario, string][]) {
    it(`${why} (deux fois) : refus neutre, motif « commentaire_invalide », aucun rapport, aucune photo conservée`, async () => {
      const { vision, calls } = spyVision(createSimulatedVision(scenario));
      const { gate, settled } = spendGate();
      const i = await input();
      const ev = await run(i, deps({ vision, spend: gate }));
      expect(lastOf(ev)).toEqual({ type: "refused", message: UNREADABLE_MESSAGE });
      expect(stepsOf(ev)).toEqual(["recevabilite", "calibration", "percentiles", "redaction"]);
      expect(calls.analyse).toBe(1);
      expect(calls.comment).toBe(2);
      expect((await pool().query("SELECT outcome, motif FROM analysis_attempts")).rows[0]).toEqual({ outcome: "refused", motif: "commentaire_invalide" });
      expect(await count("reports")).toBe(0);
      expect(i.photo).toBeNull();
      expect(settled).toEqual([{ costMicros: 0, calls: 4 }]); // 2 (analyse) + 2 (rédaction) appels comptés dans la dépense
    });
  }
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
