// Vérifie, avec la VRAIE API xAI, que le schéma JSON strict versionné (src/lib/vision/schema.ts) est accepté et que les réponses
// se valident, en envoyant UNIQUEMENT une image neutre fabriquée par du code (formes géométriques et texte : aucune photo).
// Résultat attendu pour cette image : « non recevable » (ce n'est pas le sujet attendu) ; ce qui compte, c'est que les trois réponses
// soient conformes au schéma. Chaque exécution coûte quelques centimes ; plafond : --max-usd (défaut 0,10 $).
//
//   npm run xai:schema-check                 une analyse (2 appels) + une rédaction (1 appel)
//   npm run xai:schema-check -- --max-usd 0.05
//   npm run xai:schema-check -- --comment-only   (ne teste que la rédaction : un seul appel texte)
//
// La clé XAI_API_KEY est lue dans .env et n'est jamais affichée ; l'image n'est écrite nulle part.

import { aiPricing } from "@/config/site";
import { validateAnalyse, validateComment } from "@/lib/analyseFlow";
import { PROMPT_VERSION } from "@/lib/vision/prompts";
import { PHOTO_REPORT_SCHEMA_VERSION, textViolations } from "@/lib/vision/schema";
import type { Usage } from "@/lib/vision/types";
import { xaiVision } from "@/lib/vision/xai";
import { shapesImage } from "../tests/fixtures/neutralImage";

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const maxUsd = Number(opt("max-usd") ?? 0.1);
const commentOnly = args.includes("--comment-only");
if (!process.env.XAI_API_KEY) {
  console.error("XAI_API_KEY est vide : renseignez .env.");
  process.exit(1);
}

const pricing = aiPricing();
let spent = 0;
const cost = (u: Usage) => (u.tokensIn * pricing.inPerM + u.tokensOut * pricing.outPerM) / 1e6;
const report = (label: string, u: Usage) => {
  const c = cost(u);
  spent += c;
  console.log(`  ${label} : ${u.calls} appel(s), ${u.tokensIn} jetons en entrée, ${u.tokensOut} en sortie, ${(u.ms / 1000).toFixed(1)} s, ≈ ${c.toFixed(4)} $ (cumul ${spent.toFixed(4)} $)`);
};

console.log(`Schéma ${PHOTO_REPORT_SCHEMA_VERSION} · prompts ${PROMPT_VERSION} · modèle ${process.env.XAI_MODEL || "grok-4.7"} · plafond ${maxUsd} $`);
const jpeg = await shapesImage();
console.log(`Image neutre fabriquée : ${jpeg.length} octets (formes géométriques et texte, aucune photo)\n`);

let analyseOk = true;
if (commentOnly) console.log("1/2 Recevabilité ‖ repérage : ignoré (--comment-only)");
else {
  console.log("1/2 Recevabilité ‖ repérage (JSON strict, schéma versionné)");
  const r = await xaiVision.analyse(jpeg);
  report("analyse", r.usage);
  const a = validateAnalyse(r);
  analyseOk = a.ok;
  if (!a.ok) console.log(`  ✗ réponse NON conforme au schéma (${a.motif}) : ${JSON.stringify(r.recevabilite).slice(0, 200)}`);
  else if (a.value.refused) console.log("  ✓ conforme : le prestataire a refusé de traiter l'image (traité comme non recevable)");
  else if (!a.value.recevable) console.log(`  ✓ conforme : non recevable, motif « ${a.value.motif} » (attendu pour une image neutre)`);
  else console.log("  ✓ conforme : recevable (inattendu pour une image neutre, à examiner), repérage valide");
  if (r.usage.calls > 2) console.log("  ⚠ une requête de repli « json_object » a été nécessaire : le format strict a été rejeté par l'API");
}

if (spent >= maxUsd) {
  console.log(`\nPlafond atteint (${spent.toFixed(4)} $) : la rédaction n'est pas testée.`);
  process.exit(2);
}

console.log("\n2/2 Rédaction (texte seul, JSON strict : trois observations, un verdict ; indicateurs factices)");
const c = await xaiVision.writeComment({
  formula: "B",
  state: "erect",
  score: 72,
  lengthPercentile: 52,
  girthPercentile: 58,
  marginPct: 11,
  symmetry: 93,
  curvatureDeg: 7,
  confidence: 91,
  cardFraction: 0.31,
  tiltDeg: 14,
  declaredGapFlagged: false,
});
report("rédaction", c.usage);
const v = validateComment(c);
if (!v.ok) {
  console.log(`  ✗ commentaire NON conforme (${v.motif}) : ${JSON.stringify(c.json).slice(0, 1200)}`);
  const j = c.json as { observations?: unknown; verdict?: unknown } | null;
  const texts = [...(Array.isArray(j?.observations) ? (j!.observations as unknown[]) : []), j?.verdict].filter((t): t is string => typeof t === "string");
  for (const t of texts) {
    const why = textViolations(t);
    if (why.length) console.log(`    → « ${t.slice(0, 80)}… » : ${why.join(", ")}`);
  }
} else {
  console.log("  ✓ conforme au schéma :");
  v.value.observations.forEach((o, i) => console.log(`    ${i + 1}. ${o}`));
  console.log(`    Verdict : ${v.value.verdict}`);
}
if (c.usage.calls > 1) console.log("  ⚠ une requête de repli « json_object » a été nécessaire : le format strict a été rejeté par l'API");

console.log(`\nDépense de cette exécution : ≈ ${spent.toFixed(4)} $ (tarif ${pricing.inPerM}/${pricing.outPerM} $ par million de jetons).`);
process.exit(analyseOk && v.ok ? 0 : 3);
