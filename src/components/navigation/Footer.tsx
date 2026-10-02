import Link from "next/link";
import { FORMULAS, SITE, formatEur } from "@/config/site";
import { isFreeBeta } from "@/lib/mode";
import { isPublished, loadSeoPages } from "@/lib/seo";
import { Logo } from "./Header";

const LINKS = [
  ["/methode", "Précision et méthode"],
  ["/mentions-legales", "Mentions légales"],
  ["/cgv", "CGV"],
  ["/confidentialite", "Confidentialité"],
  ["/contact", "Contact et signalement"],
] as const;
// Bêta gratuite : conditions d'utilisation de la bêta à la place des CGV.
const LINKS_BETA = LINKS.map(([h, l]) => (h === "/cgv" ? (["/conditions", "Conditions d'utilisation (bêta)"] as const) : ([h, l] as const)));

/** Pied de page sobre : logo, liens, rappel 18+ (et prix hors bêta), mention statistique. */
export function Footer() {
  const beta = isFreeBeta();
  // Guides : visibles seulement une fois publiés (ou hors production, pour la relecture).
  const guides = isPublished() || process.env.NODE_ENV !== "production" ? loadSeoPages() : [];
  return (
    <footer className="site-footer border-t border-[var(--bm-gray-200)] bg-[var(--bm-gray-050)] mt-0">
      <div className="container-bm py-10 space-y-6 text-sm text-muted">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav aria-label="Informations légales" className="flex flex-wrap gap-x-5 gap-y-1">
            {(beta ? LINKS_BETA : LINKS).map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex items-center min-h-[44px] hover:text-foreground">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        {guides.length > 0 && (
          <nav aria-label="Guides" className="flex flex-wrap gap-x-5 gap-y-1">
            {guides.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`} className="inline-flex items-center min-h-[44px] hover:text-foreground">
                {g.title}
              </Link>
            ))}
          </nav>
        )}
        <p>
          <span className="num border border-[var(--border)] rounded-md px-1.5 py-0.5 mr-2 font-semibold text-foreground">18+</span>
          Service réservé aux adultes.{" "}
          {beta ? (
            "Bêta gratuite, sans compte."
          ) : (
            <>
              Prix TTC, paiement unique, sans abonnement :{" "}
              {Object.values(FORMULAS).map((f, i) => (
                <span key={f.id}>
                  {i > 0 && " · "}
                  {f.label} <span className="num">{formatEur(f.priceEur)}</span>
                </span>
              ))}
              .
            </>
          )}
        </p>
        <p className="t-caption">
          © {new Date().getFullYear()} {SITE.name}. Les résultats sont des estimations statistiques, pas un avis médical.
        </p>
      </div>
    </footer>
  );
}
