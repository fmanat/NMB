import { createHash, createHmac, randomBytes } from "node:crypto";
import { FORMULAS, RATE_LIMIT, UNPAID_TTL_HOURS, type FormulaId } from "@/config/site";
import { pool } from "./db";
import { BETA } from "./mode";
import type { QuestionnaireInput, ReportResults } from "./report";

/** Un rapport reverrouillé après remboursement ou contestation est conservé ce nombre de jours (au lieu de 24 h). */
export const RELOCKED_TTL_DAYS = 30;

export type ReportRow = {
  id: string;
  formula: FormulaId;
  input: QuestionnaireInput;
  results: ReportResults;
  score: number;
  paid: boolean;
  paid_at: Date | null;
  free_beta: boolean;
  relocked_at: Date | null;
  waiver_accepted_at: Date | null;
  created_at: Date;
};

/** Clé du journal anonyme : empreinte SHA-256 de l'identifiant privé (l'identifiant lui-même n'y est pas conservé). */
export function reportKey(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

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
  /** Bêta gratuite : le rapport est débloqué sans paiement (et exclu des statistiques de conversion). */
  freeBeta?: boolean;
  /** Faux pour un rapport photo PARTIEL (aucune mesure) : il n'entre pas dans le journal anonyme des scores. */
  log?: boolean;
}): Promise<string> {
  const id = newReportId();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const free = args.freeBeta === true;
    await client.query(
      "INSERT INTO reports (id, formula, input, results, score, ip_hash, paid, free_beta) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)",
      [id, args.formula, args.input, args.results, args.results.score, args.ipHash, free],
    );
    // Journal anonyme durable : survit à la suppression du rapport et à la purge des rapports non payés.
    // paid_at reste vide pour un rapport de la bêta gratuite : il n'a rien payé et ne compte ni dans la conversion ni dans le bandeau.
    if (args.log !== false) {
      await client.query("INSERT INTO report_log (key, formula, score, created_at, free_beta) VALUES ($1, $2, $3, now(), $4)", [
        reportKey(id),
        args.formula,
        args.results.score,
        free,
      ]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
  formula: FormulaId;
  provider: string;
  providerRef: string;
  amountCents: number;
}): Promise<void> {
  await pool().query(
    "INSERT INTO payments (report_id, formula, provider, provider_ref, amount_cents) VALUES ($1, $2, $3, $4, $5)",
    [args.reportId, args.formula, args.provider, args.providerRef, args.amountCents],
  );
}

export function priceCents(formula: FormulaId): number {
  return Math.round(FORMULAS[formula].priceEur * 100);
}

/** Efface les rapports non payés trop anciens, les rapports de la bêta gratuite de plus de BETA.reportTtlDays jours et les IP hachées de plus de 24 h. */
export async function purgeExpired(): Promise<{ reports: number; ips: number }> {
  const del = await pool().query(
    "DELETE FROM reports WHERE (paid = false AND relocked_at IS NULL AND created_at < now() - make_interval(hours => $1))" +
      " OR (paid = false AND relocked_at < now() - make_interval(days => $3))" + // rapport reverrouillé (remboursement, contestation) : 30 jours
      " OR (free_beta AND created_at < now() - make_interval(days => $2))",
    [UNPAID_TTL_HOURS, BETA.reportTtlDays, RELOCKED_TTL_DAYS],
  );
  const ips = await pool().query(
    "UPDATE reports SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - make_interval(hours => $1)",
    [RATE_LIMIT.windowHours],
  );
  await pool().query(
    "UPDATE analysis_attempts SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - make_interval(hours => $1)",
    [RATE_LIMIT.windowHours],
  );
  return { reports: del.rowCount ?? 0, ips: ips.rowCount ?? 0 };
}

export type AnalysisStatsRow = { count: number; averageScore: number };

/**
 * Agrégats des analyses terminées, pour le bandeau défilant de l'accueil (aucune donnée individuelle : un nombre et une moyenne).
 * Définition retenue (la plus prudente) : lignes du journal anonyme dont le rapport a été débloqué, c'est-à-dire délivré :
 *  - bêta gratuite (`free_beta`), ou rapport payé (`paid_at` renseigné ; un remboursement le remet à vide) ;
 *  - tous protocoles confondus ; un rapport créé mais jamais débloqué (non payé, purgé après 24 h) n'est PAS compté.
 * Le journal survit à la suppression et à la purge des rapports : une analyse réalisée reste comptée, le chiffre ne baisse jamais
 * parce qu'un visiteur efface son rapport.
 */
export async function completedAnalysisStats(): Promise<AnalysisStatsRow> {
  const { rows } = await pool().query(
    `SELECT count(*)::int AS n, COALESCE(avg(score), 0)::float AS average
       FROM report_log WHERE free_beta OR paid_at IS NOT NULL`,
  );
  return { count: rows[0].n, averageScore: rows[0].average };
}


// ---------- Tentatives d'analyse (formules photo) ----------

export async function countAttemptsByIp(ipHash: string): Promise<number> {
  const { rows } = await pool().query(
    "SELECT count(*)::int AS n FROM analysis_attempts WHERE ip_hash = $1 AND created_at > now() - make_interval(hours => $2)",
    [ipHash, RATE_LIMIT.windowHours],
  );
  return rows[0].n;
}

export async function startAttempt(ipHash: string | null, formula: "B" | "C"): Promise<number> {
  const { rows } = await pool().query("INSERT INTO analysis_attempts (ip_hash, formula) VALUES ($1, $2) RETURNING id", [ipHash, formula]);
  return Number(rows[0].id);
}

export async function finishAttempt(
  id: number,
  r: { outcome: "ok" | "refused" | "blocked" | "error"; motif?: string; visionMs?: number; tokensIn?: number; tokensOut?: number },
): Promise<void> {
  await pool().query(
    "UPDATE analysis_attempts SET outcome = $2, motif = $3, vision_ms = $4, tokens_in = $5, tokens_out = $6 WHERE id = $1",
    [id, r.outcome, r.motif ?? null, r.visionMs ?? null, r.tokensIn ?? null, r.tokensOut ?? null],
  );
}

export async function addAttemptTokens(id: number, tokensIn: number, tokensOut: number): Promise<void> {
  await pool().query(
    "UPDATE analysis_attempts SET tokens_in = COALESCE(tokens_in, 0) + $2, tokens_out = COALESCE(tokens_out, 0) + $3 WHERE id = $1",
    [id, tokensIn, tokensOut],
  );
}

export async function updateComment(reportId: string, comment: string): Promise<void> {
  await pool().query("UPDATE reports SET results = jsonb_set(results, '{comment}', to_jsonb($2::text)) WHERE id = $1", [reportId, comment]);
}

// ---------- Calibration du moteur photo (photo-report/2) ----------

/** Paire (mesure par la carte, estimation du modèle sans la carte), en centimètres. Aucune autre donnée n'est conservée. */
export type CalibrationPair = { cardLengthCm: number; modelLengthCm: number; cardGirthCm: number; modelGirthCm: number };

export async function saveCalibrationPair(p: CalibrationPair): Promise<void> {
  await pool().query("INSERT INTO calibration_pairs (card_length_cm, model_length_cm, card_girth_cm, model_girth_cm) VALUES ($1, $2, $3, $4)", [
    p.cardLengthCm,
    p.modelLengthCm,
    p.cardGirthCm,
    p.modelGirthCm,
  ]);
}

export async function listCalibrationPairs(): Promise<CalibrationPair[]> {
  const { rows } = await pool().query("SELECT card_length_cm, model_length_cm, card_girth_cm, model_girth_cm FROM calibration_pairs");
  return rows.map((r) => ({ cardLengthCm: r.card_length_cm, modelLengthCm: r.model_length_cm, cardGirthCm: r.card_girth_cm, modelGirthCm: r.model_girth_cm }));
}
