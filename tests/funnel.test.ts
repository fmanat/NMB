import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { CLIENT_KINDS, FUNNEL_KINDS, STEPS, computeFunnel, funnelCounts, recordEvent, shouldCount, type StepKey } from "@/lib/funnel";
import { POST } from "@/app/api/e/route";

const TABLES = "TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, funnel_events CASCADE";
beforeEach(async () => {
  await pool().query(TABLES);
});
afterAll(async () => {
  await pool().query(TABLES);
  await pool().end();
});

const zero = () => Object.fromEntries(STEPS.map((s) => [s.key, 0])) as Record<StepKey, number>;
const post = (body: unknown, headers: Record<string, string> = { "user-agent": "Mozilla/5.0 (X11; Linux) Firefox/130" }) =>
  POST(new Request("http://x/api/e", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }));
const count = async (kind?: string) =>
  (await pool().query(kind ? "SELECT count(*)::int AS n FROM funnel_events WHERE kind = $1" : "SELECT count(*)::int AS n FROM funnel_events", kind ? [kind] : [])).rows[0].n as number;

describe("taux de passage", () => {
  it("chaque étape est rapportée à son étape précédente, et aux visites de l'accueil", () => {
    const c = { ...zero(), home_view: 1000, questionnaire_start: 400, questionnaire_done: 300, report_view: 270, card_created: 54, challenge_created: 27, challenge_taken: 9 };
    const rows = Object.fromEntries(computeFunnel(c).map((r) => [r.key, r]));
    expect(rows.home_view.rateFromParent).toBeNull();
    expect(rows.questionnaire_start.rateFromParent).toBeCloseTo(0.4);
    expect(rows.questionnaire_done.rateFromParent).toBeCloseTo(0.75);
    expect(rows.report_view.rateFromParent).toBeCloseTo(0.9);
    expect(rows.card_created.rateFromParent).toBeCloseTo(0.2);
    expect(rows.challenge_created.rateFromParent).toBeCloseTo(0.1);
    expect(rows.challenge_taken.rateFromParent).toBeCloseTo(1 / 3);
    expect(rows.challenge_taken.rateFromTop).toBeCloseTo(0.009);
    expect(rows.card_created.rateFromTop).toBeCloseTo(0.054);
  });
  it("dénominateur nul : pas de taux (jamais de division par zéro ni de pourcentage inventé)", () => {
    const rows = computeFunnel(zero());
    for (const r of rows) {
      expect(r.rateFromParent).toBeNull();
      expect(r.rateFromTop).toBeNull();
    }
    const c = { ...zero(), questionnaire_start: 5 }; // aucune visite d'accueil enregistrée
    expect(computeFunnel(c).find((r) => r.key === "questionnaire_start")!.rateFromParent).toBeNull();
  });
  it("les étapes de la version payante sont signalées", () => {
    expect(STEPS.filter((s) => s.paidOnly).map((s) => s.key)).toEqual(["locked_preview", "checkout_started", "paid"]);
  });
});

describe("collecte anonyme", () => {
  it("la table ne contient que type et date : ni identifiant de rapport, ni IP, ni user-agent", async () => {
    const cols = (await pool().query("SELECT column_name FROM information_schema.columns WHERE table_name = 'funnel_events' AND table_schema = current_schema() ORDER BY column_name")).rows.map((r) => r.column_name);
    expect(cols).toEqual(["created_at", "id", "kind"]);
  });
  it("le navigateur ne peut envoyer que les 6 événements prévus ; le serveur écrit les autres", async () => {
    expect([...CLIENT_KINDS].sort()).toEqual(["home_view", "locked_preview", "questionnaire_start", "report_view", "share_click", "upsell_click"]);
    for (const k of CLIENT_KINDS) expect((await post({ k })).status).toBe(204);
    expect(await count()).toBe(CLIENT_KINDS.length);
    await pool().query(TABLES);
    for (const k of ["questionnaire_done", "card_created", "paid", "n_importe_quoi", "", 5, null, { x: 1 }]) expect((await post({ k })).status).toBe(204);
    expect(await count()).toBe(0); // 204 identique, mais rien d'écrit : on ne révèle pas ce qui est accepté
  });
  it("corps invalide : 204 sans effet", async () => {
    for (const body of ["", "pas du json", "[1,2]", "x".repeat(10_000)]) expect((await post(body)).status).toBe(204);
    expect(await count()).toBe(0);
  });
  it("ne compte ni les robots, ni Do Not Track, ni Global Privacy Control, ni l'absence de user-agent", async () => {
    const ua = "Mozilla/5.0 (X11; Linux) Firefox/130";
    const refused: Record<string, string>[] = [
      { "user-agent": "Googlebot/2.1" },
      { "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)" },
      { "user-agent": "facebookexternalhit/1.1" },
      { "user-agent": "curl/8.0" },
      { "user-agent": ua, dnt: "1" },
      { "user-agent": ua, "sec-gpc": "1" },
      {},
    ];
    for (const h of refused) await post({ k: "home_view" }, h);
    expect(await count()).toBe(0);
    await post({ k: "home_view" }, { "user-agent": ua, dnt: "0" });
    expect(await count()).toBe(1);
    expect(shouldCount(new Headers({ "user-agent": "HeadlessChrome/130" }))).toBe(true); // les tests navigateur doivent être comptés
  });
  it("recordEvent ne lève jamais d'erreur et la liste de la base correspond à celle du code", async () => {
    await recordEvent("home_view");
    // @ts-expect-error type d'événement invalide : refusé par la base, mais sans exception
    await expect(recordEvent("inconnu")).resolves.toBeUndefined();
    expect(await count()).toBe(1);
    for (const k of FUNNEL_KINDS) await pool().query("INSERT INTO funnel_events (kind) VALUES ($1)", [k]);
  });
});

describe("comptage par période", () => {
  it("compte événements, défis et paiements, et respecte la période", async () => {
    const db = pool();
    await db.query("INSERT INTO funnel_events (kind, created_at) VALUES ('home_view', now()), ('home_view', now() - interval '10 days'), ('home_view', now() - interval '60 days'), ('questionnaire_start', now())");
    await db.query("INSERT INTO stat_events (kind, created_at) VALUES ('challenge_created', now()), ('challenge_created', now() - interval '40 days'), ('challenge_taken', now())");
    const all = await funnelCounts(null);
    expect(all).toMatchObject({ home_view: 3, questionnaire_start: 1, challenge_created: 2, challenge_taken: 1, checkout_started: 0, paid: 0 });
    expect((await funnelCounts(7)).home_view).toBe(1);
    expect((await funnelCounts(30)).home_view).toBe(2);
    expect((await funnelCounts(30)).challenge_created).toBe(1);
  });
  it("paiements lancés et réussis (version payante) ; la bêta gratuite n'en crée aucun", async () => {
    const db = pool();
    await db.query(
      `INSERT INTO payments (report_id, provider, provider_ref, amount_cents, status, created_at, confirmed_at, formula) VALUES
       (NULL, 'simulation', 'r1', 299, 'succeeded', now(), now(), 'A'),
       (NULL, 'simulation', 'r2', 299, 'pending', now(), NULL, 'A'),
       (NULL, 'simulation', 'r3', 299, 'succeeded', now() - interval '50 days', now() - interval '50 days', 'A')`,
    );
    const c7 = await funnelCounts(7);
    expect([c7.checkout_started, c7.paid]).toEqual([2, 1]);
    const all = await funnelCounts(null);
    expect([all.checkout_started, all.paid]).toEqual([3, 2]);
  });
});
