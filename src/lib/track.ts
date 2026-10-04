// Mesure des étapes du parcours, côté navigateur. Deux destinations, aucune nouvelle dépendance :
//  1. Umami (src/lib/umami.ts) : événements personnalisés nommés, sans cookie ; rien si le script n'est pas chargé (pas d'identifiant,
//     Do Not Track, Global Privacy Control, bloqueur) ;
//  2. le compteur interne anonyme (/api/e, table funnel_events) pour les seuls événements de sa liste fermée (CLIENT_KINDS).
// Aucune donnée personnelle, aucune mesure, aucun identifiant de rapport n'est jamais joint à un événement.

/** Noms des événements Umami (entonnoir de la mission de transformation). */
export const TRACK_EVENTS = [
  "landing_view",
  "test_start",
  "test_step_1",
  "test_step_2",
  "test_step_3",
  "test_step_4",
  "test_step_5",
  "test_complete",
  "result_view",
  "analysis_view",
  "analysis_cta_click",
  "purchase_start",
  "purchase_success",
  "share_click",
  "share_download",
  "share_native",
  "share_copy",
  "challenge_click",
  "referral_visit",
] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

/** Événements du compteur interne que le navigateur peut signaler (doit rester un sous-ensemble de CLIENT_KINDS, src/lib/funnel.ts). */
export type BeaconKind = "home_view" | "questionnaire_start" | "report_view" | "locked_preview" | "upsell_click" | "share_click";

type UmamiWindow = Window & { umami?: { track: (name: string) => void } };

/**
 * Envoie un événement nommé à Umami. Le script est chargé en différé : s'il n'est pas encore prêt, nouvel essai quelques fois
 * (au plus environ 3 s), puis abandon silencieux (script absent ou bloqué). Ne lève jamais d'erreur.
 */
export function track(name: TrackEvent, attempt = 0): void {
  try {
    const u = (window as UmamiWindow).umami;
    if (u) u.track(name);
    else if (attempt < 5) setTimeout(() => track(name, attempt + 1), 600);
  } catch {
    // la mesure ne doit jamais casser un parcours
  }
}

/** Signale une étape au compteur interne anonyme (sendBeacon, repli fetch). Ne lève jamais d'erreur. */
export function beacon(kind: BeaconKind): void {
  const body = JSON.stringify({ k: kind });
  try {
    if (!navigator.sendBeacon?.("/api/e", new Blob([body], { type: "application/json" }))) throw new Error("beacon");
  } catch {
    fetch("/api/e", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => {});
  }
}
