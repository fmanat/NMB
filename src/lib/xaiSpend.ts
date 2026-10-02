import { aiPricing } from "@/config/site";
import { pool } from "./db";

// Plafond de dépense xAI quotidien (bloc 6 de la session de nuit 4).
//  - XAI_DAILY_CAP_USD (défaut 5 $ ; valeur absente ou invalide : défaut ; 0 = aucun appel autorisé) ;
//  - jour = jour civil Europe/Paris ;
//  - AVANT chaque analyse photo, une réservation de ESTIMATED_ANALYSIS_USD est prise de façon atomique (une seule instruction SQL,
//    verrou de ligne) : elle est acceptée seulement si dépensé + réservé + estimation <= plafond. Refusée : « Capacité du jour
//    atteinte », aucun appel au modèle, et la tentative ne compte pas dans la limite par adresse ;
//  - à la fin de l'analyse (succès, refus ou erreur), la réservation est rendue et le coût réel (jetons × tarif) est ajouté.
//  Marge : le plafond ne peut être dépassé que de (coût réel − estimation) par analyse en cours, c'est-à-dire jamais tant que le coût
//  réel reste sous l'estimation (mesuré : environ 0,022 $ par analyse complète pour une estimation de 0,03 $) ; une relance (rare)
//  peut porter une analyse à environ 0,045 $, soit au plus 0,015 $ de dépassement par analyse simultanée.

export const DEFAULT_DAILY_CAP_USD = 5;
/** Coût réservé avant chaque analyse (dollars) : supérieur au coût mesuré d'une analyse complète (voir docs/DECISIONS.md). */
export const ESTIMATED_ANALYSIS_USD = 0.03;

export const toMicros = (usd: number): number => Math.round(usd * 1e6);
export const fromMicros = (micros: number | string | bigint): number => Number(micros) / 1e6;

/** Plafond quotidien en dollars : XAI_DAILY_CAP_USD, ou 5 si la valeur est absente, vide, négative ou non numérique. */
export function dailyCapUsd(env: Record<string, string | undefined> = process.env): number {
  const raw = env.XAI_DAILY_CAP_USD;
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_CAP_USD;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_CAP_USD;
}

const PARIS_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Jour civil à Paris (AAAA-MM-JJ) d'un instant donné. */
export function parisDay(now: Date = new Date()): string {
  return PARIS_DAY.format(now);
}

/** Coût (micro-dollars) d'une consommation de jetons au tarif configuré. */
export function usageCostMicros(u: { tokensIn: number; tokensOut: number }, pricing = aiPricing()): number {
  return Math.round(u.tokensIn * pricing.inPerM + u.tokensOut * pricing.outPerM);
}

export type Reservation = { ok: true; day: string; estimateMicros: number } | { ok: false; day: string };

/** Réservation et règlement de la dépense : interface injectable (les tests unitaires peuvent la remplacer). */
export interface SpendGate {
  reserve(now?: Date): Promise<Reservation>;
  /** Rend la réservation et enregistre le coût réel. `calls = 0` : aucun appel au modèle n'a eu lieu (rien n'est compté). */
  settle(r: Reservation, actual: { costMicros: number; calls: number }): Promise<void>;
}

/** Réservation atomique : acceptée seulement si dépensé + réservé + estimation <= plafond (verrou de ligne PostgreSQL). */
export async function reserveSpend(day: string, estimateMicros: number, capMicros: number): Promise<boolean> {
  if (estimateMicros > capMicros) return false; // couvre aussi le premier enregistrement du jour
  const { rowCount } = await pool().query(
    `INSERT INTO xai_daily_spend (day, reserved_micros) VALUES ($1, $2)
     ON CONFLICT (day) DO UPDATE SET reserved_micros = xai_daily_spend.reserved_micros + EXCLUDED.reserved_micros, updated_at = now()
     WHERE xai_daily_spend.spent_micros + xai_daily_spend.reserved_micros + EXCLUDED.reserved_micros <= $3
     RETURNING day`,
    [day, estimateMicros, capMicros],
  );
  return (rowCount ?? 0) > 0;
}

export async function settleSpend(day: string, estimateMicros: number, actual: { costMicros: number; calls: number }): Promise<void> {
  await pool().query(
    `UPDATE xai_daily_spend
        SET reserved_micros = GREATEST(0, reserved_micros - $2), spent_micros = spent_micros + $3, calls = calls + $4,
            analyses = analyses + $5, updated_at = now()
      WHERE day = $1`,
    [day, estimateMicros, Math.max(0, actual.costMicros), Math.max(0, actual.calls), actual.calls > 0 ? 1 : 0],
  );
}

export const dbSpendGate: SpendGate = {
  async reserve(now = new Date()) {
    const day = parisDay(now);
    const estimateMicros = toMicros(ESTIMATED_ANALYSIS_USD);
    const ok = await reserveSpend(day, estimateMicros, toMicros(dailyCapUsd()));
    return ok ? { ok: true, day, estimateMicros } : { ok: false, day };
  },
  async settle(r, actual) {
    if (!r.ok) return;
    await settleSpend(r.day, r.estimateMicros, actual);
  },
};

export type DaySpend = { day: string; spentUsd: number; reservedUsd: number; calls: number; analyses: number };

/** Dépense des `days` derniers jours civils (Paris), aujourd'hui compris, du plus récent au plus ancien ; jours sans appel à zéro. */
export async function spendHistory(days: number, now = new Date()): Promise<DaySpend[]> {
  const { rows } = await pool().query(
    `SELECT day::text AS day, spent_micros, reserved_micros, calls, analyses FROM xai_daily_spend
      WHERE day > ($1::date - make_interval(days => $2)) AND day <= $1::date`,
    [parisDay(now), days],
  );
  const byDay = new Map<string, DaySpend>();
  for (const r of rows as { day: string; spent_micros: string; reserved_micros: string; calls: number; analyses: number }[]) {
    byDay.set(r.day, { day: r.day, spentUsd: fromMicros(r.spent_micros), reservedUsd: fromMicros(r.reserved_micros), calls: r.calls, analyses: r.analyses });
  }
  // Jours civils en arrière à partir du jour de Paris (arithmétique sur la date seule : insensible aux changements d'heure).
  const [y, m, d] = parisDay(now).split("-").map(Number);
  const out: DaySpend[] = [];
  for (let k = 0; k < days; k++) {
    const day = new Date(Date.UTC(y, m - 1, d - k)).toISOString().slice(0, 10);
    out.push(byDay.get(day) ?? { day, spentUsd: 0, reservedUsd: 0, calls: 0, analyses: 0 });
  }
  return out;
}
