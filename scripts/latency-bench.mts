// Mesure la durée de l'analyse xAI pour plusieurs configurations, AVEC L'IMAGE NEUTRE fabriquée par le script d'essai
// (un objet cylindrique à côté d'une carte : aucune photo personnelle). Chaque essai appelle réellement l'API (payant).
//
//   npm run latency:bench                       toutes les configurations, 2 essais chacune
//   npm run latency:bench -- --only C,D --runs 3
//   npm run latency:bench -- --max-usd 0.30     s'arrête dès que la dépense cumulée dépasse ce plafond (défaut : 0,50 $)

import { spawnSync } from "node:child_process";

type Config = { id: string; label: string; flags: string[] };

const CONFIGS: Config[] = [
  { id: "A", label: "1 600 px · 2 appels · raisonnement par défaut", flags: ["--size", "1600"] },
  { id: "B", label: "1 600 px · 2 appels · raisonnement réduit (low)", flags: ["--size", "1600", "--effort", "low"] },
  { id: "C", label: "1 600 px · 1 appel fusionné · raisonnement réduit (low)", flags: ["--size", "1600", "--merge", "--effort", "low"] },
  { id: "D", label: "1 024 px · 1 appel fusionné · raisonnement réduit (low)", flags: ["--size", "1024", "--merge", "--effort", "low"] },
  { id: "E", label: "1 600 px · 1 appel fusionné · raisonnement par défaut", flags: ["--size", "1600", "--merge"] },
  { id: "F", label: "1 024 px · 2 appels · raisonnement réduit (low)", flags: ["--size", "1024", "--effort", "low"] },
  { id: "G", label: "1 024 px · 1 appel fusionné · raisonnement minimal", flags: ["--size", "1024", "--merge", "--effort", "minimal"] },
  { id: "H", label: "1 600 px · 1 appel fusionné · raisonnement minimal", flags: ["--size", "1600", "--merge", "--effort", "minimal"] },
  { id: "P", label: "1 600 px · 2 appels EN PARALLÈLE · raisonnement réduit (low)", flags: ["--size", "1600", "--parallel", "--effort", "low"] },
  { id: "Q", label: "1 024 px · 2 appels EN PARALLÈLE · raisonnement réduit (low)", flags: ["--size", "1024", "--parallel", "--effort", "low"] },
];

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = opt("only")?.split(",");
const runs = Number(opt("runs") ?? 2);
const maxUsd = Number(opt("max-usd") ?? 0.5);

const num = (re: RegExp, s: string) => {
  const m = s.match(re);
  return m ? Number(m[1].replace(",", ".")) : null;
};

type Result = { config: Config; photoS: number | null; totalS: number | null; conf: number | null; usd: number | null; ok: boolean; verdict: string };
const results: Result[] = [];
let spent = 0;

outer: for (const config of CONFIGS.filter((c) => !only || only.includes(c.id))) {
  for (let i = 0; i < runs; i++) {
    if (spent >= maxUsd) {
      console.log(`\nPlafond de dépense atteint (${spent.toFixed(3)} $ ≥ ${maxUsd} $) : arrêt.`);
      break outer;
    }
    const r = spawnSync(process.execPath, ["--no-warnings", "--env-file=.env", "scripts/xai-feasibility.mjs", "--selftest", ...config.flags], { encoding: "utf8", timeout: 400_000 });
    const out = (r.stdout ?? "") + (r.stderr ?? "");
    const usd = num(/≈ ([\d.]+) \$/, out);
    spent += usd ?? 0;
    const res: Result = {
      config,
      photoS: num(/attente avec photo\s*:\s*([\d.]+) s/, out),
      totalS: num(/avec rédaction\s*:\s*([\d.]+) s/, out),
      conf: num(/confiance moyenne ([\d.]+)/, out),
      usd,
      ok: /FAISABLE/.test(out),
      verdict: (out.match(/=== VERDICT ===\s*\n([^\n]+)/) ?? [])[1]?.slice(0, 60) ?? "(aucun verdict)",
    };
    results.push(res);
    console.log(
      `${config.id} essai ${i + 1} : photo ${res.photoS ?? "?"} s, total ${res.totalS ?? "?"} s, confiance ${res.conf ?? "?"}, coût ${usd?.toFixed(4) ?? "?"} $ — ${res.verdict}  [cumul ${spent.toFixed(3)} $]`,
    );
  }
}

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
console.log("\n| Config | Description | Essais | Attente avec photo (médiane · min–max) | Avec rédaction (médiane) | Confiance moyenne (min) | Coût moyen |");
console.log("|---|---|---|---|---|---|---|");
for (const c of CONFIGS.filter((c) => !only || only.includes(c.id))) {
  const rs = results.filter((r) => r.config.id === c.id && r.photoS !== null);
  if (!rs.length) continue;
  const photo = rs.map((r) => r.photoS!);
  const tot = rs.map((r) => r.totalS).filter((x): x is number => x !== null);
  const conf = rs.map((r) => r.conf).filter((x): x is number => x !== null);
  const usd = rs.map((r) => r.usd).filter((x): x is number => x !== null);
  console.log(
    `| ${c.id} | ${c.label} | ${rs.length} | ${med(photo)?.toFixed(1)} s · ${Math.min(...photo).toFixed(1)}–${Math.max(...photo).toFixed(1)} | ${med(tot)?.toFixed(1) ?? "—"} s | ${conf.length ? Math.min(...conf).toFixed(2) : "—"} | ${(usd.reduce((a, b) => a + b, 0) / Math.max(1, usd.length)).toFixed(4)} $ |`,
  );
}
console.log(`\nDépense totale de cette exécution : ${spent.toFixed(4)} $ (plafond ${maxUsd} $).`);
