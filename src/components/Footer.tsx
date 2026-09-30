import Link from "next/link";
import { FORMULAS, SITE, formatEur } from "@/config/site";

const LINKS = [
  ["/methode", "Précision et méthode"],
  ["/mentions-legales", "Mentions légales"],
  ["/cgv", "CGV"],
  ["/confidentialite", "Confidentialité"],
  ["/contact", "Contact et signalement"],
] as const;

export function Footer() {
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
