import { MAX_SIGMA, REFERENCE_SAMPLES } from "@/config/site";
import { clampPercentile } from "./reportCore";
import { normalCdf, percentile, referenceFor, valueAtPercentile, type BodyState } from "./stats";
import { f1, rankLabel } from "./format";
import { frInt, frNumber } from "./ticker";

// Chiffres des pages de contenu : tous calculés ici, avec les fonctions de calcul du site (mêmes références, même loi normale
// que le rapport). Aucun chiffre statistique n'est écrit à la main dans les fichiers Markdown : ils y figurent sous forme de
// jetons {{nom:arguments}}, remplacés au chargement par `resolveFigureTokens`. Un jeton inconnu ou mal formé fait échouer le chargement.

export const SERIES = ["erect-length", "erect-girth", "rest-length", "rest-girth"] as const;
export type Series = (typeof SERIES)[number];

export const SERIES_LABEL: Record<Series, string> = {
  "erect-length": "longueur en érection",
  "erect-girth": "circonférence en érection",
  "rest-length": "longueur au repos",
  "rest-girth": "circonférence au repos",
};

export function seriesRef(s: Series) {
  const [state, dim] = s.split("-") as ["erect" | "rest", "length" | "girth"];
  const bodyState: BodyState = state === "rest" ? "rest" : "erect";
  const { mean, sd } = referenceFor(bodyState, dim);
  const n = REFERENCE_SAMPLES[state === "rest" ? "flaccid" : "erect"][dim];
  return { state: bodyState, dim, mean, sd, n };
}

/** Percentile brut (0 à 100, non borné) d'une valeur en cm. */
export const rawPercentile = (s: Series, cm: number) => {
  const r = seriesRef(s);
  return percentile(cm, r.mean, r.sd);
};

/** Percentile tel que le rapport l'affiche (une décimale, borné entre 0,1 et 99,9). */
export const shownPercentile = (s: Series, cm: number) => clampPercentile(rawPercentile(s, cm));

export { rankLabel };

/** Sur 1 000 hommes de la population de référence, nombre (partie entière) dont la valeur est inférieure. */
export const perThousandBelow = (s: Series, cm: number) => Math.floor(shownPercentile(s, cm) * 10);

/** Vrai si la valeur sort de la plage que le questionnaire et le calculateur traitent (plus de MAX_SIGMA écarts-types). */
export const outOfCalculatorRange = (s: Series, cm: number) => {
  const r = seriesRef(s);
  return Math.abs(cm - r.mean) / r.sd > MAX_SIGMA;
};

/** Arrondi à deux chiffres significatifs (pour « 1 sur N »). */
const sig2 = (n: number) => {
  if (n < 10) return Math.round(n);
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / p) * p;
};

export class FigureError extends Error {}

/** Définition internationale du pouce. */
const CM_PER_INCH = 2.54;

const num = (v: string | undefined, what: string): number => {
  const n = Number((v ?? "").replace(",", "."));
  if (v === undefined || v === "" || !Number.isFinite(n)) throw new FigureError(`argument « ${what} » manquant ou non numérique`);
  return n;
};
const series = (v: string | undefined): Series => {
  if (!SERIES.includes(v as Series)) throw new FigureError(`série inconnue « ${v ?? ""} » (attendues : ${SERIES.join(", ")})`);
  return v as Series;
};

/** Les jetons disponibles. Chacun reçoit ses arguments (après le nom) et renvoie le texte affiché. */
const TOKENS: Record<string, (args: string[]) => string> = {
  // {{moyenne:erect-length}} → « 13,12 cm » (moyenne publiée ; c'est aussi la médiane de la loi normale du site)
  moyenne: ([s]) => `${frNumber(seriesRef(series(s)).mean)} cm`,
  "ecart-type": ([s]) => `${frNumber(seriesRef(series(s)).sd)} cm`,
  effectif: ([s]) => frInt(seriesRef(series(s)).n),
  "effectif-total": () => frInt(REFERENCE_SAMPLES.total),
  // {{pct:erect-length:14}} → « 70,2 % » : part de la population de référence en dessous de 14 cm
  pct: ([s, cm]) => `${f1(shownPercentile(series(s), num(cm, "cm")))} %`,
  // {{rang:erect-length:14}} → « 70e percentile »
  rang: ([s, cm]) => rankLabel(rawPercentile(series(s), num(cm, "cm"))),
  // {{sur1000:erect-length:14}} → « 702 »
  sur1000: ([s, cm]) => frInt(perThousandBelow(series(s), num(cm, "cm"))),
  // {{au-dessus:erect-length:16}} → part au-dessus, une décimale
  "au-dessus": ([s, cm]) => `${f1(100 - shownPercentile(series(s), num(cm, "cm")))} %`,
  // {{entre:erect-length:12:14}} → part entre deux valeurs, une décimale
  entre: ([s, a, b]) => {
    const k = series(s);
    const lo = num(a, "borne basse");
    const hi = num(b, "borne haute");
    if (hi <= lo) throw new FigureError("la borne haute doit dépasser la borne basse");
    return `${f1(rawPercentile(k, hi) - rawPercentile(k, lo))} %`;
  },
  // {{quantile:erect-length:90}} → valeur sous laquelle se trouvent 90 % des hommes, une décimale
  quantile: ([s, p]) => {
    const k = series(s);
    const pct = num(p, "percentile");
    if (!(pct > 0 && pct < 100)) throw new FigureError("le percentile doit être strictement entre 0 et 100");
    const r = seriesRef(k);
    return `${f1(valueAtPercentile(pct, r.mean, r.sd))} cm`;
  },
  // {{sigma:erect-length:20}} → distance à la moyenne en écarts-types, une décimale
  sigma: ([s, cm]) => {
    const r = seriesRef(series(s));
    return f1(Math.abs(num(cm, "cm") - r.mean) / r.sd);
  },
  // {{ecart:erect-length:15}} → écart à la moyenne en cm, une décimale, sans signe
  ecart: ([s, cm]) => `${f1(Math.abs(num(cm, "cm") - seriesRef(series(s)).mean))} cm`,
  // {{un-sur-dessus:erect-length:17}} → « 1 homme sur 100 » : rareté d'une valeur au moins égale (deux chiffres significatifs)
  "un-sur-dessus": ([s, cm]) => `1 homme sur ${frInt(sig2(100 / (100 - rawPercentile(series(s), num(cm, "cm")))))}`,
  "un-sur-dessous": ([s, cm]) => `1 homme sur ${frInt(sig2(100 / rawPercentile(series(s), num(cm, "cm"))))}`,
  // {{attendus:erect-length:17}} → nombre d'hommes que le modèle attend au-delà de 17 cm dans l'échantillon publié (effectif × part au-dessus)
  attendus: ([s, cm]) => {
    const k = series(s);
    return frInt(Math.round((seriesRef(k).n * (100 - rawPercentile(k, num(cm, "cm")))) / 100));
  },
  // {{dans-sigma:1}} → part de la population à moins de k écarts-types de la moyenne (loi normale), une décimale
  "dans-sigma": ([k]) => `${f1((normalCdf(num(k, "k")) - normalCdf(-num(k, "k"))) * 100)} %`,
  // {{pct-sigma:1}} → percentile d'une valeur située k écarts-types au-dessus de la moyenne, une décimale, sans « % »
  "pct-sigma": ([k]) => f1(normalCdf(num(k, "k")) * 100),
  // {{borne-basse}}, {{borne-haute}} → bornes d'affichage des percentiles du rapport
  "borne-basse": () => f1(clampPercentile(0)),
  "borne-haute": () => f1(clampPercentile(100)),
  // {{pouces:18}} → « 7,1 pouces » ; {{pouces-en-cm:7}} → « 17,78 cm » (1 pouce = 2,54 cm exactement)
  pouces: ([cm]) => `${f1(num(cm, "cm") / CM_PER_INCH)} pouces`,
  "pouces-en-cm": ([inch]) => `${frNumber(num(inch, "pouces") * CM_PER_INCH)} cm`,
  // {{max-sigma}} → nombre d'écarts-types au-delà duquel le questionnaire refuse une valeur
  "max-sigma": () => String(MAX_SIGMA),
};

export const TOKEN_NAMES = Object.keys(TOKENS);

/** Évalue un jeton (« nom:arg1:arg2 »). Lève FigureError si le nom ou les arguments sont invalides. */
export function evalFigure(expr: string): string {
  const [name, ...args] = expr.split(":");
  const fn = TOKENS[name];
  if (!fn) throw new FigureError(`jeton inconnu « ${name} » (disponibles : ${TOKEN_NAMES.join(", ")})`);
  return fn(args);
}

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Remplace tous les jetons {{…}} d'un texte. `where` sert au message d'erreur (fichier, champ). */
export function resolveFigureTokens(text: string, where: string): string {
  return text.replace(TOKEN_RE, (_, expr: string) => {
    try {
      return evalFigure(expr);
    } catch (e) {
      throw new FigureError(`${where} : {{${expr}}} : ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}
