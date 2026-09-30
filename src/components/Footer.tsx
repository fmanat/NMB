import Link from "next/link";
import { FORMULAS, SITE, formatEur } from "@/config/site";
import { isPublished, loadSeoPages } from "@/lib/seo";

const LINKS = [
  ["/methode", "Précision et méthode"],
  ["/mentions-legales", "Mentions légales"],
  ["/cgv", "CGV"],
  ["/confidentialite", "Confidentialité"],
  ["/contact", "Contact et signalement"],
] as const;

export function Footer() {
  // Guides : visibles seulement une fois publiés (ou hors production, pour la relecture).
  const guides = isPublished() || process.env.NODE_ENV !== "production" ? loadSeoPages() : [];
  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted space-y-4">
        <p>
          <span className="num border border-border rounded px-1.5 py-0.5 mr-2 text-accent-2">18+</span>
          Service réservé aux adultes. Prix TTC, paiement unique, sans abonnement :{" "}
          {Object.values(FORMULAS).map((f, i) => (
            <span key={f.id}>
              {i > 0 && " · "}
              {f.label} <span className="num">{formatEur(f.priceEur)}</span>
            </span>
          ))}
          .
        </p>
        {guides.length > 0 && (
          <nav aria-label="Guides" className="flex flex-wrap gap-x-5 gap-y-2">
            {guides.map((g) => (
              <Link key={g.slug} href={`/${g.slug}`} className="hover:text-foreground">
                {g.title}
              </Link>
            ))}
          </nav>
        )}
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-xs">
          © {new Date().getFullYear()} {SITE.name}. Les résultats sont des estimations statistiques, pas un avis médical.
        </p>
      </div>
    </footer>
  );
}
