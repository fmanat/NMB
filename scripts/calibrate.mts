// Outil de calibration (moteur photo-report/2) : compare les mesures ESTIMÉES par le pipeline d'analyse aux mesures RÉELLES connues,
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
import { MARGIN } from "@/config/site";
import { calibratedMeasure } from "@/lib/analyseFlow";
import { errorPct, MIN_SAMPLES_FOR_MARGIN, summarize, suggestedMargin, type CalibrationPoint } from "@/lib/calibration";
import { prepareImage } from "@/lib/image";
import { createSimulatedVision } from "@/lib/vision/simulation";
import { validateVisionV2 } from "@/lib/vision/schema2";
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

const vision = simulate ? createSimulatedVision("calibrated") : xaiVision;
if (!simulate && !process.env.XAI_API_KEY) {
  console.error("XAI_API_KEY est vide (fichier .env).");
  process.exit(1);
}

const lengthPts: CalibrationPoint[] = [];
const girthPts: CalibrationPoint[] = [];
const modelPts: CalibrationPoint[] = [];
const modelGirthPts: CalibrationPoint[] = [];
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
    // Même validation que le site (schéma photo-report/2) ; un refus du prestataire est compté à part.
    if (r.refused) {
      refused.refus_prestataire = (refused.refus_prestataire ?? 0) + 1;
      console.log(`${tag} refusée par le prestataire`);
      continue;
    }
    const v = validateVisionV2(r.json);
    if (!v) {
      refused.vision_invalide = (refused.vision_invalide ?? 0) + 1;
      console.log(`${tag} réponse non conforme au schéma`);
      continue;
    }
    if (!v.recevable) {
      refused[v.motif] = (refused[v.motif] ?? 0) + 1;
      console.log(`${tag} non recevable (${v.motif})`);
      continue;
    }
    const f = (n: number) => n.toFixed(1).padStart(5);
    const p = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)} %`.padStart(6);
    const e2 = v.estimations;
    // Valeurs retenues par le site : mesure calibrée sur la carte si elle est exploitable, sinon estimation du modèle.
    const cal = v.reperage ? calibratedMeasure(v.reperage, width, height) : null;
    const length = cal?.ok ? cal.lengthCm : e2.longueur_cm;
    const girth = cal?.ok ? cal.girthCm : e2.circonference_cm;
    lengthPts.push({ real: e.length, est: length, marginPct: MARGIN.floorPct });
    girthPts.push({ real: e.girth, est: girth, marginPct: MARGIN.floorPct });
    modelPts.push({ real: e.length, est: e2.longueur_sans_carte_cm, marginPct: MARGIN.floorPct });
    modelGirthPts.push({ real: e.girth, est: e2.circonference_sans_carte_cm, marginPct: MARGIN.floorPct });
    console.log(
      `${tag} ${e.state ?? "?"} (observé : ${e2.etat}) | ${cal?.ok ? "mesure calibrée" : `estimation visuelle${cal ? ` (carte écartée : ${cal.reason})` : ""}`} | ` +
        `longueur réel ${f(e.length)} retenu ${f(length)} (${p(errorPct(length, e.length))}) sans carte ${f(e2.longueur_sans_carte_cm)} (${p(errorPct(e2.longueur_sans_carte_cm, e.length))}) | ` +
        `circonf. réel ${f(e.girth)} retenu ${f(girth)} (${p(errorPct(girth, e.girth))}) sans carte ${f(e2.circonference_sans_carte_cm)} (${p(errorPct(e2.circonference_sans_carte_cm, e.girth))}) | ${(r.usage.ms / 1000).toFixed(0)} s`,
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
report("Longueur retenue par le site (carte si exploitable, sinon estimation)", lengthPts);
report("Circonférence retenue par le site", girthPts);
report("Longueur estimée par le modèle SANS la carte", modelPts);
report("Circonférence estimée par le modèle SANS la carte", modelGirthPts);
if (durations.length) {
  const sorted = [...durations].sort((a, b) => a - b);
  console.log(`\nDurée de l'appel d'analyse : médiane ${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(0)} s · maximum ${(sorted[sorted.length - 1] / 1000).toFixed(0)} s`);
}
const cost = (tokensIn * 2 + tokensOut * 6) / 1e6;
console.log(`Jetons : ${tokensIn} en entrée, ${tokensOut} en sortie · coût ≈ ${cost.toFixed(3)} $ (tarif grok-4.7)`);
