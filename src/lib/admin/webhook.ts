import { createHmac } from "node:crypto";
import { WEBHOOK } from "@/config/site";
import { pool } from "../db";

export const SCORE_BUCKETS = [
  { label: "40-59", min: 0, max: 59 },
  { label: "60-69", min: 60, max: 69 },
  { label: "70-79", min: 70, max: 79 },
  { label: "80-89", min: 80, max: 89 },
  { label: "90-98", min: 90, max: 100 },
] as const;

type Count = { lancees: number; payees: number };

/** Agrégats d'une journée. Aucune donnée individuelle : ni identifiant, ni adresse IP, ni image, ni mesure. */
export type DailyAggregate = {
  version: 1;
  date: string; // AAAA-MM-JJ, fuseau Europe/Paris
  generated_at: string;
  analyses: { A: Count; B: Count; C: Count };
  photo: {
    rapports_payes: number;
    /** Masqués (null) si le groupe compte moins de WEBHOOK.minGroup rapports : un petit groupe pourrait identifier quelqu'un. */
    score_moyen: number | null;
    repartition_scores: Record<string, number | "<5"> | null;
  };
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** La veille, en fuseau Europe/Paris. */
export async function yesterdayParis(): Promise<string> {
  const { rows } = await pool().query("SELECT ((now() AT TIME ZONE 'Europe/Paris')::date - 1)::text AS d");
  return rows[0].d;
}

export async function buildDailyAggregate(day: string): Promise<DailyAggregate> {
  if (!DAY.test(day)) throw new Error(`Date invalide : ${day} (format attendu AAAA-MM-JJ).`);
  const p = pool();
  const minGroup = WEBHOOK.minGroup;

  const analyses: DailyAggregate["analyses"] = { A: { lancees: 0, payees: 0 }, B: { lancees: 0, payees: 0 }, C: { lancees: 0, payees: 0 } };
  // Formule A : un rapport créé = une analyse lancée. Formules photo : une tentative d'envoi = une analyse lancée.
  const a = await p.query("SELECT count(*)::int AS n FROM report_log WHERE formula = 'A' AND (created_at AT TIME ZONE 'Europe/Paris')::date = $1::date", [day]);
  analyses.A.lancees = a.rows[0].n;
  const att = await p.query(
    "SELECT formula, count(*)::int AS n FROM analysis_attempts WHERE (created_at AT TIME ZONE 'Europe/Paris')::date = $1::date GROUP BY formula",
    [day],
  );
  for (const r of att.rows as { formula: "B" | "C"; n: number }[]) analyses[r.formula].lancees = r.n;

  const paid = await p.query(
    `SELECT formula, count(*)::int AS n, COALESCE(avg(score), 0)::float AS avg,
            json_agg(score) AS scores
       FROM report_log WHERE (paid_at AT TIME ZONE 'Europe/Paris')::date = $1::date GROUP BY formula`,
    [day],
  );
  const photoScores: number[] = [];
  for (const r of paid.rows as { formula: "A" | "B" | "C"; n: number; scores: number[] }[]) {
    analyses[r.formula].payees = r.n;
    if (r.formula !== "A") photoScores.push(...r.scores);
  }

  const total = photoScores.length;
  let scoreMoyen: number | null = null;
  let repartition: DailyAggregate["photo"]["repartition_scores"] = null;
  if (total >= minGroup) {
    scoreMoyen = Math.round((photoScores.reduce((s, x) => s + x, 0) / total) * 10) / 10;
    repartition = {};
    for (const b of SCORE_BUCKETS) {
      const n = photoScores.filter((x) => x >= b.min && x <= b.max).length;
      repartition[b.label] = n > 0 && n < minGroup ? "<5" : n;
    }
  }

  return { version: 1, date: day, generated_at: new Date().toISOString(), analyses, photo: { rapports_payes: total, score_moyen: scoreMoyen, repartition_scores: repartition } };
}

export type SendResult =
  | { status: "skipped_no_url" }
  | { status: "invalid_url"; reason: string }
  | { status: "already_sent"; day: string }
  | { status: "sent"; day: string; httpStatus: number }
  | { status: "failed"; day: string; reason: string };

/** http n'est toléré que vers la machine locale ; partout ailleurs, https obligatoire. */
export function checkWebhookUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "adresse illisible" };
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "https:" || (url.protocol === "http:" && local)) return { ok: true, url };
  return { ok: false, reason: "https obligatoire (http n'est accepté que vers localhost)" };
}

export function signPayload(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Envoie les agrégats de la veille (ou du jour donné) à l'adresse configurée, une seule fois par jour.
 * Jamais d'envoi en temps réel : à lancer une fois par jour (voir scripts/stats-webhook.mts).
 */
export async function sendDailyWebhook(
  opts: { day?: string; url?: string; secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<SendResult> {
  const rawUrl = opts.url ?? process.env.STATS_WEBHOOK_URL;
  if (!rawUrl) return { status: "skipped_no_url" };
  const checked = checkWebhookUrl(rawUrl);
  if (!checked.ok) return { status: "invalid_url", reason: checked.reason };

  const day = opts.day ?? (await yesterdayParis());
  const done = await pool().query("SELECT 1 FROM webhook_deliveries WHERE day = $1::date", [day]);
  if (done.rows.length > 0) return { status: "already_sent", day };

  const body = JSON.stringify(await buildDailyAggregate(day));
  const headers: Record<string, string> = { "content-type": "application/json" };
  const secret = opts.secret ?? process.env.STATS_WEBHOOK_SECRET;
  if (secret) headers["x-bitometre-signature"] = signPayload(body, secret);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), WEBHOOK.timeoutMs);
  try {
    const res = await (opts.fetchImpl ?? fetch)(checked.url, { method: "POST", headers, body, signal: ctl.signal, redirect: "error" });
    if (!res.ok) return { status: "failed", day, reason: `réponse HTTP ${res.status}` };
    await pool().query("INSERT INTO webhook_deliveries (day, status) VALUES ($1::date, $2) ON CONFLICT (day) DO NOTHING", [day, res.status]);
    return { status: "sent", day, httpStatus: res.status };
  } catch (e) {
    return { status: "failed", day, reason: (e as Error).name === "AbortError" ? "délai dépassé" : (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
