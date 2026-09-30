import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { LANDMARKS } from "@/config/site";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { listCards } from "@/lib/share";
import { getReportView } from "@/lib/view";
import { createShareCard, removeShareCard } from "../actions";

export const metadata = { title: "Partager ma carte", robots: { index: false, follow: false, nocache: true }, ...PRIVATE_SOCIAL };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { id } = await params;
  const { erreur } = await searchParams;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();
  if (view.status === "locked") redirect(`/r/${id}`);
  const cards = await listCards(id);

  return (
    <Doc title="Partager ma carte">
      <p className="mt-4">
        La carte publique ne montre que ce que vous choisissez ici. Par défaut : le score seul. Aucune image de vous, aucune
        silhouette. Le score est une note de présentation, pas un percentile.
      </p>
      {erreur && <p className="mt-4 text-accent-2" role="alert">{erreur}</p>}

      <form action={createShareCard.bind(null, id)} className="panel p-5 mt-6 space-y-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" value="score" defaultChecked className="mt-1 accent-[var(--accent)]" />
          <span className="text-foreground">Score seul (par défaut)</span>
        </label>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" value="percentiles" className="mt-1 accent-[var(--accent)]" />
            <span className="text-foreground">Score et un ou deux percentiles</span>
          </label>
          <div className="pl-6 flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="p_length" className="accent-[var(--accent)]" /> Longueur</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="p_girth" className="accent-[var(--accent)]" /> Circonférence</label>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" value="landmark" className="mt-1 accent-[var(--accent)]" />
            <span className="text-foreground">Score et une mesure de référence</span>
          </label>
          <select name="landmark" className="ml-6 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {LANDMARKS.map((l) => (
              <option key={l.label} value={l.label}>{l.label}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">Créer la carte</button>
      </form>

      {cards.length > 0 && (
        <>
          <h2>Mes cartes</h2>
          <ul className="space-y-2">
            {cards.map((c) => (
              <li key={c.id} className="panel p-3 flex items-center justify-between gap-3 text-sm">
                <Link href={`/c/${c.id}`} className="underline">
                  Carte n° {c.content.dossier} · score {c.content.score}
                  {c.content.percentiles.length > 0 && ` · ${c.content.percentiles.map((p) => p.label.toLowerCase()).join(", ")}`}
                  {c.content.landmark && ` · ${c.content.landmark.label}`}
                </Link>
                <form action={removeShareCard.bind(null, id, c.id)}>
                  <button type="submit" className="text-accent-2 hover:underline">Retirer</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-6"><Link href={`/r/${id}`} className="underline">Retour au rapport</Link></p>
    </Doc>
  );
}
