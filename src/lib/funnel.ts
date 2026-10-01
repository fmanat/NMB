// Entonnoir de conversion : événements ANONYMES, sans cookie, sans adresse IP, sans user-agent stocké.
// Ce sont des comptages d'événements : un même visiteur peut en produire plusieurs, donc les taux de passage sont des ordres de grandeur.
import { pool } from "./db";

/** Événements écrits dans funnel_events. Les défis (créé, relevé) restent dans stat_events ; le paiement se lit dans payments. */
export const FUNNEL_KINDS = ["home_view", "questionnaire_start", "questionnaire_done", "report_view", "card_created", "locked_preview"] as const;
export type FunnelKind = (typeof FUNNEL_KINDS)[number];

/** Seuls ces événements peuvent être envoyés par le navigateur ; les autres sont écrits par le serveur à l'action réelle. */
export const CLIENT_KINDS: readonly FunnelKind[] = ["home_view", "questionnaire_start", "report_view", "locked_preview"];

const BOT_UA = /bot|crawl|spider|slurp|lighthouse|preview|facebookexternalhit|curl|wget|python-requests|httpclient/i;

/** Ne compte ni les robots, ni les visiteurs qui demandent de ne pas être suivis (Do Not Track, Global Privacy Control). */
export function shouldCount(h: { get(name: string): string | null }): boolean {
  if (h.get("dnt") === "1" || h.get("sec-gpc") === "1") return false;
  const ua = h.get("user-agent") ?? "";
  return ua !== "" && !BOT_UA.test(ua);
}

/** Écrit un événement. Ne lève jamais d'erreur : la mesure ne doit jamais casser un parcours. */
export async function recordEvent(kind: FunnelKind): Promise<void> {
  try {
    await pool().query("INSERT INTO funnel_events (kind) VALUES ($1)", [kind]);
  } catch (e) {
    console.error("funnel: événement non enregistré", kind, (e as Error).message);
  }
}

export type StepKey =
  | "home_view" | "questionnaire_start" | "questionnaire_done" | "report_view" | "card_created" | "challenge_created" | "challenge_taken"
  | "locked_preview" | "checkout_started" | "paid";

export type StepDef = { key: StepKey; label: string; parent: StepKey | null; paidOnly?: boolean };

/** Étapes dans l'ordre d'affichage. `parent` : l'étape dont le taux de passage est calculé. */
export const STEPS: StepDef[] = [
  { key: "home_view", label: "Visite de l'accueil", parent: null },
  { key: "questionnaire_start", label: "Début du questionnaire", parent: "home_view" },
  { key: "questionnaire_done", label: "Questionnaire terminé", parent: "questionnaire_start" },
  { key: "report_view", label: "Rapport affiché", parent: "questionnaire_done" },
  { key: "card_created", label: "Carte de partage créée", parent: "report_view" },
  { key: "challenge_created", label: "Défi créé", parent: "report_view" },
  { key: "challenge_taken", label: "Défi relevé", parent: "challenge_created" },
  { key: "locked_preview", label: "Aperçu verrouillé affiché (version payante)", parent: "questionnaire_done", paidOnly: true },
  { key: "checkout_started", label: "Paiement lancé (version payante)", parent: "locked_preview", paidOnly: true },
  { key: "paid", label: "Paiement réussi (version payante)", parent: "checkout_started", paidOnly: true },
];

export type FunnelRow = StepDef & { count: number; rateFromParent: number | null; rateFromTop: number | null };

/** Taux de passage : étape / étape précédente de sa chaîne, et étape / visite de l'accueil. null si le dénominateur est nul. */
export function computeFunnel(counts: Record<StepKey, number>): FunnelRow[] {
  const ratio = (n: number, d: number | undefined) => (d && d > 0 ? n / d : null);
  return STEPS.map((s) => ({
    ...s,
    count: counts[s.key] ?? 0,
    rateFromParent: s.parent ? ratio(counts[s.key] ?? 0, counts[s.parent]) : null,
    rateFromTop: s.parent ? ratio(counts[s.key] ?? 0, counts.home_view) : null,
  }));
}

/** Comptage de chaque étape sur une période (jours glissants ; null = depuis le début). */
export async function funnelCounts(days: number | null): Promise<Record<StepKey, number>> {
  const since = days === null ? null : new Date(Date.now() - days * 86_400_000);
  const p = pool();
  const counts = Object.fromEntries(STEPS.map((s) => [s.key, 0])) as Record<StepKey, number>;
  const ev = await p.query("SELECT kind, count(*)::int AS n FROM funnel_events WHERE ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY kind", [since]);
  for (const r of ev.rows as { kind: FunnelKind; n: number }[]) counts[r.kind] = r.n;
  const ch = await p.query("SELECT kind, count(*)::int AS n FROM stat_events WHERE ($1::timestamptz IS NULL OR created_at >= $1) GROUP BY kind", [since]);
  for (const r of ch.rows as { kind: string; n: number }[]) {
    if (r.kind === "challenge_created" || r.kind === "challenge_taken") counts[r.kind] = r.n;
  }
  // Version payante : paiements lancés (lignes créées) et réussis (confirmés). La bêta gratuite ne crée aucune ligne de paiement.
  const pay = await p.query(
    `SELECT count(*) FILTER (WHERE $1::timestamptz IS NULL OR created_at >= $1)::int AS started,
            count(*) FILTER (WHERE status = 'succeeded' AND ($1::timestamptz IS NULL OR confirmed_at >= $1))::int AS paid
       FROM payments`,
    [since],
  );
  counts.checkout_started = pay.rows[0].started;
  counts.paid = pay.rows[0].paid;
  return counts;
}
