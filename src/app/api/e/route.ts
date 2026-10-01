import { CLIENT_KINDS, recordEvent, shouldCount, type FunnelKind } from "@/lib/funnel";

// Mesure d'audience sans cookie ni adresse IP : le navigateur signale une étape (liste fermée), le serveur ajoute une ligne
// anonyme. Rien d'autre n'est lu ni conservé. Répond toujours 204 (on ne révèle pas si l'événement a été compté).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (!shouldCount(request.headers)) return done;
  let kind: unknown;
  try {
    kind = (JSON.parse((await request.text()).slice(0, 200)) as { k?: unknown }).k;
  } catch {
    return done;
  }
  if (typeof kind === "string" && (CLIENT_KINDS as readonly string[]).includes(kind)) await recordEvent(kind as FunnelKind);
  return done;
}
