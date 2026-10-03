"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Coque du bandeau « scanner » : affiche d'abord le repli statique (SVG fourni par le serveur, présent dès le premier rendu),
 * puis, une fois la page chargée et le navigateur au repos, charge le moteur de dessin par import dynamique et superpose le canevas.
 * Sans JavaScript, sans canvas 2D ou si le chargement échoue : le repli reste affiché, rien d'autre ne change.
 * Le canevas est décoratif (aria-hidden) ; les valeurs sont du texte réel fourni par le serveur (`labels`).
 */
export function ScannerShell({
  fallback,
  labels,
  footer,
  curvature,
}: {
  fallback: ReactNode;
  labels: ReactNode;
  footer: ReactNode;
  /** Courbure du rapport d'exemple (angle et direction), transmise au moteur animé seulement ; le repli ne l'utilise pas. */
  curvature: { angleDeg: number; direction: "none" | "left" | "right" | "up" | "down" };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const boot = () => {
      import("./scannerEngine")
        .then((m) => {
          const canvas = canvasRef.current;
          if (cancelled || !canvas) return;
          const handle = m.startScanner(canvas, { curvature, onFirstFrame: () => !cancelled && setLive(true) });
          if (handle) stop = () => handle.destroy();
        })
        .catch(() => {
          // chargement impossible : le repli statique reste affiché
        });
    };
    // Après l'événement « load » puis au repos : le bandeau ne gêne ni le premier affichage ni la mesure de performance.
    const schedule = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(boot, { timeout: 3000 });
      else timer = setTimeout(boot, 1200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
      if (timer) clearTimeout(timer);
      stop?.();
    };
    // La courbure vient du rapport d'exemple (constante) : le moteur n'est démarré qu'une fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      aria-label="Scanner : aperçu d'un rapport d'exemple"
      data-scanner={live ? "live" : "static"}
      className="group scanner-band relative overflow-hidden bg-[var(--bm-dark-bg)] text-[var(--bm-dark-text)] md:rounded-[var(--radius-xl)] md:border md:border-[var(--bm-dark-border)]"
    >
      <div className="relative h-[276px] sm:h-[276px] lg:h-[400px]">
        <div className="absolute inset-0 transition-opacity duration-300 group-data-[scanner=live]:opacity-0" aria-hidden="true">
          {fallback}
        </div>
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full opacity-0 group-data-[scanner=live]:opacity-100 cursor-grab" style={{ touchAction: "pan-y" }} />
        {labels}
      </div>
      {footer}
    </section>
  );
}
