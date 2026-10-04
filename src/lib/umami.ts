/**
 * Mesure d'audience Umami Cloud (région Europe), en plus du compteur interne (/api/e). Décision du propriétaire du 04/10/2026.
 *
 * Active seulement si UMAMI_WEBSITE_ID est renseignée (identifiant du site dans Umami, non secret). Réglages du script
 * (documentation : https://docs.umami.is/docs/tracker-configuration) :
 *  - data-do-not-track : pas d'envoi si le navigateur envoie Do Not Track ; Global Privacy Control et pages d'administration :
 *    envoi annulé par umamiBeforeSend ;
 *  - data-exclude-search, data-exclude-hash : ni paramètres ni ancre dans l'adresse envoyée ;
 *  - data-before-send : les liens privés (rapport, carte, défi, paiement) sont masqués dans l'adresse, le site d'origine et le titre.
 * Le script appelle https://cloud.umami.is (script) et https://gateway.umami.is (envoi) : autorisés dans la CSP (next.config.ts).
 */

export const UMAMI_SCRIPT = "https://cloud.umami.is/script.js";
export const UMAMI_ORIGINS = ["https://cloud.umami.is", "https://gateway.umami.is"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function umamiWebsiteId(env: Record<string, string | undefined> = process.env): string | null {
  const id = (env.UMAMI_WEBSITE_ID ?? "").trim();
  return UUID.test(id) ? id : null;
}

/** Nom de la fonction appelée par le script Umami avant chaque envoi (définie dans la page par un script en ligne). */
export const UMAMI_BEFORE_SEND = "bmUmamiBeforeSend";

/**
 * Exécutée dans le navigateur (sérialisée telle quelle dans la page : elle ne doit dépendre de rien d'extérieur).
 * Renvoie la charge utile masquée, ou null pour annuler l'envoi.
 */
export function umamiBeforeSend(
  _type: string,
  payload: { url?: string; referrer?: string; title?: string } & Record<string, unknown>,
  ctx?: { path: string; gpc: boolean },
) {
  const path = ctx ? ctx.path : window.location.pathname;
  const gpc = ctx ? ctx.gpc : (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  if (gpc || /^\/admin(\/|$)/.test(path)) return null;
  const mask = (u: unknown) =>
    typeof u === "string"
      ? u
          .replace(/^((?:https?:\/\/[^/]+)?)\/(r|c|defi)\/[^/?#]+/, "$1/$2/[id]")
          .replace(/^((?:https?:\/\/[^/]+)?)\/paiement\/(?!retour(?:[/?#]|$))[^/?#]+/, "$1/paiement/[id]")
      : u;
  const out = { ...payload, url: mask(payload.url) as string | undefined, referrer: mask(payload.referrer) as string | undefined };
  if (/^\/(r|c|defi|paiement)\/./.test(path) && !/^\/paiement\/retour/.test(path)) out.title = "Page privée";
  return out;
}
