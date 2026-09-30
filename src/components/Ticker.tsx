import { TICKER } from "@/config/site";

export type GlobalStats = {
  totalAnalyses: number;
  averageScore: number;
  bestScoreThisWeek: number;
};

// Étape 1 : pas encore de base de données, donc aucune statistique réelle.
// Étape 2 : cette fonction lira les vraies valeurs dans PostgreSQL.
async function getGlobalStats(): Promise<GlobalStats | null> {
  return null;
}

export async function Ticker() {
  const stats = await getGlobalStats();
  if (!stats || stats.totalAnalyses < TICKER.minAnalysesToShow) return null;

  const items: [string, string][] = [
    ["Analyses réalisées", stats.totalAnalyses.toLocaleString("fr-FR")],
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
