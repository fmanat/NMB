"use client";

import { useEffect, useState } from "react";

type Stats = { show: true; totalAnalyses: number; averageScore: number; bestScoreThisWeek: number };

/**
 * Bandeau de statistiques réelles. Chargé par le navigateur après l'affichage pour que les pages restent statiques
 * (chargement rapide). Masqué tant que le seuil de la configuration n'est pas atteint : l'API ne renvoie alors aucun chiffre.
 */
export function Ticker() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/stats", { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { show: boolean } | null) => {
        if (j?.show) setStats(j as Stats);
      })
      .catch(() => {});
    return () => ctl.abort();
  }, []);

  if (!stats) return null;
  const items: [string, string][] = [
    ["Rapports délivrés", stats.totalAnalyses.toLocaleString("fr-FR")],
    ["Score moyen", stats.averageScore.toFixed(1).replace(".", ",")],
    ["Meilleur score de la semaine", String(stats.bestScoreThisWeek)],
  ];
  return (
    <div className="border-b border-border bg-surface text-xs">
      <div className="mx-auto max-w-5xl px-4 h-8 flex items-center justify-between gap-4 overflow-x-auto whitespace-nowrap">
        {items.map(([label, value]) => (
          <span key={label} className="text-muted">
            {label} <span className="num text-accent-2 ml-1">{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
