import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { profileById } from "@/lib/profiles";
import { getCard } from "@/lib/share";
import { ScanButton } from "@/components/ScanButton";
import { ShareToolbar } from "@/components/ShareToolbar";
import { TrackOnView } from "@/components/Tracked";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ nouvelle?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const card = await getCard(id);
  if (!card) return { title: "Carte introuvable", robots: { index: false } };
  const top = card.percentiles[0];
  const title = top ? `${top.label} : top ${top.topPct} % · Rapport n° ${card.dossier}` : `Rapport clinique n° ${card.dossier}`;
  const description = `${card.basis === "declared" ? "Valeurs déclarées" : "Analyse de photo"} · Et vous, à quel percentile êtes-vous ? ${SITE.name}`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, images: [{ url: `/c/${id}/og`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [`/c/${id}/og`] },
  };
}

/**
 * Carte publique : ce que l'utilisateur a choisi de montrer (jamais une copie du rapport), et une porte d'entrée vers le test pour qui la
 * reçoit. `?nouvelle=1` : son auteur vient de la créer, la barre de partage passe en premier.
 */
export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { nouvelle } = await searchParams;
  const card = await getCard(id);
  if (!card) notFound();
  const profile = profileById(card.profile); // présent seulement si l'utilisateur l'a choisi
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? SITE.domain;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/c/${id}`;
  const author = nouvelle === "1";

  const cardView = (
    <div className="relative overflow-hidden rounded-[22px] bg-[var(--bm-navy-900)] text-white p-6 md:p-8 shadow-[var(--shadow-elevated)]" data-card>
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[radial-gradient(circle,rgba(23,105,255,0.5),transparent_70%)]" />
      <div className="relative">
        <h1 className="mono text-[12px] tracking-[0.16em] text-[#9fc2ff]">{`RAPPORT CLINIQUE N° ${card.dossier}`}</h1>
        <p className="text-[12px] text-[#9fb3d1] mt-1">{card.basis === "declared" ? "Valeurs déclarées" : "Analyse de photo"}</p>
        <div className="mt-6 grid gap-3">
          {card.percentiles.map((p) => (
            <div key={p.label} className="flex items-baseline justify-between gap-4 rounded-[14px] bg-white/[0.06] border border-white/10 px-4 py-3">
              <span className="text-[#c9d6ea]">{p.label}</span>
              <span className="num text-[30px] font-extrabold leading-none">top {p.topPct} %</span>
            </div>
          ))}
          {card.landmark && (
            <div className="flex items-baseline justify-between gap-4 rounded-[14px] bg-white/[0.06] border border-white/10 px-4 py-3">
              <span className="text-[#c9d6ea]">{card.landmark.label}</span>
              <span className="num text-[24px] font-bold leading-none">{card.landmark.times.toLocaleString("fr-FR")} × moi</span>
            </div>
          )}
          {profile && (
            <div className="flex items-baseline justify-between gap-4 rounded-[14px] bg-white px-4 py-3 text-[var(--bm-navy-900)]" data-card-profile={profile.id}>
              <span className="text-[var(--bm-navy-700)]">Profil</span>
              <span className="font-bold text-[18px]">{profile.name}</span>
            </div>
          )}
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#9fb3d1]">Score</p>
            <p className="num text-[56px] font-extrabold leading-none">
              {card.score}
              <span className="text-[20px] text-[#9fb3d1] font-semibold"> / 100</span>
            </p>
          </div>
          <p className="num text-[13px] text-[#9fb3d1]">{SITE.domain}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-bm py-8 md:py-14">
      {!author && <TrackOnView event="referral_visit" once={id} />}
      <div className="mx-auto max-w-xl space-y-6">
        {author && (
          <div className="text-center">
            <p className="t-eyebrow">Votre carte est prête</p>
            <p className="t-h3 mt-2">Envoyez-la. Vos amis découvriront leur percentile.</p>
          </div>
        )}
        {cardView}
        <p className="t-small text-muted">
          Le score est une note de présentation volontairement indulgente, pas un percentile ; « top X % » se lit sur les percentiles.{" "}
          <Link href="/methode" className="underline">Voir la méthode</Link>.
        </p>

        {author ? (
          <section aria-label="Partager la carte" className="card !p-5">
            <ShareToolbar url={url} text="J'ai fait le test Bitomètre. À ton tour de découvrir ton percentile :" image={`/c/${id}/story`} imageName={`bitometre-${card.dossier}-story.png`} />
          </section>
        ) : (
          <section aria-labelledby="et-vous" className="card !p-6 text-center space-y-3">
            <h2 id="et-vous" className="t-h2">Et vous, à quel percentile êtes-vous&nbsp;?</h2>
            <p className="text-muted">Quatre questions, une minute, gratuit et sans compte. Votre résultat reste privé.</p>
            <div className="flex justify-center pt-2">
              <ScanButton fullOnMobile label="Découvrir mon percentile" />
            </div>
          </section>
        )}

        <div className="flex flex-wrap justify-center gap-3 t-small">
          <a href={`/c/${id}/story`} download={`bitometre-${card.dossier}-story.png`} className="btn btn-tertiary btn-sm">Image 1080 × 1920</a>
          <a href={`/c/${id}/og`} download={`bitometre-${card.dossier}.png`} className="btn btn-tertiary btn-sm">Image 1200 × 630</a>
        </div>
      </div>
    </div>
  );
}
