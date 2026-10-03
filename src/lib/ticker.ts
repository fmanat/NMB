import { REFERENCE_SOURCE, TICKER } from "@/config/site";
import type { ReportResults } from "./reportCore";
import { referenceFor } from "./stats";

// Bandeau défilant de l'accueil : construction de la liste des éléments. Fonctions pures, sans accès serveur ni base.
// Règle : chaque élément est VRAI et dérivé d'une source du code, de la base ou de la construction du site ; aucun chiffre écrit en dur.

export type TickerItemId = "beta" | "analyses" | "score" | "reference" | "measures" | "version";

export type TickerItem = {
  id: TickerItemId;
  label: string;
  /** Valeur mise en avant (absente pour « Bêta gratuite »). */
  value?: string;
  /** Précision en plus discret (source citée, unité, détail). */
  note?: string;
};

/** Agrégats réels de la base (nombre d'analyses terminées et score moyen), ou `null` si indisponibles. */
export type LiveAnalysisStats = { count: number; averageScore: number };

/**
 * Mesures d'un rapport, par clé du type `ReportResults` (le compilateur refuse une clé qui n'existe pas dans le rapport).
 * Le nombre de mesures affiché est le nombre de ces clés réellement présentes dans un rapport construit par le site.
 */
export const REPORT_MEASURES = {
  length: "longueur",
  girth: "circonférence",
  curvature: "courbure",
  score: "score",
} as const satisfies Partial<Record<keyof ReportResults, string>>;

/** Mesures présentes dans le rapport donné (clés de `REPORT_MEASURES` renseignées dans l'objet). */
export function reportMeasureKeys(report: ReportResults): (keyof typeof REPORT_MEASURES)[] {
  return (Object.keys(REPORT_MEASURES) as (keyof typeof REPORT_MEASURES)[]).filter((k) => report[k] !== undefined && report[k] !== null);
}

/** Nombre décimal à la française (virgule), sans arrondi superflu : 13.12 donne « 13,12 ». */
export const frNumber = (n: number, digits = 2): string => String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");

/** Entier avec espaces insécables entre les milliers (sans dépendre des données de langue du système). */
export const frInt = (n: number): string => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/** Date de construction (ISO) mise en forme en français, ou `null` si elle est absente ou invalide : l'élément n'est alors pas affiché. */
export function formatBuildDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_FORMAT.format(d);
}

/** Vrai si les chiffres réels justifient l'affichage du compteur : strictement au-dessus du seuil, valeurs saines. */
export function liveStatsQualify(live: LiveAnalysisStats | null | undefined): live is LiveAnalysisStats {
  return !!live && Number.isFinite(live.count) && Number.isFinite(live.averageScore) && live.count > TICKER.analysesThreshold;
}

export type TickerInput = {
  /** Résultat de `isFreeBeta()`. */
  freeBeta: boolean;
  /** Date de construction du site au format ISO (injectée par next.config.ts). */
  buildDate?: string;
  /** Agrégats de la base, `null` si la base n'a pas répondu. */
  live: LiveAnalysisStats | null;
  /** Rapport construit par le site (le rapport d'exemple), dont on compte les mesures. */
  report: ReportResults;
};

/** Liste ordonnée des éléments du bandeau ; chaque élément n'est présent que si sa condition est remplie. */
export function buildTickerItems({ freeBeta, buildDate, live, report }: TickerInput): TickerItem[] {
  const items: TickerItem[] = [];

  if (freeBeta) items.push({ id: "beta", label: "Bêta gratuite" });

  if (liveStatsQualify(live)) {
    items.push({ id: "analyses", label: "Analyses réalisées", value: frInt(live.count) });
    items.push({ id: "score", label: "Score moyen", value: frNumber(live.averageScore, 1), note: "sur 100" });
  }

  // La loi des percentiles du site est normale : la médiane est la moyenne de référence (percentile 50 en ce point, vérifié par un test).
  items.push({
    id: "reference",
    label: "Longueur médiane de référence, en érection",
    value: `${frNumber(referenceFor("erect", "length").mean)} cm`,
    note: REFERENCE_SOURCE,
  });

  const measures = reportMeasureKeys(report);
  if (measures.length > 0) {
    items.push({
      id: "measures",
      label: "Indicateurs dans chaque rapport",
      value: String(measures.length),
      note: `(${measures.map((k) => REPORT_MEASURES[k]).join(", ")})`,
    });
  }

  const date = formatBuildDate(buildDate);
  if (date) items.push({ id: "version", label: "Version du", value: date });

  return items;
}
