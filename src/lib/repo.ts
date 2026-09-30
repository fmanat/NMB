import { createHmac, randomBytes } from "node:crypto";
import { FORMULAS, RATE_LIMIT, UNPAID_TTL_HOURS, type FormulaId } from "@/config/site";
import { pool } from "./db";
import type { QuestionnaireInput, ReportResults } from "./report";

export type ReportRow = {
  id: string;
  formula: FormulaId;
  input: QuestionnaireInput;
  results: ReportResults;
  score: number;
  paid: boolean;
  paid_at: Date | null;
  waiver_accepted_at: Date | null;
  created_at: Date;
};

/** Identifiant aléatoire de 43 caractères (256 bits), impossible à deviner. */
export function newReportId(): string {
  return randomBytes(32).toString("base64url");
}

export function hashIp(ip: string): string {
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) throw new Error("IP_HASH_SECRET manquant");
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function countRecentByIp(ipHash: string): Promise<number> {
  const { rows } = await pool().query(
    "SELECT count(*)::int AS n FROM reports WHERE ip_hash = $1 AND created_at > now() - make_interval(hours => $2)",
    [ipHash, RATE_LIMIT.windowHours],
  );
  return rows[0].n;
}

export async function createReport(args: {
  formula: FormulaId;
  input: QuestionnaireInput;
  results: ReportResults;
  ipHash: string | null;
}): Promise<string> {
  const id = newReportId();
  await pool().query(
    "INSERT INTO reports (id, formula, input, results, score, ip_hash) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, args.formula, args.input, args.results, args.results.score, args.ipHash],
  );
  return id;
}

export async function getReport(id: string): Promise<ReportRow | null> {
  if (id.length < 32 || id.length > 128) return null;
  const { rows } = await pool().query("SELECT * FROM reports WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function deleteReport(id: string): Promise<void> {
  await pool().query("DELETE FROM reports WHERE id = $1", [id]);
}

export async function setWaiverAccepted(id: string): Promise<void> {
  await pool().query("UPDATE reports SET waiver_accepted_at = now() WHERE id = $1 AND waiver_accepted_at IS NULL", [id]);
}

export async function recordPayment(args: {
  reportId: string;
  provider: string;
  providerRef: string;
  amountCents: number;
}): Promise<void> {
  await pool().query(
    "INSERT INTO payments (report_id, provider, provider_ref, amount_cents) VALUES ($1, $2, $3, $4)",
    [args.reportId, args.provider, args.providerRef, args.amountCents],
  );
}

export function priceCents(formula: FormulaId): number {
  return Math.round(FORMULAS[formula].priceEur * 100);
}

/** Efface les rapports non payés trop anciens et les adresses IP hachées de plus de 24 h. */
export async function purgeExpired(): Promise<{ reports: number; ips: number }> {
  const del = await pool().query(
    "DELETE FROM reports WHERE paid = false AND created_at < now() - make_interval(hours => $1)",
    [UNPAID_TTL_HOURS],
  );
  const ips = await pool().query(
    "UPDATE reports SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - make_interval(hours => $1)",
    [RATE_LIMIT.windowHours],
  );
  return { reports: del.rowCount ?? 0, ips: ips.rowCount ?? 0 };
}

export type GlobalStatsRow = { totalAnalyses: number; averageScore: number; bestScoreThisWeek: number };

/** Statistiques réelles : uniquement les rapports payés (délivrés). Rien n'est arrondi à la hausse. */
export async function globalStats(): Promise<GlobalStatsRow> {
  const { rows } = await pool().query(
    `SELECT count(*)::int AS total,
            COALESCE(avg(score), 0)::float AS average,
            COALESCE(max(score) FILTER (WHERE paid_at > now() - interval '7 days'), 0)::int AS best_week
       FROM reports WHERE paid = true`,
  );
  return { totalAnalyses: rows[0].total, averageScore: rows[0].average, bestScoreThisWeek: rows[0].best_week };
}
