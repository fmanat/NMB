import { handleWebhook } from "@/lib/payments/confirm";

// Point d'entrée des notifications du prestataire de paiement. Seule source de déblocage.
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const result = await handleWebhook(raw, req.headers.get("x-signature") ?? req.headers.get("stripe-signature"));
    return Response.json({ received: true, ...result }, { status: result.ok ? 200 : 202 });
  } catch {
    return Response.json({ received: false }, { status: 400 });
  }
}
