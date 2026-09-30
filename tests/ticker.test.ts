import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TICKER } from "@/config/site";
import { pool } from "@/lib/db";
import { publicStats } from "@/lib/repo";

// Insère n rapports de formule B payés, score 80, directement en SQL.
async function insertPaid(n: number, formula = "B") {
  await pool().query(
    `INSERT INTO reports (id, formula, input, results, score, paid, paid_at)
     SELECT md5(g::text) || md5((g + 100000)::text), $2, '{}'::jsonb, '{}'::jsonb, 80, true, now() FROM generate_series(1, $1) g`,
    [n, formula],
  );
}

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts CASCADE");
});
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts CASCADE");
  await pool().end();
});

describe("bandeau de statistiques : seuil de la configuration", () => {
  it("sous le seuil : aucun chiffre n'est exposé", async () => {
    await insertPaid(TICKER.minAnalysesToShow - 1);
    const s = await publicStats();
    expect(s).toEqual({ show: false });
  });

  it("au seuil : statistiques réelles, issues des formules photo payées uniquement", async () => {
    await insertPaid(TICKER.minAnalysesToShow);
    const s = await publicStats();
    expect(s.show).toBe(true);
    if (s.show) {
      expect(s.totalAnalyses).toBe(TICKER.minAnalysesToShow);
      expect(s.averageScore).toBe(80);
      expect(s.bestScoreThisWeek).toBe(80);
    }
  });

  it("les rapports de formule A, même nombreux, ne font jamais apparaître le bandeau", async () => {
    await insertPaid(TICKER.minAnalysesToShow, "A");
    expect(await publicStats()).toEqual({ show: false });
  });
});
