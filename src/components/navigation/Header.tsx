import Link from "next/link";
import { SITE } from "@/config/site";
import { ScanButton } from "@/components/ScanButton";
import { MobileMenu } from "./MobileMenu";

export const NAV_LINKS = [
  ["/#comment-ca-marche", "Comment ça marche"],
  ["/#exemple", "Exemple de rapport"],
  ["/methode", "Méthode"],
  ["/#faq", "FAQ"],
] as const;

/** Logo typographique avec un petit symbole de données (trois barres) : aucun symbole anatomique. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-[20px] tracking-[-0.02em] text-foreground" aria-label={`${SITE.name}, accueil`}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="12" width="4.5" height="9" rx="1.5" fill="var(--bm-blue-400)" />
        <rect x="9.75" y="6" width="4.5" height="15" rx="1.5" fill="var(--accent)" />
        <rect x="16.5" y="3" width="4.5" height="18" rx="1.5" fill="var(--bm-navy-900)" />
      </svg>
      {SITE.name}
    </Link>
  );
}

/** En-tête : 72 px sur ordinateur, 60 px sur mobile ; jamais dominant. Navigation légère, un seul appel à l'action. */
export function Header() {
  return (
    <header className="site-header sticky top-0 z-[100] bg-white/95 backdrop-blur border-b border-[var(--bm-gray-200)]">
      <div className="container-bm h-[60px] md:h-[72px] flex items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Principale" className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="px-3 min-h-[44px] inline-flex items-center rounded-[10px] text-[15px] font-medium text-muted hover:text-foreground hover:bg-[var(--bm-gray-100)]">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden lg:block">
          <ScanButton small />
        </div>
        <MobileMenu links={NAV_LINKS} />
      </div>
    </header>
  );
}
