"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ScanButton } from "@/components/ScanButton";

/**
 * Barre d'action collante en bas de l'écran, sur mobile seulement, pour les pages longues : elle apparaît après un peu de lecture et
 * s'efface quand l'appel principal qu'elle répète (`hideWhen`, par défaut [data-content-cta]) est visible (jamais deux boutons identiques
 * à l'écran) et au pied de page (dont elle ne doit masquer aucun lien). Contenu par défaut : le bouton du test.
 */
export function StickyCta({ label = "Découvrir mon percentile", hideWhen = "[data-content-cta]", after = 700, children }: { label?: string; hideWhen?: string; after?: number; children?: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let targetVisible = false;
    const update = () => {
      const nearEnd = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 480; // pied de page : rien ne le masque
      setShow(window.scrollY > after && !targetVisible && !nearEnd);
    };
    const targets = document.querySelectorAll(hideWhen);
    const seen = new Map<Element, boolean>();
    const io =
      targets.length && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            for (const e of entries) seen.set(e.target, e.isIntersecting);
            targetVisible = [...seen.values()].some(Boolean);
            update();
          })
        : null;
    targets.forEach((t) => io?.observe(t));
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      io?.disconnect();
    };
  }, [hideWhen, after]);
  return (
    <div
      className={`sm:hidden fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-[var(--border)] bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur transition-[translate,visibility] duration-300 motion-reduce:transition-none no-print ${
        show ? "translate-y-0 visible" : "translate-y-full invisible pointer-events-none"
      }`}
      aria-hidden={show ? undefined : true}
      inert={!show}
      data-sticky-cta
    >
      {children ?? <ScanButton fullOnMobile label={label} />}
    </div>
  );
}
