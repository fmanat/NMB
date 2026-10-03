// Kit de test photo du propriétaire (bloc 7 de la session de nuit 4) : logique de `npm run photo:test` et `npm run photo:supprimer`.
//
// Principe : exécuter, EN LOCAL, la chaîne réelle de la formule B (mêmes modules que le site, moteur photo-report/2 : réencodage,
// appel vision, mesure calibrée sur la carte ou estimation, calculs par le code, rédaction vérifiée, relances uniques) sur UNE photo posée dans
// photos-test/ (dossier ignoré par git), et n'afficher que du TEXTE.
//
// Garanties (testées par tests/photo-test.test.ts) :
//  - le chemin de la photo doit être dans photos-test/ (ni dehors, ni lien symbolique, ni dossier) ; le dossier doit être ignoré par git ;
//  - la photo n'est lue qu'en mémoire : jamais réécrite, jamais copiée, jamais affichée ; aucun octet ni base64 dans la sortie ;
//    le nom du fichier n'est jamais imprimé ;
//  - aucune écriture en base : le flux d'analyse reçoit un « magasin » en mémoire (option « sans base », la seule disponible) ;
//  - le mode réel refuse de démarrer si le coût estimé de la session ferait dépasser XAI_DAILY_CAP_USD (cumul du jour tenu dans un petit
//    fichier local texte, `.photo-test-depenses.json`, ignoré par git, qui ne contient que des dollars) ;
//  - le mode simulation utilise l'API simulée (aucun réseau, aucun coût) ; c'est le seul mode que les tests et l'assistant exécutent.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { aiPricing, LIMITS, MARGIN } from "@/config/site";
import { runAnalysis, STANDARD_VERSIONS, type CalibrationPair, type FlowDeps, type FlowEvent, type FlowInput, type FlowStore } from "@/lib/analyseFlow";
import { INDICATOR_KEYS, INDICATOR_LABELS, indicatorValue } from "@/lib/morpho";
import { PARTIAL_LABEL } from "@/lib/photoReport2";
import { profileFor } from "@/lib/profiles";
import { SECTION_KEYS, SECTION_TITLES, reportWordCount } from "@/lib/vision/reportText";
import type { ReportResults } from "@/lib/reportCore";
import { createSimulatedVision } from "@/lib/vision/simulation";
import { VisionError, type Usage, type VisionProvider } from "@/lib/vision/types";
import { DEFAULT_TEXT_MODEL, xaiVision } from "@/lib/vision/xai";
import { dailyCapUsd, ESTIMATED_ANALYSIS_USD, parisDay, toMicros, usageCostMicros, type Reservation, type SpendGate } from "@/lib/xaiSpend";
import type { BodyState } from "@/lib/stats";
import sharp from "sharp";

export const PHOTOS_DIR = "photos-test";
export const LEDGER_FILE = ".photo-test-depenses.json";
export const ALLOWED_EXT = [".jpg", ".jpeg", ".png"] as const;

type Env = Record<string, string | undefined>;

// ---------------------------------------------------------------------------------------------------------------------------
// Garde de chemin et de git
// ---------------------------------------------------------------------------------------------------------------------------

export class PhotoTestError extends Error {
  constructor(
    public code: "hors-dossier" | "introuvable" | "lien" | "dossier" | "extension" | "git" | "arguments" | "plafond" | "cle" | "env" | "base",
    message: string,
  ) {
    super(message);
  }
}

const isOutside = (rel: string) => rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);

/**
 * Chemin absolu réel (liens résolus) d'une photo, à condition qu'elle soit un fichier ordinaire d'image DANS photos-test/.
 * Le message d'erreur ne répète jamais le nom du fichier.
 */
export function resolvePhotoPath(input: string, root: string, cwd: string = process.cwd()): string {
  if (!input || input.includes("\0")) throw new PhotoTestError("arguments", "Chemin de photo vide ou invalide.");
  const dir = resolve(root, PHOTOS_DIR);
  const abs = resolve(cwd, input);
  const rel = relative(dir, abs);
  if (rel === "" || isOutside(rel)) {
    throw new PhotoTestError("hors-dossier", `Refusé : la photo doit se trouver dans le dossier « ${PHOTOS_DIR}/ » du projet (dossier ignoré par git). Rien n'a été lu.`);
  }
  if (!existsSync(dir)) throw new PhotoTestError("introuvable", `Le dossier « ${PHOTOS_DIR}/ » n'existe pas : créez-le puis copiez-y la photo.`);
  if (lstatSync(dir).isSymbolicLink()) throw new PhotoTestError("lien", `Refusé : « ${PHOTOS_DIR}/ » ne doit pas être un lien symbolique : le dossier doit être un vrai dossier du projet.`);
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    throw new PhotoTestError("introuvable", `Fichier introuvable dans « ${PHOTOS_DIR}/ ». Vérifiez le nom (majuscules et extension comprises).`);
  }
  if (st.isSymbolicLink()) throw new PhotoTestError("lien", "Refusé : un lien symbolique n'est pas accepté (la photo doit être le fichier lui-même, dans photos-test/).");
  if (!st.isFile()) throw new PhotoTestError("dossier", "Refusé : ce chemin n'est pas un fichier.");
  const real = realpathSync(abs);
  if (isOutside(relative(realpathSync(dir), real))) {
    throw new PhotoTestError("hors-dossier", `Refusé : la photo doit se trouver dans le dossier « ${PHOTOS_DIR}/ » du projet. Rien n'a été lu.`);
  }
  if (!(ALLOWED_EXT as readonly string[]).includes(extname(real).toLowerCase())) {
    throw new PhotoTestError("extension", `Refusé : seules les photos .jpg, .jpeg et .png sont acceptées.`);
  }
  return real;
}

/** Le dossier photos-test/ est-il ignoré par git ? (`git check-ignore`, avec repli sur la lecture de .gitignore si git est absent.) */
export function isPhotosDirGitIgnored(root: string): boolean {
  const probe = `${PHOTOS_DIR}/photo-de-controle.jpg`;
  const r = spawnSync("git", ["check-ignore", "-q", "--", probe], { cwd: root });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  try {
    const lines = readFileSync(join(root, ".gitignore"), "utf8").replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim());
    return lines.some((l) => l === `/${PHOTOS_DIR}/` || l === `${PHOTOS_DIR}/` || l === `/${PHOTOS_DIR}` || l === PHOTOS_DIR);
  } catch {
    return false;
  }
}

export function assertPhotosDirIgnored(root: string): void {
  if (!isPhotosDirGitIgnored(root)) {
    throw new PhotoTestError("git", `Refusé : le dossier « ${PHOTOS_DIR}/ » n'est PAS ignoré par git (.gitignore). Ajoutez la ligne « /${PHOTOS_DIR}/ » à .gitignore avant tout test.`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Suppression propre
// ---------------------------------------------------------------------------------------------------------------------------

/** Écrase le contenu (une passe aléatoire, une passe de zéros), puis supprime le fichier. Aucune sortie ne répète le nom. */
export function secureDelete(path: string): void {
  const st = lstatSync(path);
  if (!st.isFile()) throw new PhotoTestError("dossier", "Suppression refusée : ce n'est pas un fichier ordinaire.");
  const fd = openSync(path, "r+");
  try {
    for (const pass of ["random", "zero"] as const) {
      let left = st.size;
      let pos = 0;
      while (left > 0) {
        const n = Math.min(left, 1 << 20);
        writeSync(fd, pass === "random" ? randomBytes(n) : Buffer.alloc(n), 0, n, pos);
        pos += n;
        left -= n;
      }
      fsyncSync(fd);
    }
  } finally {
    closeSync(fd);
  }
  unlinkSync(path);
}

/** Nombre d'entrées restant dans photos-test/ (0 si le dossier n'existe pas). Les noms ne sont jamais renvoyés. */
export function remainingInPhotosDir(root: string): number {
  const dir = resolve(root, PHOTOS_DIR);
  return existsSync(dir) ? readdirSync(dir).length : 0;
}

/** Supprime tous les fichiers ordinaires de photos-test/ (écrasement puis suppression). Renvoie le nombre supprimé. Ne touche à rien d'autre. */
export function secureDeleteAll(root: string): number {
  const dir = resolve(root, PHOTOS_DIR);
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isFile()) {
      secureDelete(p);
      n++;
    } else if (st.isSymbolicLink()) {
      unlinkSync(p); // on retire le lien lui-même, jamais sa cible
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Cumul de dépense du jour (fichier local texte) et plafond
// ---------------------------------------------------------------------------------------------------------------------------

type Ledger = { days: Record<string, { spentMicros: number; analyses: number }> };

export function readLedger(path: string): Ledger {
  try {
    const j = JSON.parse(readFileSync(path, "utf8")) as Ledger;
    return j && typeof j.days === "object" && j.days ? j : { days: {} };
  } catch {
    return { days: {} };
  }
}

export const spentTodayMicros = (path: string, day: string): number => readLedger(path).days[day]?.spentMicros ?? 0;

export function recordSpend(path: string, day: string, micros: number): void {
  const l = readLedger(path);
  const cur = l.days[day] ?? { spentMicros: 0, analyses: 0 };
  l.days[day] = { spentMicros: cur.spentMicros + Math.max(0, Math.round(micros)), analyses: cur.analyses + 1 };
  writeFileSync(path, JSON.stringify(l, null, 2) + "\n");
}

export type CapCheck = { ok: true } | { ok: false; message: string };

/** Garde-fou du mode réel : dépensé aujourd'hui + coût estimé de la session ≤ plafond, sinon refus avant tout appel. */
export function checkSessionCap(args: { spentMicros: number; capUsd: number; estimateUsd: number }): CapCheck {
  const projected = args.spentMicros + toMicros(args.estimateUsd);
  if (projected <= toMicros(args.capUsd)) return { ok: true };
  return {
    ok: false,
    message: `Refusé : dépensé aujourd'hui ${usd(args.spentMicros)} + coût estimé de cette session ${usd(toMicros(args.estimateUsd))} = ${usd(projected)}, au-delà du plafond XAI_DAILY_CAP_USD (${usd(toMicros(args.capUsd))}). Aucun appel n'a été envoyé. Relevez le plafond dans .env ou revenez demain.`,
  };
}

/** Porte de dépense locale : réserve selon le cumul du fichier, règle le coût réel dans ce fichier (mode réel seulement). */
export function ledgerGate(ledgerPath: string, capUsd: number, now: () => Date = () => new Date()): SpendGate {
  return {
    async reserve(at = now()): Promise<Reservation> {
      const day = parisDay(at);
      const estimateMicros = toMicros(ESTIMATED_ANALYSIS_USD);
      const ok = checkSessionCap({ spentMicros: spentTodayMicros(ledgerPath, day), capUsd, estimateUsd: ESTIMATED_ANALYSIS_USD }).ok;
      return ok ? { ok: true, day, estimateMicros } : { ok: false, day };
    },
    async settle(r, actual) {
      if (!r.ok || actual.calls <= 0) return;
      recordSpend(ledgerPath, r.day, actual.costMicros);
    },
  };
}

/** Porte de dépense du mode simulation : toujours ouverte, ne retient rien (aucun coût). */
export const simulationGate: SpendGate = {
  async reserve(at = new Date()) {
    return { ok: true, day: parisDay(at), estimateMicros: 0 };
  },
  async settle() {},
};

// ---------------------------------------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------------------------------------

export type CliOptions = {
  file?: string;
  length?: number;
  girth?: number;
  state?: BodyState;
  simulation: boolean;
  delete: boolean;
  help: boolean;
};

/** Nombre saisi à la française (« 14,2 » ou « 14.2 »), fini et strictement positif ; sinon null. */
export function parseDecimal(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseState(raw: string): BodyState | null {
  const t = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (["erection", "erect", "erige"].includes(t)) return "erect";
  if (["repos", "rest", "flaccide"].includes(t)) return "rest";
  return null;
}

export const USAGE_TEXT = [
  "Test de la formule photo sur VOTRE photo, en local (voir docs/TEST-PHOTO.md).",
  "",
  "  npm run photo:test -- photos-test/ma-photo.jpg --etat erection --longueur 14,2 --circonference 12,1 [--supprimer]",
  "  npm run photo:test -- --simulation [--etat erection]        essai à blanc : API et photo simulées, aucun coût",
  "  npm run photo:supprimer -- photos-test/ma-photo.jpg         supprime une photo (écrasement puis suppression)",
  "  npm run photo:supprimer -- --tout                           supprime tout le contenu de photos-test/",
  "",
  "Options de photo:test",
  "  --etat erection|repos        état au moment de la photo (obligatoire)",
  "  --longueur N, --circonference N   vos mesures à la règle, en centimètres (facultatives, virgule ou point)",
  "  --supprimer                  supprime la photo (écrasement puis suppression) une fois l'analyse tentée",
  "  --simulation                 API et photo simulées (aucun réseau, aucun coût)",
  "  --sans-base                  aucune écriture en base (c'est déjà le comportement par défaut, la seule option)",
].join("\n");

export function parseCli(argv: string[]): CliOptions {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        etat: { type: "string" },
        longueur: { type: "string" },
        circonference: { type: "string" },
        simulation: { type: "boolean", default: false },
        supprimer: { type: "boolean", default: false },
        "sans-base": { type: "boolean", default: false },
        aide: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (e) {
    throw new PhotoTestError("arguments", `Option non reconnue : ${(e as Error).message.split("\n")[0]}`);
  }
  const v = parsed.values;
  const o: CliOptions = { simulation: v.simulation === true, delete: v.supprimer === true, help: v.aide === true || v.help === true };
  if (o.help) return o;
  if (parsed.positionals.length > 1) throw new PhotoTestError("arguments", "Une seule photo à la fois : un seul chemin attendu.");
  if (parsed.positionals[0]) o.file = parsed.positionals[0];
  if (v.etat !== undefined) {
    const s = parseState(v.etat);
    if (!s) throw new PhotoTestError("arguments", "--etat doit valoir « erection » ou « repos ».");
    o.state = s;
  }
  if (v.longueur !== undefined) {
    const n = parseDecimal(v.longueur);
    if (n === null || n < LIMITS.length.min || n > LIMITS.length.max) throw new PhotoTestError("arguments", `--longueur : nombre de centimètres entre ${LIMITS.length.min} et ${LIMITS.length.max} (ex. 14,2).`);
    o.length = n;
  }
  if (v.circonference !== undefined) {
    const n = parseDecimal(v.circonference);
    if (n === null || n < LIMITS.girth.min || n > LIMITS.girth.max) throw new PhotoTestError("arguments", `--circonference : nombre de centimètres entre ${LIMITS.girth.min} et ${LIMITS.girth.max} (ex. 12,1).`);
    o.girth = n;
  }
  if (!o.state) throw new PhotoTestError("arguments", "--etat est obligatoire (erection ou repos) : les percentiles dépendent de l'état.");
  if (!o.file && !o.simulation) throw new PhotoTestError("arguments", "Indiquez la photo (ex. photos-test/ma-photo.jpg), ou utilisez --simulation pour un essai à blanc.");
  return o;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Instrumentation du moteur de vision (durée, jetons et coût de chaque appel)
// ---------------------------------------------------------------------------------------------------------------------------

export type CallRecord = { kind: "analyse" | "redaction"; ms: number; usage: Usage | null; costMicros: number; error?: string };

export function instrumentVision(inner: VisionProvider, pricing: { inPerM: number; outPerM: number }, now: () => number = () => performance.now()): { vision: VisionProvider; calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const wrap = async <R extends { usage: Usage }>(kind: CallRecord["kind"], run: () => Promise<R>): Promise<R> => {
    const t0 = now();
    try {
      const r = await run();
      calls.push({ kind, ms: now() - t0, usage: r.usage, costMicros: usageCostMicros(r.usage, pricing) });
      return r;
    } catch (e) {
      calls.push({ kind, ms: now() - t0, usage: null, costMicros: 0, error: e instanceof VisionError ? e.kind : "erreur" });
      throw e;
    }
  };
  const vision: VisionProvider = {
    id: inner.id,
    analyse: (jpeg) => wrap("analyse", () => inner.analyse(jpeg)),
    writeReport: (input) => wrap("redaction", () => inner.writeReport(input)),
  };
  return { vision, calls };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Exécution de la chaîne
// ---------------------------------------------------------------------------------------------------------------------------

export type StepTiming = { label: string; ms: number };

export type PhotoTestResult = {
  status: "ok" | "refused" | "error";
  /** Motif technique d'un refus (liste fermée du site) ou code d'erreur ; jamais d'image. */
  motif?: string;
  message?: string;
  results?: ReportResults;
  /** Paire de calibration (mesure par la carte, estimation sans la carte) si la mesure a été calibrée. */
  pair?: CalibrationPair;
  /** Carte présente et lisible mais écartée par le calcul (motif technique) : la taille reste estimée visuellement. */
  calibrationSkipped?: string;
  steps: StepTiming[];
  calls: CallRecord[];
  totalMs: number;
  tokensIn: number;
  tokensOut: number;
  requests: number;
  retries: number;
  costMicros: number;
};

type Captured = { results?: ReportResults; motif?: string; outcome?: string; pair?: CalibrationPair; calibrationSkipped?: string };

/** Magasin en mémoire : le flux d'analyse n'écrit rien en base ; on capture seulement le résultat et le motif de refus. */
function memoryStore(captured: Captured): FlowStore {
  return {
    hashIp: () => "test-local",
    countAttemptsByIp: async () => 0,
    startAttempt: async () => 1,
    finishAttempt: async (_id, r) => {
      captured.outcome = r.outcome;
      captured.motif = r.motif;
    },
    createReport: async (args) => {
      captured.results = args.results;
      return "rapport-local";
    },
    saveCalibrationPair: async (p) => {
      captured.pair = p;
    },
  };
}

/** Filtrage local : aucun (comme le site sans prestataire), sans écrire dans les journaux. */
const noScreening = { id: "none", screen: async () => ({ blocked: false }) };
/** Le contrôle anti-robot n'a pas de sens pour un test local lancé par le propriétaire. */
const localCaptcha = { id: "local", verify: async () => true };

export async function runPhotoTest(args: {
  photo: Buffer;
  state: BodyState;
  vision: VisionProvider;
  spend: SpendGate;
  pricing?: { inPerM: number; outPerM: number };
  now?: () => number;
}): Promise<PhotoTestResult> {
  const now = args.now ?? (() => performance.now());
  const pricing = args.pricing ?? aiPricing();
  const captured: Captured = {};
  const { vision, calls } = instrumentVision(args.vision, pricing, now);
  const deps: FlowDeps = { vision, screening: noScreening, captcha: localCaptcha, spend: args.spend, store: memoryStore(captured) };
  const input: FlowInput = {
    formula: "B",
    state: args.state,
    consents: { adult: true, mine: true, sensitive: true },
    ageTokenValid: true,
    captchaToken: null,
    ip: "127.0.0.1",
    photo: args.photo,
  };

  const events: { e: FlowEvent; t: number }[] = [];
  const t0 = now();
  // Le flux journalise des événements techniques (motifs, versions) : on les retient hors de la sortie du script.
  const saved = { info: console.info, warn: console.warn, log: console.log };
  console.warn = console.log = () => {};
  // Seul le motif d'une carte écartée est retenu (pour l'affichage) ; rien d'autre n'est lu ni affiché.
  console.info = (line?: unknown) => {
    try {
      const j = JSON.parse(String(line)) as { event?: string; motif?: string };
      if (j.event === "calibration_skipped" && typeof j.motif === "string") captured.calibrationSkipped = j.motif;
    } catch {
      /* ligne non JSON : ignorée */
    }
  };
  try {
    for await (const e of runAnalysis(input, deps)) events.push({ e, t: now() });
  } finally {
    console.info = saved.info;
    console.warn = saved.warn;
    console.log = saved.log;
  }
  const end = now();

  const steps: StepTiming[] = [];
  const stepEvents = events.filter((x) => x.e.type === "step");
  const firstStepT = stepEvents[0]?.t ?? end;
  if (stepEvents.length) steps.push({ label: "Préparation de l'image (réencodage)", ms: firstStepT - t0 });
  events.forEach((x, i) => {
    if (x.e.type !== "step") return;
    const next = events[i + 1]?.t ?? end;
    steps.push({ label: x.e.label, ms: next - x.t });
  });

  const last = events[events.length - 1]?.e;
  let status: PhotoTestResult["status"] = "error";
  let message: string | undefined;
  let motif: string | undefined = captured.motif;
  if (last?.type === "ready") status = "ok";
  else if (last?.type === "refused") {
    status = "refused";
    message = last.message;
  } else if (last?.type === "error") {
    message = last.message;
    motif = motif ?? last.code;
  }

  const usages = calls.map((c) => c.usage).filter((u): u is Usage => u !== null);
  const analyseCalls = calls.filter((c) => c.kind === "analyse").length;
  const commentCalls = calls.filter((c) => c.kind === "redaction").length;
  return {
    status,
    motif,
    message,
    results: captured.results,
    pair: captured.pair,
    calibrationSkipped: captured.calibrationSkipped,
    steps,
    calls,
    totalMs: end - t0,
    tokensIn: usages.reduce((s, u) => s + u.tokensIn, 0),
    tokensOut: usages.reduce((s, u) => s + u.tokensOut, 0),
    requests: usages.reduce((s, u) => s + u.calls, 0),
    retries: Math.max(0, analyseCalls - 1) + Math.max(0, commentCalls - 1),
    costMicros: calls.reduce((s, c) => s + c.costMicros, 0),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Comparaison avec la règle et mise en forme (texte seulement)
// ---------------------------------------------------------------------------------------------------------------------------

export type RulerGap = { estimated: number; ruler: number; gapCm: number; gapPct: number; marginPct: number; withinMargin: boolean };

/** Écart (estimé − règle) en cm et en % de la mesure à la règle (même convention que docs/CALIBRATION.md) ; dans la marge affichée ? */
export function compareToRuler(estimated: number, ruler: number, marginPct: number): RulerGap {
  const gapCm = estimated - ruler;
  const gapPct = (gapCm / ruler) * 100;
  return { estimated, ruler, gapCm, gapPct, marginPct, withinMargin: Math.round(Math.abs(gapPct) * 10) / 10 <= marginPct }; // comparé tel qu'affiché (une décimale)
}

const f1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${f1(Math.abs(n))}`;
export const usd = (micros: number): string => `${(micros / 1e6).toFixed(4).replace(".", ",")} $`;
const sec = (ms: number) => `${f1(ms / 1000)} s`;

export function formatReport(args: {
  mode: "reel" | "simulation";
  state: BodyState;
  result: PhotoTestResult;
  rulerLength?: number;
  rulerGirth?: number;
  modelLabel: string;
  pricing: { inPerM: number; outPerM: number };
  capUsd: number;
  spentTodayMicros: number | null;
  deleted?: { done: boolean; remaining: number };
}): string[] {
  const { result: r } = args;
  const out: string[] = [];
  const stateLabel = args.state === "erect" ? "en érection" : "au repos";
  out.push(`Test photo, formule B · mode ${args.mode === "reel" ? "RÉEL (vrai moteur xAI)" : "SIMULATION (API et photo simulées : aucun coût)"}`);
  out.push(`Schéma ${STANDARD_VERSIONS.schemaVersion} · prompts ${STANDARD_VERSIONS.promptVersion} · ${args.modelLabel} · état déclaré : ${stateLabel}`);
  out.push("");

  const morpho = r.results?.morpho;
  if (r.status === "ok" && morpho?.partielle) {
    out.push(`RÉSULTAT : RAPPORT PARTIEL (« ${PARTIAL_LABEL} »)`);
    if (r.motif) out.push(`  Cause technique : ${r.motif}`);
    out.push("  Le site afficherait un rapport générique construit sur les valeurs de référence de l'état déclaré, sans aucune mesure, avec un conseil de reprise.");
    out.push("");
  } else if (r.status === "ok" && morpho?.indicateurs) {
    const ind = morpho.indicateurs;
    const t = morpho.texte;
    out.push(`RAPPORT D'ANALYSE MORPHOMÉTRIQUE N° ${morpho.numero}`);
    out.push(
      `  État observé : ${ind.state === "rest" ? "repos" : "érection"} · méthode : ${morpho.methode === "calibree" ? "mesure calibrée (badge « Taille calibrée »)" : "estimation visuelle"}${
        r.calibrationSkipped ? ` (carte détectée mais écartée par le calcul : ${r.calibrationSkipped})` : ""
      }`,
    );
    out.push(`  Score global : ${ind.score}/100${ind.percentileLongueur !== null ? ` · profil morphologique : ${profileFor(ind.percentileLongueur, ind.percentileCirconference).name}` : " · pas de profil au repos (aucun percentile de longueur)"}`);
    out.push("");

    if (args.rulerLength !== undefined || args.rulerGirth !== undefined) {
      out.push("ÉCART AVEC VOS MESURES À LA RÈGLE (estimé − règle ; % de la mesure à la règle)");
      const line = (label: string, g: RulerGap) =>
        out.push(`  ${label} : ${morpho.methode === "calibree" ? "mesurée" : "estimée"} ${f1(g.estimated)} cm · règle ${f1(g.ruler)} cm · écart ${signed(g.gapCm)} cm (${signed(g.gapPct)} %) · dans ± ${f1(g.marginPct)} % : ${g.withinMargin ? "oui" : "NON"}`);
      if (args.rulerLength !== undefined) line("Longueur", compareToRuler(ind.longueurCm, args.rulerLength, MARGIN.floorPct));
      if (args.rulerGirth !== undefined) line("Circonférence", compareToRuler(ind.circonferenceCm, args.rulerGirth, MARGIN.floorPct));
      if (r.pair) {
        out.push(`  Estimation du modèle SANS la carte : longueur ${f1(r.pair.modelLengthCm)} cm, circonférence ${f1(r.pair.modelGirthCm)} cm (paire de calibration ; le site la conserverait, sans rien d'autre)`);
        if (args.rulerLength !== undefined) line("Longueur sans carte", compareToRuler(r.pair.modelLengthCm, args.rulerLength, MARGIN.floorPct));
        if (args.rulerGirth !== undefined) line("Circonférence sans carte", compareToRuler(r.pair.modelGirthCm, args.rulerGirth, MARGIN.floorPct));
      }
      out.push("  Rappel : votre propre mesure à la règle a une incertitude de quelques millimètres ; un seul essai ne prouve rien (voir docs/CALIBRATION.md).");
      out.push("");
    }

    out.push(`RAPPORT RÉDIGÉ (${reportWordCount(t)} mots ; vérifié par le code : interdits, valeurs, structure)`);
    out.push(`  Synthèse : ${t.synthese}`);
    out.push("  Tableau des indicateurs :");
    for (const k of INDICATOR_KEYS) out.push(`    ${INDICATOR_LABELS[k]} : ${indicatorValue(ind, k)} — ${t.appreciations[k]}`);
    for (const k of SECTION_KEYS) out.push(`  ${SECTION_TITLES[k]} : ${t[k]}`);
    out.push("  Points remarquables :");
    t.points_remarquables.forEach((p) => out.push(`    - ${p.texte}`));
    out.push(`  Conclusion : ${t.conclusion}`);
    out.push(`  Note du laboratoire : ${t.note_laboratoire}`);
    out.push("");
  } else if (r.status === "refused") {
    out.push("RÉSULTAT : ANALYSE REFUSÉE (aucun rapport n'aurait été créé)");
    if (r.motif) out.push(`  Motif technique : ${r.motif}`);
    if (r.message) out.push(`  Message qu'afficherait le site : ${r.message}`);
    out.push("");
  } else {
    out.push("RÉSULTAT : ERREUR (aucun rapport)");
    if (r.motif) out.push(`  Code : ${r.motif}`);
    if (r.message) out.push(`  Message : ${r.message}`);
    out.push("");
  }

  out.push("APPELS, DURÉE ET COÛT");
  out.push(`  Appels à l'API : ${r.requests} (appel vision avec la photo, puis rédaction sans la photo ; relances : ${r.retries})`);
  r.calls.forEach((c, i) => {
    const what = c.kind === "analyse" ? "appel vision (recevabilité, estimations, observations, points)" : "rédaction (texte seul, sans la photo)";
    out.push(
      c.usage
        ? `    ${i + 1}. ${what} : ${sec(c.ms)} · ${c.usage.tokensIn} jetons en entrée, ${c.usage.tokensOut} en sortie · ${usd(c.costMicros)}`
        : `    ${i + 1}. ${what} : ${sec(c.ms)} · échec (${c.error})`,
    );
  });
  out.push(`  Durée totale : ${sec(r.totalMs)}`);
  for (const s of r.steps) out.push(`    - ${s.label} : ${sec(s.ms)}`);
  out.push(`  Jetons : ${r.tokensIn} en entrée, ${r.tokensOut} en sortie (tarif ${args.pricing.inPerM} / ${args.pricing.outPerM} $ par million)`);
  out.push(`  Coût de cette analyse : ${usd(r.costMicros)}`);
  if (args.mode === "reel" && args.spentTodayMicros !== null) {
    out.push(`  Cumul du jour (jour civil, Paris) : ${usd(args.spentTodayMicros)} sur un plafond XAI_DAILY_CAP_USD de ${usd(toMicros(args.capUsd))} (reste ${usd(Math.max(0, toMicros(args.capUsd) - args.spentTodayMicros))})`);
  } else if (args.mode === "simulation") {
    out.push("  Cumul du jour : inchangé (simulation, aucun appel réel).");
  }
  if (args.deleted) {
    out.push("");
    out.push(
      args.deleted.done
        ? `PHOTO SUPPRIMÉE de ${PHOTOS_DIR}/ (écrasée puis effacée). Entrées restantes dans ${PHOTOS_DIR}/ : ${args.deleted.remaining}.`
        : `La photo n'a PAS été supprimée. Supprimez-la : npm run photo:supprimer -- ${PHOTOS_DIR}/<nom du fichier>`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------------------------------------------------------

export type CliIO = {
  /** Racine du projet (le dossier photos-test/ est cherché dedans). */
  root: string;
  cwd?: string;
  env?: Env;
  out: (line: string) => void;
  /** Mode réel : charge .env (renvoie false si le fichier est introuvable). Absent : rien à charger. */
  loadEnv?: () => boolean;
  /** Moteur utilisé en mode réel (défaut : le vrai moteur xAI). Injecté par les tests, jamais par le script. */
  realVision?: VisionProvider;
  pricing?: { inPerM: number; outPerM: number };
  now?: () => Date;
};

/** Photo simulée : image neutre (aplat gris) fabriquée en mémoire par du code. Jamais écrite. */
async function fabricatedNeutralImage(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: "#8a8a8a" } }).jpeg().toBuffer();
}

/** `npm run photo:test`. Renvoie le code de sortie (0 : analyse réussie ; 1 : refus ou erreur d'analyse ; 2 : arguments ou garde-fou). */
export async function runPhotoTestCli(argv: string[], io: CliIO): Promise<number> {
  const out = io.out;
  const env = io.env ?? process.env;
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (e) {
    if (e instanceof PhotoTestError) {
      out(e.message);
      out("");
      out("Aide : npm run photo:test -- --aide");
      return 2;
    }
    throw e;
  }
  if (opts.help) {
    out(USAGE_TEXT);
    return 0;
  }
  const state = opts.state!;
  let photo: Buffer | null = null;
  let photoPath: string | null = null;
  try {
    if (opts.file) {
      photoPath = resolvePhotoPath(opts.file, io.root, io.cwd);
      assertPhotosDirIgnored(io.root);
    }

    // Moteur, plafond, tarif : le mode réel exige la clé et un plafond respecté AVANT toute lecture de la photo.
    let vision: VisionProvider;
    let spend: SpendGate;
    let capUsd = 0;
    let modelLabel: string;
    const ledgerPath = join(io.root, LEDGER_FILE);
    const day = parisDay((io.now ?? (() => new Date()))());
    if (opts.simulation) {
      vision = createSimulatedVision("ok");
      spend = simulationGate;
      modelLabel = "moteur simulé";
    } else {
      if (io.loadEnv && !io.loadEnv()) throw new PhotoTestError("env", "Fichier .env introuvable à la racine du projet (voir docs/TEST-XAI.md pour y coller la clé xAI).");
      if (!env.XAI_API_KEY || env.XAI_API_KEY.trim() === "") throw new PhotoTestError("cle", "XAI_API_KEY est vide dans .env (la valeur n'est jamais affichée). Voir docs/TEST-XAI.md.");
      capUsd = dailyCapUsd(env);
      const cap = checkSessionCap({ spentMicros: spentTodayMicros(ledgerPath, day), capUsd, estimateUsd: ESTIMATED_ANALYSIS_USD });
      if (!cap.ok) throw new PhotoTestError("plafond", cap.message);
      vision = io.realVision ?? xaiVision;
      spend = ledgerGate(ledgerPath, capUsd, io.now);
      modelLabel = `vision : ${env.XAI_MODEL || "grok-4.7"} (raisonnement ${env.XAI_EFFORT === undefined ? "low" : env.XAI_EFFORT || "par défaut"}) · rédaction : ${env.XAI_TEXT_MODEL || DEFAULT_TEXT_MODEL}`;
    }

    if (photoPath) photo = readFileSync(photoPath);
    else photo = await fabricatedNeutralImage();
    const pricing = io.pricing ?? aiPricing();

    const result = await runPhotoTest({ photo, state, vision, spend, pricing });
    photo.fill(0); // l'exemplaire en mémoire est vidé dès la fin de l'analyse
    photo = null;

    let deleted: { done: boolean; remaining: number } | undefined;
    if (opts.delete) {
      if (photoPath) {
        secureDelete(photoPath);
        deleted = { done: true, remaining: remainingInPhotosDir(io.root) };
      } else {
        deleted = { done: false, remaining: remainingInPhotosDir(io.root) };
      }
    }
    for (const line of formatReport({
      mode: opts.simulation ? "simulation" : "reel",
      state,
      result,
      rulerLength: opts.length,
      rulerGirth: opts.girth,
      modelLabel,
      pricing,
      capUsd,
      spentTodayMicros: opts.simulation ? null : spentTodayMicros(ledgerPath, day),
      deleted: opts.delete && opts.file ? deleted : undefined,
    })) {
      out(line);
    }
    if (opts.delete && !opts.file) out("Aucune photo à supprimer (essai à blanc sans fichier).");
    return result.status === "ok" && !result.results?.morpho?.partielle ? 0 : 1;
  } catch (e) {
    photo?.fill(0);
    if (e instanceof PhotoTestError) {
      out(e.message);
      out("La photo n'a pas été envoyée ni supprimée.");
      return 2;
    }
    // Erreur inattendue : message court, jamais de trace qui pourrait contenir un chemin ou des octets.
    out(`Erreur inattendue : ${String((e as Error).message ?? e).slice(0, 200)}`);
    if (opts.delete && photoPath && existsSync(photoPath)) out("La photo n'a PAS été supprimée : npm run photo:supprimer -- --tout");
    return 1;
  }
}

/** `npm run photo:supprimer`. */
export function runDeleteCli(argv: string[], io: Pick<CliIO, "root" | "cwd" | "out">): number {
  const out = io.out;
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: { tout: { type: "boolean", default: false }, verifier: { type: "boolean", default: false } } });
  } catch (e) {
    out(`Option non reconnue : ${(e as Error).message.split("\n")[0]}`);
    out(`Usage : npm run photo:supprimer -- ${PHOTOS_DIR}/ma-photo.jpg   |   --tout   |   --verifier`);
    return 2;
  }
  const { tout, verifier } = parsed.values;
  const files = parsed.positionals;
  if (!tout && !verifier && files.length === 0) {
    out(`Indiquez la photo à supprimer (ex. ${PHOTOS_DIR}/ma-photo.jpg), ou --tout pour vider ${PHOTOS_DIR}/, ou --verifier pour compter ce qui reste.`);
    return 2;
  }
  try {
    let deleted = 0;
    if (tout) deleted += secureDeleteAll(io.root);
    for (const f of files) {
      secureDelete(resolvePhotoPath(f, io.root, io.cwd));
      deleted++;
    }
    const remaining = remainingInPhotosDir(io.root);
    if (deleted > 0) out(`${deleted} fichier(s) supprimé(s) de ${PHOTOS_DIR}/ (écrasés puis effacés).`);
    out(remaining === 0 ? `Vérification : ${PHOTOS_DIR}/ est vide. Il ne reste aucune photo.` : `Vérification : il reste ${remaining} entrée(s) dans ${PHOTOS_DIR}/ (lancez « npm run photo:supprimer -- --tout » pour tout supprimer).`);
    return remaining === 0 ? 0 : 1;
  } catch (e) {
    out(e instanceof PhotoTestError ? e.message : `Erreur inattendue : ${String((e as Error).message ?? e).slice(0, 200)}`);
    return 2;
  }
}

/** Racine du projet, déduite de l'emplacement de ce fichier (scripts/lib/ → racine), jamais du dossier courant. */
export const projectRoot = (): string => resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
