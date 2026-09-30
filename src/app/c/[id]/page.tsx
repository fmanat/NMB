import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { getCard } from "@/lib/share";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return { title: "Carte introuvable", robots: { index: false } };
  const title = `Rapport clinique n° ${card.dossier}`;
  const description = `${card.basis === "declared" ? "Valeurs déclarées" : "Analyse de photo"} · ${SITE.name}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [{ url: `/c/${id}/og`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [`/c/${id}/og`] },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) notFound();
  return (
    <div className="mx-auto max-w-xl px-4 py-12 space-y-6">
      <div className="panel p-6 text-center space-y-3">
        <p className="num text-xs text-accent tracking-widest">{`RAPPORT CLINIQUE N° ${card.dossier}`}</p>
        <p className="text-xs text-muted">{card.basis === "declared" ? "Valeurs déclarées" : "Analyse de photo"}</p>
        <p className="text-sm text-muted">Score</p>
        <p className="num text-7xl text-accent leading-none">
          {card.score}
          <span className="text-2xl text-muted"> / 100</span>
        </p>
        {(card.percentiles.length > 0 || card.landmark) && (
          <ul className="inline-block text-left text-sm space-y-1 pt-2">
            {card.percentiles.map((p) => (
              <li key={p.label} className="flex justify-between gap-8">
                <span className="text-muted">{p.label}</span>
                <span className="num text-accent-2">top {p.topPct} %</span>
              </li>
            ))}
            {card.landmark && (
              <li className="flex justify-between gap-8">
                <span className="text-muted">{card.landmark.label}</span>
                <span className="num text-accent-2">{card.landmark.times.toLocaleString("fr-FR")} × moi</span>
              </li>
            )}
          </ul>
        )}
        <p className="num text-xs text-muted pt-2">{SITE.domain}</p>
      </div>

      <p className="text-xs text-muted">
        Le score est une note de présentation calibrée de façon indulgente, pas un percentile.{" "}
        <Link href="/methode" className="underline">Voir la méthode</Link>.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href="/analyse" className="btn-primary">Faire ma propre analyse</Link>
        <a href={`/c/${id}/story`} download={`bitometre-${card.dossier}-story.png`} className="panel px-4 py-2 text-sm hover:border-accent">Image 1080 × 1920</a>
        <a href={`/c/${id}/og`} download={`bitometre-${card.dossier}.png`} className="panel px-4 py-2 text-sm hover:border-accent">Image 1200 × 630</a>
      </div>
    </div>
  );
}
