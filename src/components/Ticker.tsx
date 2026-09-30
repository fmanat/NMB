import { connection } from "next/server";
import { TICKER } from "@/config/site";
import { globalStats, type GlobalStatsRow } from "@/lib/repo";

async function getStats(): Promise<GlobalStatsRow | null> {
  await connection(); // toujours calculé à la demande, jamais figé au build
  try {
    return await globalStats();
  } catch {
    return null; // base indisponible : le bandeau reste masqué
  }
}

export async function Ticker() {
  const stats = await getStats();
  if (!stats || stats.totalAnalyses < TICKER.minAnalysesToShow) return null;

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
