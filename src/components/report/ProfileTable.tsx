import { CLASSES, CLASS_LABEL, RANK, profileById, type ProfileClass } from "@/lib/profiles";
import { ProfileMark } from "./ProfileCard";

/**
 * Grille complète des neuf profils morphologiques (page méthode) : un vrai tableau (lignes : longueur, colonnes : circonférence) sur écran
 * large, une liste groupée par classe de longueur sur mobile. Même contenu dans les deux cas ; un seul des deux est affiché.
 */
export function ProfileTable() {
  const cell = (l: ProfileClass, c: ProfileClass) => profileById(`l${RANK[l]}c${RANK[c]}`)!;
  return (
    <>
      {/* Mobile : une liste par classe de longueur */}
      <div className="md:hidden space-y-5" data-profile-list>
        {CLASSES.map((l) => (
          <section key={l} aria-labelledby={`profils-long-${l}`} className="space-y-2">
            <h3 id={`profils-long-${l}`} className="t-small font-semibold !mt-0">Longueur : {CLASS_LABEL[l]}</h3>
            <ul className="space-y-2 !list-none !pl-0">
              {CLASSES.map((c) => {
                const p = cell(l, c);
                return (
                  <li key={p.id} data-profile-item={p.id} className="card !p-4 list-none">
                    <p className="t-caption text-muted">Circonférence : {CLASS_LABEL[c]}</p>
                    <p className="flex items-center gap-3 mt-1">
                      <ProfileMark profile={p} size={9} />
                      <strong className="t-h4 !text-[16px]">{p.name}</strong>
                    </p>
                    <p className="t-small text-muted mt-1">{p.description}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Écran large : tableau */}
      <div className="hidden md:block card !p-0 overflow-x-auto" data-profile-table>
        <table className="data-table !text-[14px]">
          <caption className="sr-only">Les neuf profils morphologiques : classe de longueur en lignes, classe de circonférence en colonnes.</caption>
          <thead>
            <tr>
              <th scope="col" className="!h-auto"><span className="sr-only">Longueur (lignes) et circonférence (colonnes)</span></th>
              {CLASSES.map((c) => (
                <th key={c} scope="col" className="!h-auto align-top">Circonférence : {CLASS_LABEL[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((l) => (
              <tr key={l}>
                <th scope="row" className="!h-auto align-top font-semibold w-[19%]">Longueur : {CLASS_LABEL[l]}</th>
                {CLASSES.map((c) => {
                  const p = cell(l, c);
                  return (
                    <td key={p.id} data-profile-item={p.id} className="!h-auto align-top">
                      <p className="flex items-center gap-2">
                        <ProfileMark profile={p} size={8} />
                        <strong>{p.name}</strong>
                      </p>
                      <p className="t-small text-muted mt-1">{p.description}</p>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
