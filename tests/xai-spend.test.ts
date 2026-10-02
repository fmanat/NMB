import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/lib/db";
import {
  DEFAULT_DAILY_CAP_USD,
  ESTIMATED_ANALYSIS_USD,
  dailyCapUsd,
  dbSpendGate,
  parisDay,
  reserveSpend,
  settleSpend,
  spendHistory,
  toMicros,
  usageCostMicros,
} from "@/lib/xaiSpend";

const clean = () => pool().query("TRUNCATE xai_daily_spend");
beforeEach(clean);
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await clean();
  await pool().end();
});

const row = async (day: string) => (await pool().query("SELECT reserved_micros::bigint AS r, spent_micros::bigint AS s, calls, analyses FROM xai_daily_spend WHERE day = $1", [day])).rows[0];

describe("plafond configuré : XAI_DAILY_CAP_USD", () => {
  it("défaut 5 $ ; valeur invalide, vide, négative ou absente : défaut ; 0 accepté (aucun appel)", () => {
    expect(DEFAULT_DAILY_CAP_USD).toBe(5);
    expect(dailyCapUsd({})).toBe(5);
    for (const v of ["", "  ", "abc", "-1", "NaN", "Infinity"]) expect(dailyCapUsd({ XAI_DAILY_CAP_USD: v }), v).toBe(5);
    expect(dailyCapUsd({ XAI_DAILY_CAP_USD: "12.5" })).toBe(12.5);
    expect(dailyCapUsd({ XAI_DAILY_CAP_USD: "2,5" })).toBe(2.5);
    expect(dailyCapUsd({ XAI_DAILY_CAP_USD: "0" })).toBe(0);
  });

  it("coût estimé d'après les jetons et le tarif configuré (micro-dollars entiers)", () => {
    expect(usageCostMicros({ tokensIn: 5000, tokensOut: 800 }, { inPerM: 2, outPerM: 6 })).toBe(10_000 + 4_800); // 0,0148 $
    expect(toMicros(0.03)).toBe(30_000);
    expect(ESTIMATED_ANALYSIS_USD).toBeGreaterThan(0.0216); // coût mesuré d'une analyse (docs/DECISIONS.md, bloc 3) : la réservation le couvre
  });
});

describe("jour civil Europe/Paris", () => {
  it("bascule à minuit heure de Paris, pas à minuit UTC (hiver : UTC+1, été : UTC+2)", () => {
    expect(parisDay(new Date("2026-01-15T22:59:59Z"))).toBe("2026-01-15");
    expect(parisDay(new Date("2026-01-15T23:00:00Z"))).toBe("2026-01-16");
    expect(parisDay(new Date("2026-07-15T21:59:59Z"))).toBe("2026-07-15");
    expect(parisDay(new Date("2026-07-15T22:00:00Z"))).toBe("2026-07-16");
    expect(parisDay(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("réservation et règlement (base de test)", () => {
  const day = "2026-03-10";
  const cap = toMicros(0.1); // 0,10 $
  const est = toMicros(0.03);

  it("limites exactes : acceptée tant que dépensé + réservé + estimation <= plafond, refusée au-delà", async () => {
    expect(await reserveSpend(day, est, cap)).toBe(true); // 0,03
    expect(await reserveSpend(day, est, cap)).toBe(true); // 0,06
    expect(await reserveSpend(day, est, cap)).toBe(true); // 0,09
    expect(await reserveSpend(day, est, cap)).toBe(false); // 0,12 > 0,10
    expect(await row(day)).toMatchObject({ r: "90000", s: "0", calls: 0, analyses: 0 });
    // Le règlement rend la réservation et inscrit le coût réel : 0,09 réservé → 0,06 réservé + 0,01 dépensé → une nouvelle réservation passe (0,10 <= 0,10).
    await settleSpend(day, est, { costMicros: toMicros(0.01), calls: 3 });
    expect(await row(day)).toMatchObject({ r: "60000", s: "10000", calls: 3, analyses: 1 });
    expect(await reserveSpend(day, est, cap)).toBe(true); // 0,01 + 0,06 + 0,03 = 0,10 : égalité acceptée
    expect(await reserveSpend(day, est, cap)).toBe(false);
  });

  it("dépense du jour déjà au plafond (ou au-dessus) : refus, quel que soit l'état des réservations", async () => {
    await pool().query("INSERT INTO xai_daily_spend (day, spent_micros) VALUES ($1, $2)", [day, cap]);
    expect(await reserveSpend(day, est, cap)).toBe(false);
    await pool().query("UPDATE xai_daily_spend SET spent_micros = $2 WHERE day = $1", [day, cap + 1]);
    expect(await reserveSpend(day, est, cap)).toBe(false);
  });

  it("plafond 0 (ou inférieur à l'estimation) : aucune réservation possible, même le premier jour", async () => {
    expect(await reserveSpend(day, est, 0)).toBe(false);
    expect(await reserveSpend(day, est, est - 1)).toBe(false);
    expect(await reserveSpend(day, est, est)).toBe(true);
    expect((await pool().query("SELECT count(*)::int AS n FROM xai_daily_spend")).rows[0].n).toBe(1);
  });

  it("règlement sans appel au modèle (image invalide, filtrage) : la réservation est rendue, rien n'est compté", async () => {
    expect(await reserveSpend(day, est, cap)).toBe(true);
    await settleSpend(day, est, { costMicros: 0, calls: 0 });
    expect(await row(day)).toMatchObject({ r: "0", s: "0", calls: 0, analyses: 0 });
  });

  it("concurrence : 20 réservations simultanées pour un plafond qui n'en permet que 3, exactement 3 passent, jamais plus", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => reserveSpend(day, est, cap)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await row(day)).toMatchObject({ r: "90000" });
    // Avec les coûts réels sous l'estimation, le plafond n'est jamais dépassé.
    for (let k = 0; k < 3; k++) await settleSpend(day, est, { costMicros: toMicros(0.022), calls: 3 });
    const r = await row(day);
    expect(Number(r.s)).toBeLessThanOrEqual(cap);
    expect(r).toMatchObject({ r: "0", analyses: 3, calls: 9 });
  });

  it("deux jours distincts ont chacun leur plafond", async () => {
    expect(await reserveSpend("2026-03-10", cap, cap)).toBe(true);
    expect(await reserveSpend("2026-03-10", 1, cap)).toBe(false);
    expect(await reserveSpend("2026-03-11", cap, cap)).toBe(true);
  });

  it("la porte par défaut lit le plafond et le jour de Paris", async () => {
    vi.stubEnv("XAI_DAILY_CAP_USD", "0.05");
    const now = new Date("2026-03-10T23:30:00Z"); // 11 mars à Paris
    const a = await dbSpendGate.reserve(now);
    expect(a).toMatchObject({ ok: true, day: "2026-03-11", estimateMicros: est });
    expect(await dbSpendGate.reserve(now)).toMatchObject({ ok: false, day: "2026-03-11" }); // 0,03 + 0,03 > 0,05
    await dbSpendGate.settle(a, { costMicros: 20_000, calls: 2 });
    expect(await row("2026-03-11")).toMatchObject({ r: "0", s: "20000", calls: 2, analyses: 1 });
    await dbSpendGate.settle({ ok: false, day: "2026-03-11" }, { costMicros: 1, calls: 1 }); // sans effet
    expect(await row("2026-03-11")).toMatchObject({ s: "20000" });
  });

  it("historique des 7 derniers jours (Paris), du plus récent au plus ancien, jours sans appel à zéro", async () => {
    const now = new Date("2026-03-10T12:00:00Z");
    await pool().query("INSERT INTO xai_daily_spend (day, spent_micros, calls, analyses) VALUES ('2026-03-10', 150000, 9, 3), ('2026-03-07', 20000, 2, 1), ('2026-03-03', 999999, 1, 1)");
    const h = await spendHistory(7, now);
    expect(h.map((d) => d.day)).toEqual(["2026-03-10", "2026-03-09", "2026-03-08", "2026-03-07", "2026-03-06", "2026-03-05", "2026-03-04"]);
    expect(h[0]).toEqual({ day: "2026-03-10", spentUsd: 0.15, reservedUsd: 0, calls: 9, analyses: 3 });
    expect(h[3]).toMatchObject({ spentUsd: 0.02, calls: 2 });
    expect(h[1]).toEqual({ day: "2026-03-09", spentUsd: 0, reservedUsd: 0, calls: 0, analyses: 0 });
  });
});
