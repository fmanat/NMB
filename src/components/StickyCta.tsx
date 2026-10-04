"use client";

import { useEffect, useState } from "react";
import { ScanButton } from "@/components/ScanButton";

/**
 * Barre d'action collante en bas de l'écran, sur mobile seulement, pour les pages de lecture longues : elle apparaît après un peu de
 * lecture et s'efface quand l'appel principal de fin de page ([data-content-cta]) est visible (jamais deux boutons identiques à l'écran) et au
 * pied de page (dont elle ne doit masquer aucun lien).
 */
export function StickyCta({ label = "Découvrir mon percentile" }: { label?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let ctaVisible = false;
    const update = () => {
      const nearEnd = window.innerHeight + window.scrollY > document.documentElement.scrollHeight - 480; // pied de page : rien ne le masque
      setShow(window.scrollY > 700 && !ctaVisible && !nearEnd);
    };
    const target = document.querySelector("[data-content-cta]");
    const io =
      target && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((e) => {
            ctaVisible = e.some((x) => x.isIntersecting);
            update();
          })
        : null;
    if (target) io?.observe(target);
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      io?.disconnect();
    };
  }, []);
  return (
    <div
      className={`sm:hidden fixed inset-x-0 bottom-0 z-[var(--z-header)] border-t border-[var(--border)] bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 motion-reduce:transition-none no-print ${
        show ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
      aria-hidden={show ? undefined : true}
      inert={!show}
      data-sticky-cta
    >
      <ScanButton fullOnMobile label={label} />
    </div>
  );
}
