import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { LANDMARKS } from "@/config/site";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { profileById } from "@/lib/profiles";
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
  // Rapport partiel (photo difficile à lire) : rien de personnel à partager.
  if (view.results.morpho?.partielle) redirect(`/r/${id}`);
  // Rapport photo au repos : pas de percentile de longueur, donc ni percentile de longueur ni profil sur la carte.
  const hasLength = view.results.length.percentile !== undefined;
  const cards = await listCards(id);

  return (
    <Doc title="Partager mon résultat">
      <p className="mt-4">
        Créez une carte à envoyer : elle ne montre que ce que vous choisissez ici, jamais votre rapport. Par défaut : le score seul. Aucune image
        de vous, aucune silhouette. Le score est une note de présentation, pas un percentile.
      </p>
      {erreur && <p className="mt-4 text-[var(--bm-error-text)]" role="alert">{erreur}</p>}

      <form action={createShareCard.bind(null, id)} className="card !p-5 md:!p-6 mt-6 space-y-5">
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="mode" value="score" defaultChecked className="mt-1 accent-[var(--accent)]" />
          <span className="text-foreground">Score seul (par défaut)</span>
        </label>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" value="percentiles" className="mt-1 accent-[var(--accent)]" />
            <span className="text-foreground">Score et un ou deux percentiles <span className="badge badge-blue ml-1 align-middle">Recommandé</span></span>
          </label>
          <div className="pl-6 flex gap-4 text-sm">
            {hasLength && <label className="flex items-center gap-2"><input type="checkbox" name="p_length" className="accent-[var(--accent)]" /> Longueur</label>}
            <label className="flex items-center gap-2"><input type="checkbox" name="p_girth" className="accent-[var(--accent)]" /> Circonférence</label>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="mode" value="landmark" className="mt-1 accent-[var(--accent)]" />
            <span className="text-foreground">Score et une mesure de référence</span>
          </label>
          <select name="landmark" aria-label="Mesure de référence à afficher sur la carte" className="ml-6 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {LANDMARKS.map((l) => (
              <option key={l.label} value={l.label}>{l.label}</option>
            ))}
          </select>
        </div>
        {hasLength && (
          <div className="space-y-1 border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="profile" className="mt-1 accent-[var(--accent)]" aria-describedby="profil-aide" />
              <span className="text-foreground">Ajouter mon profil morphologique</span>
            </label>
            <p id="profil-aide" className="pl-6 t-small text-muted">
              Le nom du profil (pas sa description) apparaît sur la carte publique et ses images. Désactivé par défaut : sans cette case, la carte ne le montre pas.
            </p>
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-block-mobile">Créer la carte et la partager</button>
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
                  {profileById(c.content.profile) && ` · profil ${profileById(c.content.profile)!.name}`}
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
