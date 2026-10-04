// Relais Cloudflare Worker vers l'API de Plisio (création de facture uniquement).
//
// Pourquoi : api.plisio.net ne répond pas aux connexions venant des serveurs de Railway (diagnostic du 04/10/2026). Le site envoie
// donc ses demandes de facture à ce relais, qui les transmet à Plisio depuis le réseau de Cloudflare.
//
// Sécurité :
//  - seul le chemin /api/v1/invoices/new, en GET, est relayé ; tout le reste répond 404 ;
//  - chaque demande doit porter l'en-tête « x-relais-secret » égal au secret RELAIS_SECRET (réglé dans Cloudflare, et dans Railway sous
//    le nom PLISIO_RELAY_SECRET) ; sinon 403 ;
//  - rien n'est enregistré : l'adresse demandée contient la clé Plisio, elle n'est jamais journalisée ni conservée.
// À coller tel quel dans l'éditeur du Worker (voir docs/PLISIO-RELAIS.md).

const PLISIO = "https://api.plisio.net";
const PATH = "/api/v1/invoices/new";

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const relais = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== PATH) return new Response("Not found", { status: 404 });
    if (!sameSecret(request.headers.get("x-relais-secret"), env.RELAIS_SECRET)) return new Response("Forbidden", { status: 403 });
    const upstream = await fetch(PLISIO + PATH + url.search, { method: "GET", headers: { accept: "application/json" } });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "no-store" },
    });
  },
};

export default relais;
