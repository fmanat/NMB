import { handleWebhook } from "@/lib/payments/confirm";
import { getPaymentProvider } from "@/lib/payments";

// Point d'entrée des notifications du prestataire de paiement. Seule source de déblocage (et de reverrouillage).
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const result = await handleWebhook(raw, req.headers.get("x-signature") ?? req.headers.get("stripe-signature"));
    return Response.json({ received: true, ...result }, { status: result.ok ? 200 : 202 });
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }
}

/**
 * Verotel envoie ses notifications (« postbacks ») par une requête GET dont les paramètres sont dans l'adresse, et attend le texte « OK »
 * (exemple officiel : examples/postback.php). Signature invalide : erreur 500 (comme l'exemple officiel). Notification authentique mais sans
 * effet (événement inutile, paiement inconnu, montant incorrect) : « OK » quand même, pour qu'elle ne soit pas renvoyée en boucle ;
 * le détail est dans le journal du serveur. Erreur technique (base indisponible) : 500, pour qu'elle soit renvoyée.
 * Réservé à ce prestataire : sinon 404.
 */
export async function GET(req: Request) {
  const provider = process.env.PAYMENT_PROVIDER;
  if (provider !== "verotel") return new Response("Not found", { status: 404 });
  const query = new URL(req.url).search;
  try {
    getPaymentProvider().verifyWebhook(query, null); // contrôle de signature avant tout accès à la base
  } catch {
    return new Response("ERROR - Invalid signature!", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
  try {
    const result = await handleWebhook(query, null);
    if (!result.ok) console.warn("paiement : notification sans effet :", result.reason);
    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (e) {
    console.error("paiement : erreur technique pendant le traitement d'une notification", (e as Error).message);
    return new Response("ERROR", { status: 500, headers: { "Content-Type": "text/plain" } });
  }
}
