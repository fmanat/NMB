"use client";

import { useEffect } from "react";

/**
 * Déclenche une seule fois l'animation des anneaux, barres et courbes quand ils entrent à l'écran.
 * Les éléments portent `data-reveal` ; ce composant y pose `run` (animation en cours, puis `data-animated="done"` à la fin)
 * ou `pending` (hors écran, état de départ). Sans JavaScript, sans IntersectionObserver ou en mouvement réduit, il ne fait rien :
 * la valeur finale est celle du HTML rendu côté serveur. Le texte des valeurs n'est jamais masqué.
 */
const SELECTOR = "[data-reveal-on-view]";

export function RevealOnView() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof window.matchMedia !== "function") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const finish = (el: HTMLElement) => {
      const anims = typeof el.getAnimations === "function" ? el.getAnimations({ subtree: true }) : [];
      Promise.allSettled(anims.map((a) => a.finished)).then(() => {
        el.dataset.animated = "done";
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            io.unobserve(el);
            el.dataset.reveal = "run";
            // L'état « run » démarre les animations CSS au prochain calcul de style : on attend leur création.
            requestAnimationFrame(() => finish(el));
          } else if (!el.dataset.reveal) {
            el.dataset.reveal = "pending";
          }
        }
      },
      { threshold: 0.15 },
    );

    const seen = new WeakSet<Element>();
    const add = (el: HTMLElement) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    };
    const watch = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(SELECTOR)) add(root);
      root.querySelectorAll<HTMLElement>(SELECTOR).forEach(add);
    };
    watch(document);
    // Éléments ajoutés plus tard (simulation « Essayez » chargée au défilement).
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && watch(n));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
