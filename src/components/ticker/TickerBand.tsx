import type { TickerItem } from "@/lib/ticker";

/**
 * Bandeau défilant d'informations vraies (tout en haut de l'accueil, au-dessus du menu : barre fine), purement présentationnel : il reçoit la liste déjà construite (`buildTickerItems`).
 * Aucun JavaScript, aucun appel réseau : tout est rendu par le serveur, le défilement est du CSS (voir globals.css, « Bandeau défilant »).
 *
 * Accessibilité :
 *  - une seule liste réelle (`data-ticker="list"`) lue par les lecteurs d'écran, sans doublon ;
 *  - le défilement visuel (`data-ticker="marquee"`) contient deux copies de la liste et est entièrement `aria-hidden` ;
 *  - mouvement réduit : la boucle disparaît, la liste réelle devient visible, statique, sur plusieurs lignes ;
 *  - pause : au survol, au focus clavier dans le bandeau, et par une case « Pause » (critère WCAG 2.2.2, sans JavaScript).
 */
function ItemText({ item }: { item: TickerItem }) {
  return (
    <>
      <span className={item.value ? "ticker-label" : "ticker-value"}>{item.label}</span>
      {item.value ? (
        <>
          {" "}
          <span className="ticker-value num">{item.value}</span>
        </>
      ) : null}
      {item.note ? (
        <>
          {" "}
          <span className="ticker-label">{item.note}</span>
        </>
      ) : null}
    </>
  );
}

export function TickerBand({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Informations du site" className="ticker border-b border-[var(--bm-gray-200)] bg-[var(--bm-blue-050)]">
      <div className="container-bm flex items-center gap-2 min-h-7 sm:min-h-8">
        {/* Version lisible (lecteurs d'écran ; visible et statique si le mouvement est réduit). */}
        <ul data-ticker="list" className="ticker-list">
          {items.map((it) => (
            <li key={it.id} data-ticker-item={it.id} className="ticker-item">
              <ItemText item={it} />
            </li>
          ))}
        </ul>

        {/* Défilement : décoratif pour les lecteurs d'écran (la liste ci-dessus dit la même chose, une seule fois). */}
        <div data-ticker="marquee" aria-hidden="true" className="ticker-viewport">
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="ticker-copy">
                {items.map((it) => (
                  <span key={it.id} className="ticker-item">
                    <ItemText item={it} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <label className="ticker-pause">
          <input type="checkbox" className="ticker-pause-input" />
          <span>Pause</span>
        </label>
      </div>
    </section>
  );
}
