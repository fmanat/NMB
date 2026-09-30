import { cardImage } from "@/lib/cardImage";
import { getCard } from "@/lib/share";

// Format vertical (1080 × 1920) pour les stories.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const card = await getCard(id);
  if (!card) return new Response("Introuvable", { status: 404 });
  return cardImage(card, "story");
}
