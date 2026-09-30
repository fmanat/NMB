import { cardImage } from "@/lib/cardImage";
import { getCard } from "@/lib/share";

// Image Open Graph (1200 × 630) d'une carte de partage.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const card = await getCard(id);
  if (!card) return new Response("Introuvable", { status: 404 });
  return cardImage(card, "og");
}
