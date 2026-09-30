import { createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { WEBHOOK } from "@/config/site";
import { buildDailyAggregate, checkWebhookUrl, sendDailyWebhook, signPayload, yesterdayParis } from "@/lib/admin/webhook";
import { pool } from "@/lib/db";

const DAY = "2026-03-10"; // hiver : Paris = UTC+1
const NOON = "2026-03-10T11:00:00Z"; // midi à Paris

const log = (formula: string, score: number, created: string, paid: string | null) =>
  pool().query("INSERT INTO report_log (key, formula, score, created_at, paid_at) VALUES (md5(random()::text || clock_timestamp()::text), $1, $2, $3, $4)", [formula, score, created, paid]);
const attempt = (formula: string, created: string, outcome = "ok") =>
  pool().query("INSERT INTO analysis_attempts (formula, outcome, created_at) VALUES ($1, $2, $3)", [formula, outcome, created]);

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
});
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
  await pool().end();
});

function allKeys(o: unknown, out: string[] = []): string[] {
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

describe("agrégats quotidiens", () => {
  it("compte les analyses lancées et payées par protocole, pour le jour demandé uniquement", async () => {
    for (let i = 0; i < 3; i++) await log("A", 80, NOON, i < 2 ? NOON : null); // A : 3 créés, 2 payés
    for (let i = 0; i < 4; i++) await attempt("B", NOON, i === 0 ? "ok" : "refused"); // B : 4 tentatives
    await attempt("C", NOON);
    await attempt("C", NOON, "error");
    await log("A", 70, "2026-03-09T11:00:00Z", null); // la veille : exclu
    await attempt("B", "2026-03-11T11:00:00Z"); // le lendemain : exclu
    const a = await buildDailyAggregate(DAY);
    expect(a.version).toBe(1);
    expect(a.date).toBe(DAY);
    expect(a.analyses.A).toEqual({ lancees: 3, payees: 2 });
    expect(a.analyses.B.lancees).toBe(4);
    expect(a.analyses.C.lancees).toBe(2);
  });

  it("la journée est celle de Paris : 00h30 à Paris appartient au jour suivant", async () => {
    await log("A", 80, "2026-03-09T23:30:00Z", null); // 00h30 le 10 mars à Paris : compte pour le 10
    await log("A", 80, "2026-03-10T23:30:00Z", null); // 00h30 le 11 mars à Paris : ne compte pas pour le 10
    await log("A", 80, "2026-03-09T22:30:00Z", null); // 23h30 le 9 mars à Paris : ne compte pas pour le 10
    expect((await buildDailyAggregate(DAY)).analyses.A.lancees).toBe(1);
  });

  it("score moyen et répartition : uniquement les rapports photo payés ce jour-là", async () => {
    const scores = [60, 75, 75, 82, 82, 82, 82, 82, 95];
    for (const s of scores) await log("B", s, NOON, NOON);
    await log("A", 98, NOON, NOON); // formule A payée : exclue des scores (valeur déclarée)
    const a = await buildDailyAggregate(DAY);
    expect(a.photo.rapports_payes).toBe(9);
    expect(a.photo.score_moyen).toBe(Math.round((scores.reduce((x, y) => x + y, 0) / 9) * 10) / 10);
    // 60 → 60-69 (1, masqué), 75 ×2 → 70-79 (2, masqué), 82 ×5 → 80-89 (5), 95 → 90-98 (1, masqué)
    expect(a.photo.repartition_scores).toEqual({ "40-59": 0, "60-69": "<5", "70-79": "<5", "80-89": 5, "90-98": "<5" });
  });

  it(`sous ${WEBHOOK.minGroup} rapports photo payés, ni moyenne ni répartition (petit groupe identifiable)`, async () => {
    for (let i = 0; i < WEBHOOK.minGroup - 1; i++) await log("B", 80, NOON, NOON);
    const a = await buildDailyAggregate(DAY);
    expect(a.photo.rapports_payes).toBe(WEBHOOK.minGroup - 1);
    expect(a.photo.score_moyen).toBeNull();
    expect(a.photo.repartition_scores).toBeNull();
  });

  it("jour sans activité : des zéros", async () => {
    const a = await buildDailyAggregate(DAY);
    expect(a.analyses).toEqual({ A: { lancees: 0, payees: 0 }, B: { lancees: 0, payees: 0 }, C: { lancees: 0, payees: 0 } });
    expect(a.photo).toEqual({ rapports_payes: 0, score_moyen: null, repartition_scores: null });
  });

  it("aucune donnée individuelle : seules des clés d'agrégats sont présentes", async () => {
    await log("B", 80, NOON, NOON);
    await attempt("B", NOON);
    const keys = new Set(allKeys(await buildDailyAggregate(DAY)));
    const allowed = new Set(["version", "date", "generated_at", "analyses", "A", "B", "C", "lancees", "payees", "photo", "rapports_payes", "score_moyen", "repartition_scores", ...["40-59", "60-69", "70-79", "80-89", "90-98"]]);
    for (const k of keys) expect(allowed.has(k), `clé inattendue : ${k}`).toBe(true);
    for (const forbidden of ["ip", "ip_hash", "key", "id", "report_id", "reportId", "motif", "input", "results", "length", "girth"]) expect(keys.has(forbidden)).toBe(false);
  });

  it("refuse une date mal formée (aucune injection SQL possible)", async () => {
    await expect(buildDailyAggregate("10/03/2026")).rejects.toThrow(/Date invalide/);
    await expect(buildDailyAggregate("2026-03-10'; DROP TABLE reports;--")).rejects.toThrow(/Date invalide/);
  });

  it("la veille à Paris est une date AAAA-MM-JJ", async () => {
    expect(await yesterdayParis()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("adresse du webhook", () => {
  it("https accepté ; http seulement vers la machine locale", () => {
    expect(checkWebhookUrl("https://hook.exemple.fr/abc").ok).toBe(true);
    expect(checkWebhookUrl("http://localhost:5678/webhook").ok).toBe(true);
    expect(checkWebhookUrl("http://127.0.0.1:5678/webhook").ok).toBe(true);
    expect(checkWebhookUrl("http://hook.exemple.fr/abc").ok).toBe(false);
    expect(checkWebhookUrl("ftp://hook.exemple.fr/abc").ok).toBe(false);
    expect(checkWebhookUrl("pas une adresse").ok).toBe(false);
  });
});

describe("envoi quotidien", () => {
  const URL_OK = "https://hook.exemple.fr/stats";
  const stub = (status = 200) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response("ok", { status });
    }) as typeof fetch;
    return { calls, fetchImpl };
  };

  it("sans adresse configurée : rien n'est envoyé", async () => {
    const s = stub();
    expect(await sendDailyWebhook({ day: DAY, url: "", fetchImpl: s.fetchImpl })).toEqual({ status: "skipped_no_url" });
    expect(s.calls).toHaveLength(0);
  });

  it("adresse refusée (http distant) : rien n'est envoyé", async () => {
    const s = stub();
    const r = await sendDailyWebhook({ day: DAY, url: "http://hook.exemple.fr/x", fetchImpl: s.fetchImpl });
    expect(r.status).toBe("invalid_url");
    expect(s.calls).toHaveLength(0);
  });

  it("envoie une seule fois par jour, avec une signature vérifiable", async () => {
    await log("B", 80, NOON, NOON);
    const s = stub();
    const r = await sendDailyWebhook({ day: DAY, url: URL_OK, secret: "secret-webhook", fetchImpl: s.fetchImpl });
    expect(r).toEqual({ status: "sent", day: DAY, httpStatus: 200 });
    expect(s.calls).toHaveLength(1);
    const { init } = s.calls[0];
    expect(init.method).toBe("POST");
    const body = String(init.body);
    expect(JSON.parse(body).date).toBe(DAY);
    const sig = (init.headers as Record<string, string>)["x-bitometre-signature"];
    expect(sig).toBe("sha256=" + createHmac("sha256", "secret-webhook").update(body).digest("hex"));
    expect(sig).toBe(signPayload(body, "secret-webhook"));

    // deuxième lancement le même jour : aucun nouvel envoi
    expect(await sendDailyWebhook({ day: DAY, url: URL_OK, secret: "secret-webhook", fetchImpl: s.fetchImpl })).toEqual({ status: "already_sent", day: DAY });
    expect(s.calls).toHaveLength(1);
  });

  it("sans secret, pas d'en-tête de signature", async () => {
    const s = stub();
    await sendDailyWebhook({ day: DAY, url: URL_OK, secret: "", fetchImpl: s.fetchImpl });
    expect((s.calls[0].init.headers as Record<string, string>)["x-bitometre-signature"]).toBeUndefined();
  });

  it("une réponse en erreur n'est pas enregistrée : le jour sera réessayé", async () => {
    const bad = stub(500);
    expect((await sendDailyWebhook({ day: DAY, url: URL_OK, fetchImpl: bad.fetchImpl })).status).toBe("failed");
    expect((await pool().query("SELECT count(*)::int AS n FROM webhook_deliveries")).rows[0].n).toBe(0);
    const good = stub(200);
    expect((await sendDailyWebhook({ day: DAY, url: URL_OK, fetchImpl: good.fetchImpl })).status).toBe("sent");
  });

  it("une panne réseau n'est pas enregistrée non plus", async () => {
    const fetchImpl = (async () => {
      throw new Error("réseau coupé");
    }) as typeof fetch;
    const r = await sendDailyWebhook({ day: DAY, url: URL_OK, fetchImpl });
    expect(r).toEqual({ status: "failed", day: DAY, reason: "réseau coupé" });
    expect((await pool().query("SELECT count(*)::int AS n FROM webhook_deliveries")).rows[0].n).toBe(0);
  });

  it("les redirections ne sont pas suivies (les données ne partent pas ailleurs)", async () => {
    const s = stub();
    await sendDailyWebhook({ day: DAY, url: URL_OK, fetchImpl: s.fetchImpl });
    expect(s.calls[0].init.redirect).toBe("error");
  });
});
