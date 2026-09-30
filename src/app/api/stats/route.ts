import { publicStats } from "@/lib/repo";

// Statistiques réelles du bandeau, chargées par le navigateur après l'affichage (les pages restent statiques).
export async function GET() {
  let body: Awaited<ReturnType<typeof publicStats>> = { show: false };
  try {
    body = await publicStats();
  } catch {
    // base indisponible : le bandeau reste masqué
  }
  return Response.json(body, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
