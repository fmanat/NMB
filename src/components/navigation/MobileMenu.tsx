"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ScanButton } from "@/components/ScanButton";

/** Menu mobile (tiroir plein écran). Bouton de 44 px, fermeture par Échap, par un lien ou par le bouton ; le focus revient au bouton. */
export function MobileMenu({ links }: { links: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={btn}
        type="button"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="menu-mobile"
        onClick={() => setOpen((o) => !o)}
        className="grid place-items-center size-11 rounded-[10px] text-foreground hover:bg-[var(--bm-gray-100)]"
      >
        <Icon name={open ? "close" : "menu"} size={24} />
      </button>
      {open && (
        <div id="menu-mobile" className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-white overflow-y-auto">
          <nav aria-label="Menu mobile" className="container-bm py-6 flex flex-col">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="min-h-[56px] flex items-center border-b border-[var(--bm-gray-200)] text-[18px] font-semibold">
                {label}
              </Link>
            ))}
            <div className="mt-6">
              <ScanButton fullOnMobile />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
