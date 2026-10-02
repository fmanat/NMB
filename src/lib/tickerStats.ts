import { TICKER } from "@/config/site";
import { completedAnalysisStats } from "./repo";
import type { LiveAnalysisStats } from "./ticker";

// Lecture serveur, avec mémoire courte et jamais bloquante, des agrégats du bandeau défilant (nombre d'analyses terminées, score moyen).
// Base lente, injoignable ou en erreur : on rend `null` (le bandeau s'affiche sans ces deux éléments), jamais d'exception, jamais d'attente
// au-delà du délai maximal. Le résultat, y compris un échec, est gardé quelques instants pour ne pas relancer la base à chaque requête.

export type StatsReaderDeps = {
  query: () => Promise<LiveAnalysisStats>;
  ttlMs: number;
  failureTtlMs: number;
  timeoutMs: number;
  now?: () => number;
};

export function createLiveStatsReader(deps: StatsReaderDeps): () => Promise<LiveAnalysisStats | null> {
  const now = deps.now ?? Date.now;
  let cached: { until: number; value: LiveAnalysisStats | null } | null = null;
  let inflight: Promise<LiveAnalysisStats | null> | null = null;

  const fetchOnce = async (): Promise<LiveAnalysisStats | null> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("délai dépassé")), deps.timeoutMs);
      });
      const raw = await Promise.race([deps.query(), timeout]);
      const ok = raw && Number.isInteger(raw.count) && raw.count >= 0 && Number.isFinite(raw.averageScore) && raw.averageScore >= 0;
      const value = ok ? { count: raw.count, averageScore: raw.averageScore } : null;
      cached = { until: now() + (value ? deps.ttlMs : deps.failureTtlMs), value };
      return value;
    } catch {
      cached = { until: now() + deps.failureTtlMs, value: null };
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return async () => {
    if (cached && now() < cached.until) return cached.value;
    // Les requêtes simultanées partagent la même lecture.
    inflight ??= fetchOnce().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}

/** Durée de mémorisation : réglable par TICKER_STATS_TTL_MS (les tests de bout en bout la mettent à 0 pour voir une base remplie tout de suite). */
export function statsTtlMs(env: Record<string, string | undefined> = process.env): number {
  const raw = env.TICKER_STATS_TTL_MS;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : TICKER.statsCacheMs;
}

export const getLiveAnalysisStats = createLiveStatsReader({
  query: () => completedAnalysisStats().then((r) => ({ count: r.count, averageScore: r.averageScore })),
  ttlMs: statsTtlMs(),
  failureTtlMs: statsTtlMs() === 0 ? 0 : TICKER.statsFailureCacheMs,
  timeoutMs: TICKER.statsTimeoutMs,
});
