import { z } from "zod";
import { MORPHO } from "@/config/site";
import { INDICATOR_KEYS, INDICATOR_LABELS, lowIndicators, needsMedicalSentence, type IndicatorKey, type MorphoIndicators } from "../morpho";
import { SECTION_KEYS, SECTION_TITLES, type ReportText, type SectionKey } from "../morphoText";
import { PHOTO_REPORT_V2 } from "./schema2";

// Rapport rédigé (appel texte, sans la photo), version photo-report/2 : une clé par rubrique, JSON strict.
// Après chaque rédaction, le CODE vérifie le texte. Deux familles de règles :
//  - règles « strictes » (les interdits du cahier des charges, et l'usage exclusif des valeurs fournies) : toute violation entraîne
//    une relance ; violation encore présente après la relance : échec technique, rapport partiel ;
//  - règles « souples » (longueur totale, nombre de phrases, répétitions) : une relance ; après la relance, un texte qui ne viole
//    plus que des règles souples est accepté (un rapport complet vaut mieux qu'un rapport partiel pour quelques mots d'écart).
// La relance transmet au modèle la liste des règles violées.

export { SECTION_KEYS, SECTION_TITLES, type ReportText, type SectionKey } from "../morphoText";

/** Schéma JSON envoyé à l'API. La liste des indicateurs admis pour les points remarquables est propre à chaque rapport. */
export function reportTextJsonSchema(allowedHighlights: readonly IndicatorKey[]) {
  const str = { type: "string" } as const;
  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "synthese", "appreciations", ...SECTION_KEYS, "points_remarquables", "conclusion", "note_laboratoire"],
    properties: {
      schemaVersion: { type: "string", enum: [PHOTO_REPORT_V2] },
      synthese: str,
      appreciations: {
        type: "object",
        additionalProperties: false,
        required: [...INDICATOR_KEYS],
        properties: Object.fromEntries(INDICATOR_KEYS.map((k) => [k, str])),
      },
      ...Object.fromEntries(SECTION_KEYS.map((k) => [k, str])),
      points_remarquables: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["indicateur", "texte"],
          properties: { indicateur: { type: "string", enum: [...allowedHighlights] }, texte: str },
        },
      },
      conclusion: str,
      note_laboratoire: str,
    },
  } as const;
}

// ---------- Analyse du texte ----------

const norm = (s: string) => s.toLowerCase().normalize("NFC");

/** Nombre de mots (lettres ou chiffres, apostrophes et traits d'union internes compris ; un nombre décimal compte pour un mot). */
export function wordCount(text: string): number {
  return (text.replace(/(\d)[.,](\d)/g, "$1$2").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Nombre de phrases (abréviations courantes et nombres décimaux protégés). */
export function sentenceCount(text: string): number {
  const t = text
    .trim()
    .replace(/(?<![\p{L}])(et al|cf|etc|env|ex|réf|fig|vol)\./giu, "$1§")
    .replace(/(\d)\.(\d)/g, "$1§$2");
  if (!/\p{L}/u.test(t)) return 0;
  return t.split(/(?<=[.!?…])\s+(?=[«"(]?[\p{Lu}\d])/u).filter((s) => /\p{L}/u.test(s)).length;
}

/** Tous les textes du rapport, dans l'ordre de lecture. */
export function allTexts(t: ReportText): string[] {
  return [
    t.synthese,
    ...INDICATOR_KEYS.map((k) => t.appreciations[k]),
    ...SECTION_KEYS.map((k) => t[k]),
    ...t.points_remarquables.map((p) => p.texte),
    t.conclusion,
    t.note_laboratoire,
  ];
}

export const reportWordCount = (t: ReportText): number => allTexts(t).reduce((s, x) => s + wordCount(x), 0);

const words = (list: string) => list.split(/\s+/).filter(Boolean);
/** Mot entier (forme exacte, accents compris). */
const wholeWords = (list: string) => new RegExp(`(?<![\\p{L}])(?:${words(list).join("|")})(?![\\p{L}])`, "iu");
/** Début de mot (radical). */
const stems = (list: string) => new RegExp(`(?<![\\p{L}])(?:${words(list).join("|")})`, "iu");

type Rule = { id: string; label: string; re: RegExp; outsideNoteOnly?: boolean };

/** Interdits du cahier des charges (règles strictes), vérifiés sur tout le texte (sauf mention contraire). */
export const FORBIDDEN_RULES: readonly Rule[] = [
  {
    id: "denigrement",
    label: "mot dévalorisant (court, petit, faible, insuffisant, anormal, défaut, malformation ou dénigrement)",
    re: wholeWords(
      "court courte courts courtes petit petite petits petites faible faibles faiblesse faiblement insuffisant insuffisante insuffisants insuffisantes insuffisance " +
        "anormal anormale anormaux anormales anomalie anomalies défaut défauts défectueux défectueuse malformation malformations difforme difformité " +
        "déformation déformations déformé déformée médiocre médiocres décevant décevante décevants décevantes ridicule ridicules minuscule minuscules " +
        "chétif chétive maigre maigres modeste modestes raté ratée honte honteux disgracieux disgracieuse laid laide moche mauvais mauvaise déficit déficient déficiente",
    ),
  },
  {
    id: "vulgarite",
    label: "terme vulgaire",
    re: wholeWords("bite bites zob queue chibre teub kiki braquemart pine bander bandaison couille couilles burne burnes engin"),
  },
  {
    id: "couleur",
    label: "couleur ou teinte",
    re: wholeWords(
      "couleur couleurs coloré colorée colorés colorées coloration colorations teinte teintes teinté teintée teint pigmentation pigmenté pigmentée pigments carnation " +
        "rose roses rosé rosée rosâtre rouge rouges rougeâtre rougeur rougeurs rougi rougie violet violette violets violacé violacée violacés pourpre brun brune bruns brunâtre " +
        "marron beige foncé foncée foncés foncées pâle pâles bleu bleue bleus bleues bleuté bleutée bleutées noir noire noirs noires blanc blanche blancs blanches blanchâtre " +
        "hâlé hâlée bronzé cuivré cuivrée doré dorée nacré nacrée livide sombre sombres",
    ),
  },
  {
    id: "prepuce",
    label: "prépuce, gland couvert ou découvert, circoncision",
    re: stems("prépuce préputial circonci décalott recalott calotte phimosis paraphimosis découvert recouvert recouvr couvert couverte"),
  },
  {
    id: "corps_voisin",
    label: "partie du corps voisine",
    re: wholeWords(
      "testicule testicules testiculaire scrotum scrotal scrotale bourses pubis pubien pubienne pubiens pubiennes cuisse cuisses ventre abdomen abdominal abdominale " +
        "aine aines périnée nombril main mains doigt doigts jambe jambes fesse fesses hanche hanches anus torse bassin",
    ),
  },
  {
    id: "prise_de_vue",
    label: "éclairage, cadrage, posture ou pesanteur",
    re: new RegExp(
      `${wholeWords(
        "éclairage éclairages éclairé éclairée éclairés lumière lumières lumineux lumineuse luminosité ombre ombres ombrage reflet reflets cadrage cadré cadrée cadrés cadrer " +
          "posture postures pesanteur gravité gravitation flou floue flous netteté",
      ).source}|prise de vue|angle de vue`,
      "iu",
    ),
  },
  {
    id: "precaution",
    label: "précaution sur la précision (réservée à la Note du laboratoire)",
    re: new RegExp(
      `${stems("approximati imprécis imprécision incertitude").source}|${wholeWords(
        "environ marge marges précision précisions fiabilité fiable fiables indicatif indicative prudence prudent prudente",
      ).source}|à peu près|sous réserve|à confirmer|ne remplace|ne saurait`,
      "iu",
    ),
    outsideNoteOnly: true,
  },
  {
    id: "diagnostic",
    label: "diagnostic ou vocabulaire pathologique",
    re: stems("diagnosti patholog maladie peyronie dysfonction symptôm lésion chirurg fibrose induration traitement trouble"),
  },
];

/** Vocabulaire médical, admis seulement pour la phrase d'avis médical (courbure de 30° ou plus). */
const MEDICAL_WORDS = stems("médic médecin urolog santé consult");
const MEDICAL_SENTENCE = /avis médical|professionnel de santé|médecin|urologue/iu;

/** Valeurs que le texte a le droit de citer (toutes fournies par le code). */
export function citableNumbers(ind: MorphoIndicators): number[] {
  const out = new Set<number>([100, 50, 2015, 85.6, 53.98]);
  const add = (n: number, decimals = 1) => out.add(Math.round(n * 10 ** decimals) / 10 ** decimals);
  add(ind.longueurCm);
  add(ind.circonferenceCm);
  for (const p of [ind.percentileLongueur, ind.percentileCirconference]) {
    if (p === null) continue;
    add(p);
    out.add(Math.round(p));
    out.add(100 - Math.round(p));
  }
  add(ind.medianeLongueurCm);
  add(ind.medianeLongueurCm, 2);
  add(ind.medianeCirconferenceCm);
  add(ind.medianeCirconferenceCm, 2);
  for (const n of [ind.courbureDeg, ind.rectitude, ind.symetrie, ind.conicite, ind.typicite, ind.score]) out.add(n);
  add(ind.ratioConicite, 2);
  add(ind.rapportGland, 2);
  out.add(Math.round(ind.rapportGland * 100));
  if (needsMedicalSentence(ind)) out.add(30);
  return [...out];
}

/** Nombres écrits en chiffres dans un texte (virgule ou point décimal). */
export const numbersIn = (text: string): number[] => (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((s) => Number(s.replace(",", ".")));

/** Mots d'un texte, en minuscules ; l'article ou la particule élidés (« l' », « d' »…) ne comptent pas comme un mot. */
const tokens = (text: string): string[] =>
  norm(text)
    .replace(/(?<![\p{L}])(?:l|d|qu|n|s|c|j|m|t|jusqu|lorsqu|puisqu)['’]/gu, " ")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Expressions de plus de trois mots (suites de 4 mots) qui reviennent plus de deux fois. Les noms des indicateurs ne comptent pas. */
export function repeatedExpressions(texts: string[]): string[] {
  const exempt = new Set<string>();
  for (const label of Object.values(INDICATOR_LABELS)) {
    const w = tokens(label);
    for (let i = 0; i + 4 <= w.length; i++) exempt.add(w.slice(i, i + 4).join(" "));
  }
  const counts = new Map<string, number>();
  for (const t of texts) {
    const w = tokens(t);
    for (let i = 0; i + 4 <= w.length; i++) {
      const g = w.slice(i, i + 4).join(" ");
      if (!exempt.has(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts].filter(([, n]) => n > 2).map(([g]) => g);
}

const occurrences = (texts: string[], re: RegExp) => texts.reduce((s, t) => s + (norm(t).match(new RegExp(re.source, "giu"))?.length ?? 0), 0);

// ---------- Validation ----------

const nonEmpty = (max: number) => z.string().trim().min(2).max(max);

const reportTextShape = (allowed: readonly IndicatorKey[]) =>
  z.object({
    schemaVersion: z.literal(PHOTO_REPORT_V2),
    synthese: nonEmpty(900),
    appreciations: z.object(Object.fromEntries(INDICATOR_KEYS.map((k) => [k, nonEmpty(220)])) as Record<IndicatorKey, ReturnType<typeof nonEmpty>>),
    ...(Object.fromEntries(SECTION_KEYS.map((k) => [k, nonEmpty(1400)])) as Record<SectionKey, ReturnType<typeof nonEmpty>>),
    points_remarquables: z
      .array(z.object({ indicateur: z.enum(allowed as [IndicatorKey, ...IndicatorKey[]]), texte: nonEmpty(320) }))
      .length(3)
      .refine((l) => new Set(l.map((p) => p.indicateur)).size === 3, { message: "trois indicateurs distincts" }),
    conclusion: nonEmpty(600),
    note_laboratoire: nonEmpty(400),
  });

export type TextCheckContext = { indicators: MorphoIndicators; allowedHighlights: readonly IndicatorKey[] };

export type TextCheck =
  | { ok: true; value: ReportText; soft: string[] }
  | { ok: false; hard: string[]; soft: string[]; value: ReportText | null };

/**
 * Vérifie un rapport rédigé. `hard` : interdits violés (relance, puis échec) ; `soft` : écarts de forme (relance, puis accepté).
 * `ok` est vrai quand aucune règle stricte n'est violée (les écarts souples sont renvoyés à part).
 */
export function checkReportText(raw: unknown, ctx: TextCheckContext): TextCheck {
  const parsed = reportTextShape(ctx.allowedHighlights).safeParse(raw);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 4).map((i) => i.path.join(".") || "racine");
    return { ok: false, hard: [`structure JSON non conforme (${where.join(", ")})`], soft: [], value: null };
  }
  const { schemaVersion: _v, ...rest } = parsed.data;
  void _v;
  const t = rest as ReportText;
  const ind = ctx.indicators;
  const hard: string[] = [];
  const soft: string[] = [];

  const texts = allTexts(t);
  const outsideNote = texts.slice(0, -1);
  for (const rule of FORBIDDEN_RULES) {
    const scope = rule.outsideNoteOnly ? outsideNote : texts;
    const hit = scope.map((x) => x.match(rule.re)?.[0]).find(Boolean);
    if (hit) hard.push(`interdit : ${rule.label} (« ${hit} »)`);
  }

  // Avis médical : exigé dans « Axe et courbure » à partir de 30°, et nulle part ailleurs ; aucun vocabulaire médical en dessous.
  if (needsMedicalSentence(ind)) {
    if (!MEDICAL_SENTENCE.test(t.axe_courbure)) hard.push("courbure de 30° ou plus : la rubrique « Axe et courbure » doit contenir une phrase sobre suggérant un avis médical");
    const elsewhere = texts.filter((x) => x !== t.axe_courbure).map((x) => x.match(MEDICAL_WORDS)?.[0]).find(Boolean);
    if (elsewhere) hard.push(`vocabulaire médical hors de « Axe et courbure » (« ${elsewhere} »)`);
  } else {
    const hit = texts.map((x) => x.match(MEDICAL_WORDS)?.[0]).find(Boolean);
    if (hit) hard.push(`vocabulaire médical alors que la courbure est inférieure à 30° (« ${hit} »)`);
  }

  // Au repos : la Note indique qu'une observation en érection donne une lecture complète des dimensions.
  if (ind.state === "rest" && !/érection/iu.test(t.note_laboratoire)) hard.push("état « repos » : la Note du laboratoire doit indiquer qu'une observation en érection donne une lecture complète des dimensions");

  // « Gabarit compact » : une seule mention, et seulement pour une valeur basse.
  const compact = occurrences(texts, /gabarit compact/);
  const maxCompact = lowIndicators(ind).length > 0 ? 1 : 0;
  if (compact > maxCompact) hard.push(maxCompact === 0 ? "« gabarit compact » est réservé à une valeur basse (aucune ici)" : "« gabarit compact » ne doit apparaître qu'une fois");

  // Valeurs : uniquement celles fournies par le code (le modèle ne recalcule rien).
  const allowed = citableNumbers(ind);
  const foreign = [...new Set(texts.flatMap(numbersIn))].filter((n) => !allowed.some((a) => Math.abs(a - n) < 1e-6));
  if (foreign.length) hard.push(`valeurs non fournies (recalculées ou inventées) : ${foreign.slice(0, 5).map((n) => String(n).replace(".", ",")).join(", ")}`);

  // Règles souples : longueur, phrases, répétitions.
  const n = reportWordCount(t);
  if (n < MORPHO.reportWords.min || n > MORPHO.reportWords.max) soft.push(`longueur : ${n} mots (attendu de ${MORPHO.reportWords.min} à ${MORPHO.reportWords.max})`);
  const sc = sentenceCount;
  if (sc(t.synthese) !== 3) soft.push(`synthèse : ${sc(t.synthese)} phrase(s) au lieu de 3`);
  for (const k of SECTION_KEYS) {
    const c = sc(t[k]);
    if (c < 3 || c > 5) soft.push(`${SECTION_TITLES[k]} : ${c} phrase(s) au lieu de 3 à 5`);
  }
  t.points_remarquables.forEach((p, i) => {
    if (sc(p.texte) !== 1) soft.push(`point remarquable ${i + 1} : une seule phrase attendue`);
  });
  if (sc(t.conclusion) !== 2) soft.push(`conclusion : ${sc(t.conclusion)} phrase(s) au lieu de 2`);
  if (sc(t.note_laboratoire) !== 1) soft.push("Note du laboratoire : une seule phrase attendue");
  const rep = repeatedExpressions(texts);
  if (rep.length) soft.push(`expressions répétées plus de deux fois : ${rep.slice(0, 3).map((g) => `« ${g} »`).join(", ")}`);
  if (occurrences(texts, /variante de la normale/) > 1) soft.push("« variante de la normale » plus d'une fois");

  return hard.length ? { ok: false, hard, soft, value: t } : { ok: true, value: t, soft };
}
