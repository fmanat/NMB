import { lookup } from "node:dns/promises";
import { request } from "node:https";

// Diagnostic réseau de Plisio, exécuté une fois au démarrage quand PLISIO_SECRET_KEY est renseignée (src/instrumentation.ts) :
// résolution DNS de api.plisio.net, puis un appel sans clé (« api_key=diagnostic », qui ne crée rien) en IPv4 et en IPv6 séparément,
// avec leur durée. Journalise seulement des codes et des durées : jamais de clé, jamais de donnée personnelle.

const HOST = "api.plisio.net";
const PATH = "/api/v1/invoices/new?api_key=diagnostic";

function attempt(family: 4 | 6, timeoutMs = 8000): Promise<string> {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const req = request({ host: HOST, path: PATH, family, timeout: timeoutMs, headers: { accept: "application/json" } }, (res) => {
      res.resume();
      res.on("end", () => resolve(`HTTP ${res.statusCode} en ${Date.now() - t0} ms`));
    });
    req.on("timeout", () => req.destroy(new Error("délai dépassé")));
    req.on("error", (e: NodeJS.ErrnoException) => resolve(`échec (${e.code ?? e.message}) en ${Date.now() - t0} ms`));
    req.end();
  });
}

/** Appel du relais (s'il est configuré) avec une fausse clé : Plisio doit répondre 422 à travers lui. */
async function viaRelay(): Promise<string | null> {
  const base = (process.env.PLISIO_API_BASE ?? "").trim().replace(/\/$/, "");
  if (!base) return null;
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}${PATH}`, { headers: { accept: "application/json", "x-relais-secret": (process.env.PLISIO_RELAY_SECRET ?? "").trim() }, signal: AbortSignal.timeout(8000) });
    const body = (await res.json().catch(() => null)) as { data?: { code?: number } } | null;
    return `HTTP ${res.status}${body?.data?.code ? ` (code Plisio ${body.data.code})` : ""} en ${Date.now() - t0} ms`;
  } catch (e) {
    return `échec (${(e as Error).name}) en ${Date.now() - t0} ms`;
  }
}

export async function probePlisio(): Promise<void> {
  let dns = "";
  try {
    dns = (await lookup(HOST, { all: true })).map((a) => `IPv${a.family}`).join(", ");
  } catch (e) {
    dns = `échec (${(e as NodeJS.ErrnoException).code ?? "?"})`;
  }
  const [v4, v6, relay] = await Promise.all([attempt(4), attempt(6), viaRelay()]);
  console.warn(JSON.stringify({ event: "plisio_probe", dns, ipv4: v4, ipv6: v6, relais: relay ?? "non configuré" }));
}
