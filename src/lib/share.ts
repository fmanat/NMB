import { createHash, randomBytes } from "node:crypto";
import { LANDMARKS } from "@/config/site";
import { pool } from "./db";
import { getReport } from "./repo";
import type { ReportResults } from "./report";

export class ShareError extends Error {}

export type CardContent = {
  dossier: number;
  score: number;
  /** « declared » : valeurs déclarées (formule A) ; « photo » : estimées à partir d'une photo (B, C). */
  basis: "declared" | "photo";
  percentiles: { label: "Longueur" | "Circonférence"; topPct: number }[];
  landmark: { label: string; times: number } | null;
};

export type CardOptions = {
  mode: "score" | "percentiles" | "landmark";
  percentiles?: ("length" | "girth")[];
  landmark?: string;
};

export const MAX_CARDS_PER_REPORT = 10;

/** « Top X % » à partir d'un percentile, arrondi à l'entier supérieur (jamais flatté), au minimum 1. */
export function topPercent(percentile: number): number {
  return Math.max(1, Math.ceil(100 - percentile));
}

/** Numéro de dossier à 4 chiffres, stable pour un rapport donné (purement décoratif). */
export function dossierNumber(reportId: string): number {
  const n = parseInt(createHash("sha256").update(reportId).digest("hex").slice(0, 8), 16);
  return (n % 9000) + 1000;
}

/**
 * Construit le contenu d'une carte : score seul par défaut ; en option jusqu'à deux percentiles
 * OU une mesure de référence, jamais les deux. Rien d'autre du rapport n'est copié.
 */
export function buildCardContent(results: ReportResults, reportId: string, options: CardOptions): CardContent {
  const content: CardContent = {
    dossier: dossierNumber(reportId),
    score: results.score,
    basis: results.formula === "A" ? "declared" : "photo",
    percentiles: [],
    landmark: null,
  };
  if (options.mode === "percentiles") {
    const wanted = [...new Set(options.percentiles ?? [])];
    if (wanted.length === 0 || wanted.length > 2) throw new ShareError("Choisissez un ou deux percentiles.");
    for (const w of wanted) {
      if (w === "length") content.percentiles.push({ label: "Longueur", topPct: topPercent(results.length.percentile) });
      else if (w === "girth") content.percentiles.push({ label: "Circonférence", topPct: topPercent(results.girth.percentile) });
      else throw new ShareError("Option inconnue.");
    }
  } else if (options.mode === "landmark") {
    const item = results.landmarks.find((l) => l.label === options.landmark);
    if (!item || !LANDMARKS.some((l) => l.label === options.landmark)) throw new ShareError("Mesure de référence inconnue.");
    content.landmark = { label: item.label, times: item.times };
  } else if (options.mode !== "score") {
    throw new ShareError("Option inconnue.");
  }
  return content;
}

export async function createCard(reportId: string, options: CardOptions): Promise<string> {
  const report = await getReport(reportId);
  if (!report) throw new ShareError("Rapport introuvable.");
  if (!report.paid) throw new ShareError("Débloquez d'abord votre rapport.");
  const { rows } = await pool().query("SELECT count(*)::int AS n FROM cards WHERE report_id = $1", [reportId]);
  if (rows[0].n >= MAX_CARDS_PER_REPORT) throw new ShareError(`Limite de ${MAX_CARDS_PER_REPORT} cartes par rapport atteinte.`);
  const content = buildCardContent(report.results, reportId, options);
  const id = randomBytes(12).toString("base64url"); // 16 caractères
  await pool().query("INSERT INTO cards (id, report_id, content) VALUES ($1, $2, $3)", [id, reportId, content]);
  return id;
}

/** Lecture publique d'une carte : uniquement l'instantané choisi, jamais le rapport. */
export async function getCard(id: string): Promise<CardContent | null> {
  if (id.length < 16 || id.length > 64) return null;
  const { rows } = await pool().query("SELECT content FROM cards WHERE id = $1", [id]);
  return rows[0]?.content ?? null;
}

export async function listCards(reportId: string): Promise<{ id: string; content: CardContent; created_at: Date }[]> {
  const { rows } = await pool().query("SELECT id, content, created_at FROM cards WHERE report_id = $1 ORDER BY created_at DESC", [reportId]);
  return rows;
}

export async function deleteCard(reportId: string, cardId: string): Promise<void> {
  await pool().query("DELETE FROM cards WHERE id = $1 AND report_id = $2", [cardId, reportId]);
}
