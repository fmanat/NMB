import { handleWebhook } from "@/lib/payments/confirm";
import { plisioConfigured, plisioProvider } from "@/lib/payments/plisio";

// Notifications de Plisio (factures en cryptomonnaie) : JSON envoyé en POST sur /api/paiement/plisio?json=true (voir src/lib/payments/plisio.ts).
//  - désactivée (404) tant que PLISIO_SECRET_KEY est vide ;
//  - signature invalide ou corps illisible : 422 (comme l'exemple Node de la documentation de Plisio), rien n'est lu en base ;
//  - notification authentique, avec ou sans effet (déjà traitée, statut intermédiaire, expirée, montant incorrect, commande inconnue) :
//    200, pour qu'elle ne soit pas renvoyée en boucle ; le motif est journalisé ;
//  - erreur technique (base indisponible) : 500, pour que Plisio la renvoie.
// Seule la notification signée débloque un rapport ; le retour du navigateur ne débloque jamais rien.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!plisioConfigured()) return new Response("Not found", { status: 404 });
  const raw = await req.text();
  try {
    plisioProvider.verifyWebhook(raw, null); // contrôle de la signature avant tout accès à la base
  } catch {
    return Response.json({ received: false }, { status: 422 });
  }
  try {
    const result = await handleWebhook(raw, null, plisioProvider);
    if (!result.ok) console.warn("paiement Plisio : notification sans effet :", result.reason);
    return Response.json({ received: true });
  } catch (e) {
    console.error("paiement Plisio : erreur technique pendant le traitement d'une notification", (e as Error).message);
    return Response.json({ received: false }, { status: 500 });
  }
}
