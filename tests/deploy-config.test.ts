import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pool } from "@/lib/db";

const read = (p: string) => readFileSync(p, "utf8");

describe("configuration Clever Cloud", () => {
  const jobs = JSON.parse(read("clevercloud/cron.json")) as string[];

  it("deux tâches planifiées : purge horaire et webhook quotidien, au format cron avec $ROOT", () => {
    expect(jobs).toHaveLength(2);
    for (const j of jobs) expect(j).toMatch(/^\S+ \S+ \S+ \S+ \S+ \$ROOT\/clevercloud\/[\w-]+\.sh$/);
    expect(jobs[0].startsWith("0 * * * * ")).toBe(true); // toutes les heures
    expect(jobs[1]).toMatch(/^\d+ \d+ \* \* \* /); // une fois par jour
  });

  it("chaque script existe, commence par un shebang, n'a pas de fin de ligne Windows et n'appelle que des scripts du projet", () => {
    for (const j of jobs) {
      const path = j.split(" $ROOT/")[1];
      expect(existsSync(path), path).toBe(true);
      const body = read(path);
      expect(body.startsWith("#!/bin/sh\n")).toBe(true);
      expect(body).not.toContain("\r");
      const target = body.match(/exec (?:node|npx tsx) (scripts\/[\w-]+\.m[jt]s)/)?.[1];
      expect(target, path).toBeTruthy();
      expect(existsSync(target!), target).toBe(true);
    }
  });

  it("le .gitattributes impose des fins de ligne Unix pour les scripts shell", () => {
    expect(read(".gitattributes")).toContain("*.sh text eol=lf");
  });

  it("tsx (utilisé par la tâche quotidienne) est une dépendance de production, et la version de Node est indiquée", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.dependencies.tsx).toBeTruthy();
    expect(pkg.engines.node).toBeTruthy();
  });
});

describe("script de purge planifié", () => {
  it("efface les rapports non payés, les IP hachées ET celles des tentatives d'analyse, sans toucher aux rapports payés récents", async () => {
    const db = pool();
    await db.query("TRUNCATE payments, reports, analysis_attempts, report_log CASCADE");
    const old = "now() - interval '30 hours'";
    const id = (c: string) => c.repeat(43);
    await db.query(`INSERT INTO reports (id, formula, input, results, score, paid, ip_hash, created_at) VALUES
      ('${id("a")}', 'A', '{}', '{}', 50, false, 'h1', ${old}),
      ('${id("b")}', 'A', '{}', '{}', 50, true,  'h2', ${old}),
      ('${id("c")}', 'A', '{}', '{}', 50, false, 'h3', now())`);
    await db.query(`INSERT INTO analysis_attempts (ip_hash, formula, created_at) VALUES ('x1', 'B', ${old}), ('x2', 'B', now())`);

    execFileSync("node", ["scripts/purge.mjs"], { env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL! }, stdio: "pipe" });

    const reports = (await db.query("SELECT id, paid, ip_hash FROM reports ORDER BY id")).rows;
    expect(reports.map((r) => r.id[0])).toEqual(["b", "c"]); // le non payé ancien a disparu
    expect(reports.find((r) => r.id[0] === "b")!.ip_hash).toBeNull(); // payé et ancien : conservé, IP effacée
    expect(reports.find((r) => r.id[0] === "c")!.ip_hash).toBe("h3"); // récent : intact
    const att = (await db.query("SELECT ip_hash FROM analysis_attempts ORDER BY created_at")).rows;
    expect(att.map((a) => a.ip_hash)).toEqual([null, "x2"]);
    await db.query("TRUNCATE payments, reports, analysis_attempts, report_log CASCADE");
  });
});
