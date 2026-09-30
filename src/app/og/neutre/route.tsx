import { neutralImage } from "@/lib/cardImage";

// Image Open Graph des pages privées (rapport, paiement) : volontairement neutre, sans aucun score.
export async function GET() {
  return neutralImage();
}
