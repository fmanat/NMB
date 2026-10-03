// Vérifie, avec la VRAIE API xAI, le moteur photo-report/2 sans aucune photo :
//   1. appel vision sur une image NEUTRE fabriquée par du code (formes géométriques et texte) : le schéma JSON strict doit être accepté
//      et la réponse conforme ; résultat attendu : « non recevable » (ce n'est pas le sujet attendu) ;
//   2. appel texte (sans image) avec des observations et des valeurs FACTICES (celles du moteur simulé) : le rapport rédigé est
//      vérifié par le code exactement comme sur le site (interdits, valeurs, structure), avec la même relance unique.
// Affiche le rapport rédigé en entier. Plafond de dépense : --max-usd (défaut 0,15 $).
//
//   npm run xai:schema-check                         vision + rédaction (en érection)
//   npm run xai:schema-check -- --texte-seul         rédaction seule (aucune image envoyée)
//   npm run xai:schema-check -- --etat repos         rédaction pour un état de repos
//   npm run xai:schema-check -- --courbure 35        rédaction avec une courbure de 35° (phrase d'avis médical)
//
// La clé XAI_API_KEY est lue dans .env et n'est jamais affichée ; l'image n'est écrite nulle part.

import { aiPricing } from "@/config/site";
import { STANDARD_VERSIONS, validateVision } from "@/lib/analyseFlow";
import { computeIndicators, favourableIndicators, indicatorValue, INDICATOR_KEYS, INDICATOR_LABELS } from "@/lib/morpho";
import { checkReportText, reportWordCount, SECTION_KEYS, SECTION_TITLES } from "@/lib/vision/reportText";
import { SIMULATED_ESTIMATES, SIMULATED_OBSERVATIONS } from "@/lib/vision/simulation";
import type { Usage } from "@/lib/vision/types";
import { xaiVision } from "@/lib/vision/xai";
import { shapesImage } from "../tests/fixtures/neutralImage";

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const maxUsd = Number(opt("max-usd") ?? 0.15);
const textOnly = args.includes("--texte-seul");
const state = opt("etat") === "repos" ? "rest" : "erect";
const curvature = Number(opt("courbure") ?? SIMULATED_ESTIMATES.courbure_degres);
if (!process.env.XAI_API_KEY) {
  console.error("XAI_API_KEY est vide : renseignez .env.");
  process.exit(1);
}

// Observations sans le marqueur des tests (texte factice, aucune photo réelle n'a été vue).
const observations = Object.fromEntries(Object.entries(SIMULATED_OBSERVATIONS).map(([k, v]) => [k, v.replace(/^\[obs-simulee\]\s*/, "")])) as typeof SIMULATED_OBSERVATIONS;

const pricing = aiPricing();
let spent = 0;
const cost = (u: Usage) => (u.tokensIn * pricing.inPerM + u.tokensOut * pricing.outPerM) / 1e6;
const report = (label: string, u: Usage) => {
  const c = cost(u);
  spent += c;
  console.log(`  ${label} : ${u.calls} appel(s), ${u.tokensIn} jetons en entrée, ${u.tokensOut} en sortie, ${(u.ms / 1000).toFixed(1)} s, ≈ ${c.toFixed(4)} $ (cumul ${spent.toFixed(4)} $)`);
};

console.log(`Schéma ${STANDARD_VERSIONS.schemaVersion} · prompts ${STANDARD_VERSIONS.promptVersion} · modèle ${process.env.XAI_MODEL || "grok-4.7"} · plafond ${maxUsd} $`);

let visionOk = true;
if (textOnly) console.log("1/2 Appel vision : ignoré (--texte-seul)");
else {
  const jpeg = await shapesImage();
  console.log(`1/2 Appel vision (JSON strict) sur une image neutre fabriquée : ${jpeg.length} octets (formes géométriques et texte, aucune photo)`);
  const r = await xaiVision.analyse(jpeg);
  report("vision", r.usage);
  const a = validateVision(r);
  visionOk = a.ok;
  if (!a.ok) console.log(`  ✗ réponse NON conforme au schéma (${a.motif}) : ${JSON.stringify(r.json).slice(0, 300)}`);
  else if (a.value.refused) console.log("  ✓ conforme : le prestataire a refusé de traiter l'image (traité comme non recevable)");
  else if (!a.value.value.recevable) console.log(`  ✓ conforme : non recevable, motif « ${a.value.value.motif} » (attendu pour une image neutre)`);
  else console.log("  ✓ conforme : recevable (inattendu pour une image neutre, à examiner)");
  if (r.usage.calls > 1) console.log("  ⚠ une requête de repli « json_object » a été nécessaire : le format strict a été rejeté par l'API");
}

if (spent >= maxUsd) {
  console.log(`\nPlafond atteint (${spent.toFixed(4)} $) : la rédaction n'est pas testée.`);
  process.exit(2);
}

const e = SIMULATED_ESTIMATES;
const ind = computeIndicators({
  state,
  lengthCm: state === "rest" ? 9.6 : e.longueur_cm,
  girthCm: state === "rest" ? 9.5 : e.circonference_cm,
  curvatureDeg: curvature,
  direction: curvature >= 5 ? "left" : "none",
  symmetry: e.symetrie,
  glansRatio: e.rapport_gland,
  taperRatio: e.conicite,
});
const allowedHighlights = favourableIndicators(ind);
const ctx = { indicators: ind, allowedHighlights };
console.log(`\n2/2 Appel texte (sans image ; valeurs factices, état ${state === "rest" ? "repos" : "érection"}, courbure ${ind.courbureDeg}°)`);

let previous: string[] | undefined;
let accepted: ReturnType<typeof checkReportText> | null = null;
for (let attempt = 1; attempt <= 2 && spent < maxUsd; attempt++) {
  const w = await xaiVision.writeReport({ indicators: ind, method: "visuelle", observations, allowedHighlights, previousViolations: previous });
  report(`rédaction, essai ${attempt}`, w.usage);
  if (w.refused) {
    console.log("  ✗ le prestataire a refusé la rédaction");
    continue;
  }
  const check = checkReportText(w.json, ctx);
  if (!check.ok) console.log(`  ✗ règles strictes violées : ${check.hard.join(" ; ")}`);
  if (check.soft.length) console.log(`  ~ écarts de forme : ${check.soft.join(" ; ")}`);
  if (check.ok && (check.soft.length === 0 || attempt === 2)) {
    accepted = check;
    break;
  }
  if (check.ok) accepted = check;
  previous = check.ok ? check.soft : [...check.hard, ...check.soft];
}

if (accepted?.ok) {
  const t = accepted.value;
  console.log(`\n  ✓ rapport accepté (${reportWordCount(t)} mots)\n`);
  console.log("SYNTHÈSE");
  console.log(`  ${t.synthese}\n`);
  console.log("TABLEAU DES INDICATEURS");
  for (const k of INDICATOR_KEYS) console.log(`  ${INDICATOR_LABELS[k]} : ${indicatorValue(ind, k)} — ${t.appreciations[k]}`);
  for (const k of SECTION_KEYS) console.log(`\n${SECTION_TITLES[k].toUpperCase()}\n  ${t[k]}`);
  console.log("\nPOINTS REMARQUABLES");
  t.points_remarquables.forEach((p) => console.log(`  - [${p.indicateur}] ${p.texte}`));
  console.log(`\nCONCLUSION\n  ${t.conclusion}`);
  console.log(`\nNOTE DU LABORATOIRE\n  ${t.note_laboratoire}`);
} else {
  console.log("\n  ✗ aucun rapport conforme après la relance : le site afficherait un rapport partiel.");
}

console.log(`\nDépense de cette exécution : ≈ ${spent.toFixed(4)} $ (tarif ${pricing.inPerM}/${pricing.outPerM} $ par million de jetons).`);
process.exit(visionOk && accepted?.ok ? 0 : 3);
