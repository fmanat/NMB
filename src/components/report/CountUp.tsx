"use client";

import { useEffect, useState } from "react";

/**
 * Nombre entier qui « monte » de 0 à sa valeur à l'affichage du résultat (révélation). Le HTML rendu par le serveur porte déjà la valeur
 * finale : sans JavaScript ou en mouvement réduit, rien ne bouge. Animation pilotée par l'horloge (et non par le nombre d'images) :
 * même dans un onglet ralenti, elle se termine sur la vraie valeur. Aucune valeur intermédiaire n'est annoncée aux lecteurs d'écran
 * (aria-hidden ; le texte accessible est porté par l'élément parent).
 */
export function CountUp({ value, duration = 1100, delay = 250 }: { value: number; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = Date.now() + delay;
    const step = () => {
      const k = Math.min(1, Math.max(0, (Date.now() - t0) / duration));
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      return k >= 1;
    };
    step();
    const timer = setInterval(() => {
      if (step()) clearInterval(timer);
    }, 30);
    return () => {
      clearInterval(timer);
      setShown(value);
    };
  }, [value, duration, delay]);
  return <span aria-hidden="true">{shown}</span>;
}
