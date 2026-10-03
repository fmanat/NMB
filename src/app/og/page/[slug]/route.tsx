import { pageImage, pageImageContent, pageImageSlugs } from "@/lib/pageImage";

// Image de partage d'une page publique (titre et chiffre clé), générée à la construction du site.
export const dynamicParams = false;

export function generateStaticParams() {
  return pageImageSlugs().map((slug) => ({ slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = pageImageContent(slug);
  if (!content) return new Response("Introuvable", { status: 404 });
  return pageImage(content);
}
