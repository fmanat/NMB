// Outil de calibration : compare les mesures ESTIMÉES par le pipeline d'analyse aux mesures RÉELLES connues,
// sur un lot de photos de référence, et dit quelle marge d'erreur les données justifient.
//
// Les photos restent dans photos-test/ (ignoré par git). Le script n'affiche jamais les noms de fichiers ni
// les images : uniquement des chiffres. Il utilise exactement le même code que le site (réencodage, repérage,
// validation, calculs).
//
// Préparer photos-test/calibration.json (voir docs/CALIBRATION.md) :
//   [ { "file": "a.jpg", "length": 13.0, "girth": 12.0, "state": "erect" }, ... ]
//
// Utilisation :
//   npm run calibrate                 avec le vrai moteur xAI (payant : environ 1 à 2 centimes par photo)
//   npm run calibrate -- --simulate   avec le moteur simulé (aucun coût, sert à vérifier l'outil)

import { readFileSync } from "node:fs";
import { relative, resolve, isAbsolute } from "node:path";
import { GIRTH_FROM, MARGIN, PHOTO_LIMITS } from "@/config/site";
import { errorPct, MIN_SAMPLES_FOR_MARGIN, summarize, suggestedMargin, type CalibrationPoint } from "@/lib/calibration";
import { prepareImage } from "@/lib/image";
import { confidenceIndex, marginPct } from "@/lib/measure";
import { estimateMeasuresPose } from "@/lib/pose";
import { createSimulatedVision } from "@/lib/vision/simulation";
import { validateRecevabilite, validateReperage } from "@/lib/vision/schema";
import { xaiVision } from "@/lib/vision/xai";

type Entry = { file: string; length: number; girth: number; state?: "rest" | "erect" };

const simulate = process.argv.includes("--simulate");
const root = resolve("photos-test");
const listPath = resolve(root, "calibration.json");

let entries: Entry[];
try {
  entries = JSON.parse(readFileSync(listPath, "utf8")) as Entry[];
} catch {
  console.error("Fichier photos-test/calibration.json introuvable ou illisible. Voir docs/CALIBRATION.md.");
  process.exit(1);
}
if (!Array.isArray(entries) || entries.length === 0) {
  console.error("calibration.json est vide.");
  process.exit(1);
}

const vision = simulate ? createSimulatedVision("ok") : xaiVision;
if (!simulate && !process.env.XAI_API_KEY) {
  console.error("XAI_API_KEY est vide (fichier .env).");
  process.exit(1);
}

const lengthPts: CalibrationPoint[] = [];
const girthPts: CalibrationPoint[] = [];
const girthMeanPts: CalibrationPoint[] = [];
const refused: Record<string, number> = {};
let tokensIn = 0;
let tokensOut = 0;
const durations: number[] = [];

console.log(`Calibration sur ${entries.length} photo(s) · moteur : ${vision.id}${simulate ? " (simulé)" : ""}\n`);

for (const [i, e] of entries.entries()) {
  const tag = `#${i + 1}`;
  const path = resolve(root, e.file);
  const rel = relative(root, path);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    console.log(`${tag} ignorée : le fichier doit être dans photos-test/`);
    continue;
  }
  try {
    const raw = readFileSync(path);
    const { jpeg, width, height } = await prepareImage(raw);
    const r = await vision.analyse(jpeg);
    tokensIn += r.usage.tokensIn;
    tokensOut += r.usage.tokensOut;
    durations.push(r.usage.ms);
    // Mêmes validations que le site (schéma versionné) ; un refus du prestataire est compté comme « sujet non conforme ».
    const rec = r.refused ? { recevable: false, motif: "sujet_non_conforme" } : validateRecevabilite(r.recevabilite);
    if (!rec) {
      refused.recevabilite_invalide = (refused.recevabilite_invalide ?? 0) + 1;
      console.log(`${tag} réponse de recevabilité non conforme au schéma`);
      continue;
    }
    if (!rec.recevable) {
      refused[rec.motif] = (refused[rec.motif] ?? 0) + 1;
      console.log(`${tag} refusée (${rec.motif})`);
      continue;
    }
    const rep = validateReperage(r.reperage);
    if (!rep) {
      refused.reperage_incomplet = (refused.reperage_incomplet ?? 0) + 1;
      console.log(`${tag} repérage incomplet`);
      continue;
    }
    const est = estimateMeasuresPose(rep, width, height);
    // Mêmes refus que le site : au-delà, la marge affichée ne serait pas honnête.
    const cardPct = (est.cardLongEdgePx / Math.max(width, height)) * 100;
    if (est.tiltDeg > PHOTO_LIMITS.maxTiltDeg || cardPct < PHOTO_LIMITS.minCardFraction * 100) {
      const motif = est.tiltDeg > PHOTO_LIMITS.maxTiltDeg ? "inclinaison_trop_forte" : "carte_trop_petite";
      refused[motif] = (refused[motif] ?? 0) + 1;
      console.log(`${tag} refusée (${motif} : inclinaison ${est.tiltDeg.toFixed(0)}°, carte ${cardPct.toFixed(0)} % de l'image)`);
      continue;
    }
    const conf = confidenceIndex(rep);
    const margin = marginPct(conf, { cardLongEdgePx: est.cardLongEdgePx, tiltDeg: est.tiltDeg }, MARGIN);
    const girthEst = GIRTH_FROM === "max" ? est.girthFromMaxCm : est.girthFromMeanCm;
    lengthPts.push({ real: e.length, est: est.lengthCm, marginPct: margin });
    girthPts.push({ real: e.girth, est: girthEst, marginPct: margin });
    girthMeanPts.push({ real: e.girth, est: est.girthFromMeanCm, marginPct: margin });
    const f = (n: number) => n.toFixed(1).padStart(5);
    const p = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)} %`.padStart(6);
    console.log(
      `${tag} ${e.state ?? "?"} | longueur réel ${f(e.length)} est. ${f(est.lengthCm)} (${p(errorPct(est.lengthCm, e.length))}) | ` +
        `circonf. réel ${f(e.girth)} est. ${f(girthEst)} (${p(errorPct(girthEst, e.girth))}) | inclinaison ${est.tiltDeg.toFixed(0)}° · carte ${cardPct.toFixed(0)} % | confiance ${conf.toFixed(0)} | marge ± ${margin} % | ${(r.usage.ms / 1000).toFixed(0)} s`,
    );
  } catch (err) {
    console.log(`${tag} erreur : ${(err as Error).message.slice(0, 120)}`);
  }
}

function report(name: string, pts: CalibrationPoint[]) {
  const s = summarize(pts);
  if (!s) {
    console.log(`${name} : aucune mesure exploitable`);
    return;
  }
  console.log(`\n${name} (${s.n} mesures)`);
  console.log(`  biais moyen            : ${s.meanSignedPct >= 0 ? "+" : ""}${s.meanSignedPct.toFixed(1)} %  (positif = surestime)`);
  console.log(`  écart absolu moyen     : ${s.meanAbsPct.toFixed(1)} %  · médian ${s.medianAbsPct.toFixed(1)} %`);
  console.log(`  écart absolu 80e / 90e : ${s.p80AbsPct.toFixed(1)} % / ${s.p90AbsPct.toFixed(1)} %`);
  console.log(`  dans ± 10 %            : ${(s.within10 * 100).toFixed(0)} %`);
  console.log(`  dans la marge affichée : ${(s.withinMargin * 100).toFixed(0)} %`);
  const m = suggestedMargin(s, MARGIN.floorPct);
  console.log(
    m === null
      ? `  marge suggérée         : aucune conclusion avant ${MIN_SAMPLES_FOR_MARGIN} mesures (il n'y en a que ${s.n})`
      : `  marge suggérée         : ± ${m} % (90e percentile de l'écart, jamais sous ${MARGIN.floorPct} %)`,
  );
}

console.log("\n=== SYNTHÈSE ===");
const total = entries.length;
const ok = lengthPts.length;
console.log(`Analyses exploitables : ${ok} / ${total}`);
const refusedTotal = Object.values(refused).reduce((a, b) => a + b, 0);
if (refusedTotal) console.log(`Refus : ${Object.entries(refused).map(([k, v]) => `${k} ×${v}`).join(", ")}`);
report("Longueur", lengthPts);
report(`Circonférence (π × largeur ${GIRTH_FROM === "max" ? "maximale" : "moyenne"}, réglage actuel)`, girthPts);
if (GIRTH_FROM === "max") report("Circonférence (π × largeur moyenne, pour comparaison)", girthMeanPts);
if (durations.length) {
  const sorted = [...durations].sort((a, b) => a - b);
  console.log(`\nDurée de l'appel d'analyse : médiane ${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(0)} s · maximum ${(sorted[sorted.length - 1] / 1000).toFixed(0)} s`);
}
const cost = (tokensIn * 2 + tokensOut * 6) / 1e6;
console.log(`Jetons : ${tokensIn} en entrée, ${tokensOut} en sortie · coût ≈ ${cost.toFixed(3)} $ (tarif grok-4.7)`);
