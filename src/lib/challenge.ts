import { randomBytes } from "node:crypto";
import { pool } from "./db";
import { getReport } from "./repo";

export class ChallengeError extends Error {}

export const CHALLENGE_COOKIE = "nmb_defi";

export type Side = {
  score: number;
  lengthPercentile: number;
  girthPercentile: number;
  /** « declared » : valeurs déclarées (formule A) ; « photo » : estimées (formules B et C). */
  basis: "declared" | "photo";
};

export type ChallengeState =
  | { status: "none" }
  | { status: "creator_waiting_friend"; challengeId: string }
  | { status: "waiting_payment"; role: "creator" | "friend"; challengeId: string }
  | { status: "withdrawn_self"; role: "creator" | "friend" }
  | { status: "withdrawn_other"; role: "creator" | "friend" }
  | { status: "ready"; role: "creator" | "friend"; challengeId: string; me: Side; other: Side };

/** Crée le lien de défi d'un rapport débloqué. Un seul défi par rapport : le même lien est renvoyé ensuite. */
export async function createChallenge(reportId: string): Promise<string> {
  const report = await getReport(reportId);
  if (!report) throw new ChallengeError("Rapport introuvable.");
  if (!report.paid) throw new ChallengeError("Débloquez d'abord votre rapport.");
  const existing = await pool().query("SELECT id FROM challenges WHERE creator_report_id = $1", [reportId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const id = randomBytes(16).toString("base64url"); // 22 caractères
  await pool().query("INSERT INTO challenges (id, creator_report_id) VALUES ($1, $2) ON CONFLICT (creator_report_id) DO NOTHING", [id, reportId]);
  const { rows } = await pool().query("SELECT id FROM challenges WHERE creator_report_id = $1", [reportId]);
  return rows[0].id;
}

/** Page d'invitation : ne révèle rien sur le créateur, seulement si le défi peut encore être relevé. */
export async function getInvite(challengeId: string): Promise<{ available: boolean } | null> {
  if (challengeId.length < 16 || challengeId.length > 64) return null;
  const { rows } = await pool().query(
    "SELECT friend_report_id, creator_withdrawn FROM challenges WHERE id = $1",
    [challengeId],
  );
  if (!rows[0]) return null;
  return { available: rows[0].friend_report_id === null && !rows[0].creator_withdrawn };
}

/**
 * Associe le rapport de l'ami au défi, une seule fois. Refuse : défi inconnu ou déjà relevé, défi retiré,
 * rapport identique à celui du créateur, rapport déjà engagé dans un autre défi.
 */
export async function attachFriend(challengeId: string, friendReportId: string): Promise<boolean> {
  if (challengeId.length < 16 || challengeId.length > 64) return false;
  try {
    const res = await pool().query(
      `UPDATE challenges SET friend_report_id = $2
        WHERE id = $1 AND friend_report_id IS NULL AND creator_withdrawn = false AND creator_report_id <> $2
          AND EXISTS (SELECT 1 FROM reports WHERE id = $2)`,
      [challengeId, friendReportId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false; // violation d'unicité : ce rapport est déjà ami d'un autre défi
  }
}

/** Retire le rapport de la comparaison (à tout moment). Les deux côtés cessent de voir la comparaison. */
export async function withdraw(reportId: string): Promise<void> {
  await pool().query("UPDATE challenges SET creator_withdrawn = true WHERE creator_report_id = $1", [reportId]);
  await pool().query("UPDATE challenges SET friend_withdrawn = true WHERE friend_report_id = $1", [reportId]);
}

type Row = {
  id: string;
  creator_report_id: string;
  friend_report_id: string | null;
  creator_withdrawn: boolean;
  friend_withdrawn: boolean;
  creator_paid: boolean;
  creator_results: { score: number; length: { percentile: number }; girth: { percentile: number }; formula: string };
  friend_paid: boolean | null;
  friend_results: Row["creator_results"] | null;
};

const side = (r: Row["creator_results"]): Side => ({
  score: r.score,
  lengthPercentile: r.length.percentile,
  girthPercentile: r.girth.percentile,
  basis: r.formula === "A" ? "declared" : "photo",
});

/**
 * État du défi vu par le détenteur d'un rapport (créateur ou ami). Les données de l'autre participant ne sont
 * renvoyées que si les deux rapports sont payés et qu'aucun des deux ne s'est retiré.
 */
export async function getChallengeState(reportId: string): Promise<ChallengeState> {
  const { rows } = await pool().query<Row>(
    `SELECT c.id, c.creator_report_id, c.friend_report_id, c.creator_withdrawn, c.friend_withdrawn,
            cr.paid AS creator_paid, cr.results AS creator_results,
            fr.paid AS friend_paid, fr.results AS friend_results
       FROM challenges c
       JOIN reports cr ON cr.id = c.creator_report_id
       LEFT JOIN reports fr ON fr.id = c.friend_report_id
      WHERE c.creator_report_id = $1 OR c.friend_report_id = $1`,
    [reportId],
  );
  const c = rows[0];
  if (!c) return { status: "none" };
  const role = c.creator_report_id === reportId ? "creator" : "friend";
  const meWithdrawn = role === "creator" ? c.creator_withdrawn : c.friend_withdrawn;
  const otherWithdrawn = role === "creator" ? c.friend_withdrawn : c.creator_withdrawn;

  if (meWithdrawn) return { status: "withdrawn_self", role };
  if (role === "creator" && c.friend_report_id === null) return { status: "creator_waiting_friend", challengeId: c.id };
  if (otherWithdrawn) return { status: "withdrawn_other", role };
  if (!c.creator_paid || !c.friend_paid || !c.friend_results) return { status: "waiting_payment", role, challengeId: c.id };

  const mine = role === "creator" ? c.creator_results : c.friend_results;
  const theirs = role === "creator" ? c.friend_results : c.creator_results;
  return { status: "ready", role, challengeId: c.id, me: side(mine), other: side(theirs) };
}
