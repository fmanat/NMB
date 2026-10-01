import Link from "next/link";
import { SITE } from "@/config/site";
import { Ticker } from "./Ticker";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
      <Ticker />
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          {SITE.name}
        </Link>
        <nav aria-label="Principale" className="flex items-center gap-2 text-sm text-muted">
          <Link href="/methode" className="hover:text-foreground px-2 py-3">Méthode</Link>
          <Link href="/contact" className="hover:text-foreground px-2 py-3">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
