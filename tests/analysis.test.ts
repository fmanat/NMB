import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/lib/db";
import { CAP_MESSAGE, NEUTRAL_REFUSAL, STANDARD_VERSIONS, runAnalysis, type FlowDeps, type FlowEvent, type FlowInput } from "@/lib/analyseFlow";
import { prepareImage } from "@/lib/image";
import { isAgeTokenValid, issueAgeToken } from "@/lib/age/token";
import { PARTIAL_LABEL } from "@/lib/photoReport2";
import { simulatedCaptcha, SIMULATED_CAPTCHA_TOKEN } from "@/lib/providers/simulated";
import type { ImageScreeningProvider } from "@/lib/providers/types";
import { getReport, listCalibrationPairs } from "@/lib/repo";
import { getReportView } from "@/lib/view";
import { checkReportText } from "@/lib/vision/reportText";
import { createSimulatedVision, OBSERVATION_MARKER, SIMULATED_ESTIMATES, type Scenario } from "@/lib/vision/simulation";
import { VisionError, type VisionProvider } from "@/lib/vision/types";
import type { SpendGate } from "@/lib/xaiSpend";
import { flatImage } from "./fixtures/neutralImage";

// Moteur photo-report/2 : appel vision (recevabilité, estimations, observations, points) puis appel texte (rapport rédigé),
// calculs par le code entre les deux. API simulée (aucun réseau) ; image neutre : aplat gris 1200×800, aucune personne, aucun corps.

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
  const calls = { analyse: 0, text: 0, violations: [] as (string[] | undefined)[] };
  const vision: VisionProvider = {
    id: "spy",
    analyse: async (j) => {
      calls.analyse++;
      return inner.analyse(j);
    },
    writeReport: (x) => {
      calls.text++;
      calls.violations.push(x.previousViolations);
      return inner.writeReport(x);
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
const attempt = async () => (await pool().query("SELECT outcome, motif FROM analysis_attempts ORDER BY id DESC LIMIT 1")).rows[0];
const TABLES = "TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, xai_daily_spend, calibration_pairs CASCADE";

beforeEach(async () => {
  await pool().query(TABLES);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await pool().query(TABLES);
  await pool().end();
});

describe("analyse d'une photo : chemin nominal (estimation visuelle, sans carte)", () => {
  it("affiche uniquement les étapes réellement exécutées (pas de calibration sans carte), puis crée un rapport non payé", async () => {
    const ev = await run(await input(), deps());
    expect(stepsOf(ev)).toEqual(["recevabilite", "indicateurs", "redaction"]);
    expect(lastOf(ev)).toEqual({ type: "ready", reportId: expect.any(String) });
    const row = await getReport(readyId(ev));
    expect(row?.paid).toBe(false);
    expect(row?.formula).toBe("B");
    expect(readyId(ev).length).toBeGreaterThanOrEqual(32);
  });

  it("rapport photo-report/2 : en-tête (numéro à 5 chiffres, état observé, méthode), indicateurs calculés, texte vérifié", async () => {
    const ev = await run(await input(), deps());
    const r = (await getReport(readyId(ev)))!.results;
    const m = r.morpho!;
    expect(m).toMatchObject({ ...STANDARD_VERSIONS, methode: "visuelle", partielle: false });
    expect(m.numero).toMatch(/^\d{5}$/);
    const ind = m.indicateurs!;
    expect(ind.state).toBe("erect");
    expect(ind.longueurCm).toBe(SIMULATED_ESTIMATES.longueur_cm);
    expect(ind.circonferenceCm).toBe(SIMULATED_ESTIMATES.circonference_cm);
    expect(ind.symetrie).toBe(93);
    expect(r.score).toBe(ind.score);
    expect(r.length.percentile).toBe(ind.percentileLongueur);
    // Le texte stocké est exactement un texte qui passe tous les contrôles
    const check = checkReportText({ schemaVersion: "photo-report/2", ...m.texte }, { indicators: ind, allowedHighlights: m.texte.points_remarquables.map((p) => p.indicateur) });
    expect(check.ok).toBe(true);
  });

  it("l'état observé par le modèle prime : au repos, aucun percentile de longueur", async () => {
    const ev = await run(await input({ state: "erect" }), deps({ scenario: "rest" }));
    const r = (await getReport(readyId(ev)))!.results;
    expect(r.state).toBe("rest");
    expect(r.morpho?.indicateurs?.percentileLongueur).toBeNull();
    expect(r.length.percentile).toBeUndefined();
    expect(r.girth.percentile).toBeGreaterThan(0);
    expect(r.morpho?.texte.note_laboratoire).toMatch(/érection/);
  });

  it("courbure de 35° : le rapport contient la phrase d'avis médical dans « Axe et courbure »", async () => {
    const ev = await run(await input(), deps({ scenario: "curved" }));
    const r = (await getReport(readyId(ev)))!.results;
    expect(r.curvature.angleDeg).toBe(35);
    expect(r.morpho?.texte.axe_courbure).toMatch(/avis médical/);
  });

  it("bêta photo : le rapport est créé débloqué et marqué bêta gratuite, sans paiement", async () => {
    const ev = await run(await input({ freeBeta: true }), deps());
    const row = await getReport(readyId(ev));
    expect(row).toMatchObject({ paid: true, free_beta: true, paid_at: null });
    expect((await getReportView(readyId(ev))).status).toBe("unlocked");
    expect(await count("payments")).toBe(0);
  });

  it("deux appels au modèle (vision puis texte), dépense réglée, tentative journalisée sans adresse IP en clair", async () => {
    const { gate, settled } = spendGate();
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    await run(await input(), deps({ vision, spend: gate }));
    expect(calls).toMatchObject({ analyse: 1, text: 1 });
    expect(settled).toEqual([{ costMicros: 0, calls: 2 }]);
    const { rows } = await pool().query("SELECT * FROM analysis_attempts");
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("ok");
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.9");
    expect(await count("report_log")).toBe(1);
  });

  it("les lignes de journal portent la version du schéma et des prompts, et jamais les observations", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await run(await input(), deps());
    await run(await input(), deps({ scenario: "refuse_face" }));
    await run(await input(), deps({ scenario: "quality" }));
    const lines = info.mock.calls.map((c) => JSON.parse(String(c[0])) as Record<string, string>);
    expect(lines.map((l) => l.event)).toEqual(["analysis_ok", "analysis_refused", "analysis_partial"]);
    for (const l of lines) expect(l).toMatchObject(STANDARD_VERSIONS);
    const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain(OBSERVATION_MARKER);
  });
});

describe("confidentialité : photo et observations brutes jamais stockées", () => {
  it("aucune trace de la photo ni des observations du modèle en base (rapports, tentatives, journal)", async () => {
    const photo = await neutralPhoto();
    await run(await input({ photo }), deps());
    await run(await input(), deps({ scenario: "calibrated" }));
    const dump = [
      ...(await pool().query("SELECT * FROM reports")).rows,
      ...(await pool().query("SELECT * FROM analysis_attempts")).rows,
      ...(await pool().query("SELECT * FROM report_log")).rows,
      ...(await pool().query("SELECT * FROM calibration_pairs")).rows,
    ];
    const all = JSON.stringify(dump);
    expect(all).not.toContain(photo.toString("base64").slice(0, 40));
    expect(all).not.toContain("/9j/"); // début d'un JPEG en base64
    expect(all).not.toContain(OBSERVATION_MARKER);
    expect(all).not.toContain("observations");
  });
});

describe("carte de référence : mesure calibrée et paire de calibration", () => {
  it("carte présente et lisible : mesure géométrique (scène simulée de 13 cm × 4 cm), méthode « calibree », étape de calibration affichée", async () => {
    const ev = await run(await input(), deps({ scenario: "calibrated" }));
    expect(stepsOf(ev)).toEqual(["recevabilite", "calibration", "indicateurs", "redaction"]);
    const r = (await getReport(readyId(ev)))!.results;
    expect(r.morpho?.methode).toBe("calibree");
    expect(r.length.value).toBeGreaterThan(12.6);
    expect(r.length.value).toBeLessThan(13.4);
    expect(r.girth.value).toBeGreaterThan(12.2); // π × 4 cm = 12,57
    expect(r.girth.value).toBeLessThan(12.9);
    expect(r.length.value).not.toBe(SIMULATED_ESTIMATES.longueur_cm); // l'estimation du modèle n'est pas utilisée
  });

  it("conserve UNIQUEMENT la paire (mesure par la carte, estimation du modèle sans la carte), sans aucune autre donnée", async () => {
    const ev = await run(await input(), deps({ scenario: "calibrated" }));
    const r = (await getReport(readyId(ev)))!.results;
    const pairs = await listCalibrationPairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].cardLengthCm).toBeCloseTo(r.length.value, 1);
    expect(pairs[0].cardGirthCm).toBeCloseTo(r.girth.value, 1);
    expect(pairs[0]).toMatchObject({ modelLengthCm: 13.4, modelGirthCm: 11.9 });
    const cols = (await pool().query("SELECT column_name FROM information_schema.columns WHERE table_name = 'calibration_pairs' AND table_schema = current_schema() ORDER BY column_name")).rows.map((x) => x.column_name);
    expect(cols).toEqual(["card_girth_cm", "card_length_cm", "model_girth_cm", "model_length_cm"]);
  });

  it("sans carte, ou carte inexploitable (photo trop inclinée) : estimation visuelle, aucune paire, et ce n'est PAS un refus", async () => {
    let ev = await run(await input(), deps());
    expect((await getReport(readyId(ev)))!.results.morpho?.methode).toBe("visuelle");
    ev = await run(await input(), deps({ scenario: "card_unusable" }));
    expect(stepsOf(ev)).toContain("calibration");
    const r = (await getReport(readyId(ev)))!.results;
    expect(r.morpho?.methode).toBe("visuelle");
    expect(r.length.value).toBe(SIMULATED_ESTIMATES.longueur_cm);
    expect(await count("calibration_pairs")).toBe(0);
  });
});

describe("refus de recevabilité : aucun rapport, message neutre, motif journalisé", () => {
  const cases: [Scenario, string][] = [
    ["refuse_face", "visage_visible"],
    ["doute_majorite", "doute_majorite"],
    ["image_non_originale", "image_non_originale"],
    ["plusieurs_personnes", "plusieurs_personnes"],
    ["provider_refusal", "refus_prestataire"],
  ];
  for (const [scenario, motif] of cases) {
    it(`${scenario} → refus neutre, motif « ${motif} », aucun rapport, aucune rédaction`, async () => {
      const { vision, calls } = spyVision(createSimulatedVision(scenario));
      const ev = await run(await input(), deps({ vision }));
      expect(lastOf(ev)).toEqual({ type: "refused", message: NEUTRAL_REFUSAL });
      expect(await attempt()).toEqual({ outcome: "refused", motif });
      expect(await count("reports")).toBe(0);
      expect(calls.text).toBe(0);
    });
  }

  it("les messages ne mentionnent jamais l'âge ni la majorité et ne promettent aucun remboursement", () => {
    for (const m of [NEUTRAL_REFUSAL, CAP_MESSAGE]) {
      expect(m).not.toMatch(AGE_WORDS);
      expect(m).not.toMatch(/rembours/i);
    }
    expect("Vous devez être majeur").toMatch(AGE_WORDS); // garde-fou du test lui-même
  });

  it("image reconnue par le filtrage d'empreintes : détruite sans analyse", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    const blocking: ImageScreeningProvider = { id: "test", screen: async () => ({ blocked: true }) };
    const ev = await run(await input(), deps({ vision, screening: blocking }));
    expect(lastOf(ev)).toEqual({ type: "refused", message: NEUTRAL_REFUSAL });
    expect(calls.analyse).toBe(0);
    expect(await attempt()).toEqual({ outcome: "blocked", motif: "empreinte_connue" });
    expect(await count("reports")).toBe(0);
  });
});

describe("échec technique : rapport PARTIEL sur les valeurs de référence et l'état déclaré", () => {
  async function expectPartial(ev: FlowEvent[], cause: string, state: "rest" | "erect" = "erect") {
    expect(lastOf(ev)).toEqual({ type: "ready", reportId: expect.any(String), partial: true });
    const row = (await getReport(readyId(ev)))!;
    const m = row.results.morpho!;
    expect(m.partielle).toBe(true);
    expect(m.indicateurs).toBeNull();
    expect(m.reference?.state).toBe(state);
    expect(await attempt()).toEqual({ outcome: "error", motif: `partiel_${cause}` });
    expect(await count("report_log")).toBe(0); // aucun score, rien dans le journal des scores
    return row;
  }

  it("photo difficile à lire (qualité insuffisante) : rapport partiel, pas de rédaction", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("quality"));
    await expectPartial(await run(await input({ state: "rest" }), deps({ vision })), "qualite_insuffisante", "rest");
    expect(calls.text).toBe(0);
    expect(PARTIAL_LABEL).toBe("Analyse partielle : photo difficile à lire");
  });

  it("panne ou délai du prestataire (appel vision) : rapport partiel", async () => {
    const failing: VisionProvider = {
      id: "panne",
      analyse: async () => {
        throw new VisionError("timeout", "délai dépassé");
      },
      writeReport: async () => ({ refused: false, json: null, usage: NO_USAGE }),
    };
    await expectPartial(await run(await input(), deps({ vision: failing })), "fournisseur_timeout");
  });

  it("panne du prestataire pendant la rédaction : rapport partiel", async () => {
    const failing: VisionProvider = {
      ...createSimulatedVision("ok"),
      writeReport: async () => {
        throw new VisionError("network", "réseau coupé");
      },
    };
    await expectPartial(await run(await input(), deps({ vision: failing })), "fournisseur_network");
  });

  it("réponse vision non conforme une fois : la relance aboutit ; deux fois : rapport partiel", async () => {
    const once = spyVision(createSimulatedVision("garbage_once"));
    let ev = await run(await input(), deps({ vision: once.vision }));
    expect(lastOf(ev)).toEqual({ type: "ready", reportId: expect.any(String) });
    expect(once.calls.analyse).toBe(2);
    await pool().query(TABLES);
    const twice = spyVision(createSimulatedVision("garbage"));
    ev = await run(await input(), deps({ vision: twice.vision }));
    await expectPartial(ev, "vision_invalide");
    expect(twice.calls.analyse).toBe(2);
  });

  it("estimations hors de la plage plausible : rapport partiel", async () => {
    await expectPartial(await run(await input(), deps({ scenario: "implausible" })), "estimation_invraisemblable");
  });

  it("la photo est abandonnée dans tous les cas", async () => {
    const i = await input();
    await run(i, deps({ scenario: "quality" }));
    expect(i.photo).toBeNull();
  });

  it("un rapport partiel est lisible sans paiement (aucune mesure à vendre) et ne contient aucune mesure", async () => {
    const ev = await run(await input(), deps({ scenario: "quality" }));
    const view = await getReportView(readyId(ev));
    expect(view.status).toBe("unlocked");
    if (view.status === "unlocked") expect(view.results.score).toBe(0);
  });
});

describe("rédaction vérifiée par le code : une relance, en transmettant les règles violées", () => {
  it("mot interdit une fois : relance avec la liste des violations, puis rapport complet", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("text_forbidden_once"));
    const ev = await run(await input(), deps({ vision }));
    expect(lastOf(ev)).toEqual({ type: "ready", reportId: expect.any(String) });
    expect(calls.text).toBe(2);
    expect(calls.violations[0]).toBeUndefined();
    expect(calls.violations[1]?.join()).toMatch(/couleur ou teinte/);
    expect((await getReport(readyId(ev)))!.results.morpho?.texte.aspect_surface).not.toMatch(/teinte/);
  });

  it("mot interdit deux fois : rapport partiel (motif redaction_interdits)", async () => {
    const ev = await run(await input(), deps({ scenario: "text_forbidden" }));
    expect((lastOf(ev) as { partial?: boolean }).partial).toBe(true);
    expect(await attempt()).toEqual({ outcome: "error", motif: "partiel_redaction_interdits" });
  });

  it("valeur recalculée par le modèle deux fois : rapport partiel", async () => {
    await run(await input(), deps({ scenario: "text_foreign_number" }));
    expect(await attempt()).toEqual({ outcome: "error", motif: "partiel_redaction_interdits" });
  });

  it("rédaction refusée par le prestataire deux fois : rapport partiel", async () => {
    await run(await input(), deps({ scenario: "text_refused" }));
    expect(await attempt()).toEqual({ outcome: "error", motif: "partiel_redaction_refusee" });
  });

  it("écarts de forme seulement (texte trop court) : une relance, puis le texte est accepté (règle souple)", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("text_soft"));
    const ev = await run(await input(), deps({ vision }));
    expect(lastOf(ev)).toEqual({ type: "ready", reportId: expect.any(String) });
    expect(calls.text).toBe(2);
    expect(calls.violations[1]?.join()).toMatch(/longueur : \d+ mots/);
    expect(await attempt()).toEqual({ outcome: "ok", motif: null });
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
    let ev = await run(await input({ formula: "C", declared: { length: 14, girth: 12 } }), deps());
    let d = (await getReport(readyId(ev)))!.results.declared!;
    expect(d.flagged).toBe(false);
    expect(Math.abs(d.lengthGapPct)).toBeLessThan(5);
    ev = await run(await input({ formula: "C", declared: { length: 10, girth: 12 } }), deps());
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

  it("limite de 5 analyses par période : la sixième est refusée, refus et rapports partiels comptés aussi", async () => {
    for (let k = 0; k < 5; k++) await run(await input(), deps({ scenario: (["ok", "refuse_face", "quality"] as const)[k % 3] }));
    const ev = await run(await input(), deps());
    expect(lastOf(ev)).toMatchObject({ type: "error", code: "rate" });
  });

  it("plafond de dépense du jour atteint : message « Capacité du jour atteinte », zéro appel au modèle, tentative non comptée", async () => {
    const { vision, calls } = spyVision(createSimulatedVision("ok"));
    const { gate, settled } = spendGate(false);
    const i = await input();
    const ev = await run(i, deps({ vision, spend: gate }));
    expect(lastOf(ev)).toEqual({ type: "error", code: "cap", message: CAP_MESSAGE });
    expect(stepsOf(ev)).toEqual([]);
    expect(calls).toMatchObject({ analyse: 0, text: 0 });
    expect(await count("analysis_attempts")).toBe(0);
    expect(await count("reports")).toBe(0);
    expect(settled).toEqual([]);
    expect(i.photo).toBeNull();
  });

  it("image invalide ou absente : erreur, aucune analyse, réservation rendue sans appel", async () => {
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

  it("supprime les métadonnées (EXIF, GPS) et borne la taille à 1 600 px", async () => {
    const big = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: "#777" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret-gps-test" } })
      .toBuffer();
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
