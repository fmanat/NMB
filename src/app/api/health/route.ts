// Point de contrôle de santé (hébergeur) : répond tant que l'application tourne. Aucune donnée, aucun accès à la base
// (une panne de base ne doit pas faire redémarrer l'application en boucle).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
