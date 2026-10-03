"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { TryItProps } from "@/lib/tryIt";

// Chargement différé de la simulation : le code n'est demandé que lorsque la zone entre à l'écran (au moins 15 % de sa hauteur : l'accueil ne la charge pas au premier affichage) (ou, sans IntersectionObserver, tout de suite).
// L'accueil garde ainsi son premier affichage léger ; la zone réserve sa hauteur pour ne pas décaler la page.

function Placeholder() {
  return (
    <div className="card" aria-busy="true">
      <p className="t-small text-muted">Chargement de la simulation…</p>
    </div>
  );
}

const TryIt = dynamic(() => import("./TryIt"), { ssr: false, loading: () => <Placeholder /> });

export function TryItLoader(props: TryItProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => setArmed(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={props.compact ? "min-h-[880px] md:min-h-[600px]" : "min-h-[640px] md:min-h-[560px]"} data-try-state={armed ? "loading-or-ready" : "idle"}>
      {armed ? <TryIt {...props} /> : <Placeholder />}
    </div>
  );
}
