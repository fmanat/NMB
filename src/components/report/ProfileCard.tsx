import Link from "next/link";
import type { ReportResults } from "@/lib/reportCore";
import { CLASSES, RANK, profileFor, type Profile } from "@/lib/profiles";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

/**
 * Repère géométrique de la case occupée dans la grille des profils : neuf carrés, un seul plein. Purement décoratif (aria-hidden) :
 * le nom et la phrase du profil sont du vrai texte. Aucune forme corporelle, aucun dessin d'anatomie.
 */
export function ProfileMark({ profile, size = 14 }: { profile: Profile; size?: number }) {
  return (
    <span aria-hidden="true" data-profile-mark={profile.id} className="inline-grid shrink-0 grid-cols-3 gap-[3px]">
      {CLASSES.flatMap((l) =>
        CLASSES.map((c) => {
          const active = l === profile.lengthClass && c === profile.girthClass;
          return (
            <span
              key={`${RANK[l]}${RANK[c]}`}
              style={{ width: size, height: size }}
              className={`rounded-[3px] ${active ? "bg-[var(--bm-blue-500)]" : "bg-[var(--bm-blue-100)] border border-[var(--bm-gray-300)]"}`}
            />
          );
        }),
      )}
    </span>
  );
}

/**
 * Profil morphologique d'un rapport : nom, une phrase, case de la grille. Ne dépend que des percentiles de longueur et de circonférence
 * du rapport (aucun calcul supplémentaire). Sert au rapport réel et à l'exemple fictif de l'accueil (`example`).
 */
export function ProfileCard({ results: r, example = false }: { results: ReportResults; example?: boolean }) {
  // Profil : il faut les deux percentiles (rapport photo au repos : pas de percentile de longueur, donc pas de profil).
  if (r.length.percentile === undefined || r.girth.percentile === undefined) return null;
  const profile = profileFor(r.length.percentile, r.girth.percentile);
  return (
    <Card as="section" soft className="!p-6 md:!p-8">
      <div data-profile={profile.id} className="flex items-center gap-5 md:gap-6">
        <ProfileMark profile={profile} size={16} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="t-eyebrow">Profil morphologique</p>
            {example && <Badge tone="warning">Exemple fictif</Badge>}
          </div>
          <h2 className="t-h3 mt-2">{profile.name}</h2>
          <p className="text-muted mt-2 max-w-[60ch]">{profile.description}</p>
          <p className="t-small text-muted mt-3">
            Ce profil ne dépend que des percentiles de longueur et de circonférence ci-dessus ; il décrit une case d&apos;une grille, pas une note.{" "}
            <Link href="/methode#profils" className="text-[var(--bm-blue-700)] underline">Voir les neuf profils</Link>
          </p>
        </div>
      </div>
    </Card>
  );
}
