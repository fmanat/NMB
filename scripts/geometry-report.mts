// Mesure l'erreur du calcul géométrique sur des prises de vue SIMULÉES (aucune photo).
//   npm run geometry:report
//
// Compare l'ancien calcul (tout projeté dans le plan de la carte) au calcul avec pose de l'appareil, sur des scènes où la
// focale réelle s'écarte de la focale supposée (±20 %), avec un repérage parfait puis bruité.

import { CAMERA } from "@/config/site";
import { LONG_SIDE, runSweep } from "@/lib/vision/geometry-sweep";

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function line(label: string, len: number[], girth: number[], margin?: number[]) {
  if (!len.length) return `${label.padEnd(26)} (aucun cas)`;
  const al = len.map(Math.abs);
  const ag = girth.map(Math.abs);
  const inM = margin ? ` | dans la marge ${(len.filter((_, i) => al[i] <= margin[i] && ag[i] <= margin[i]).length / len.length * 100).toFixed(0).padStart(3)} %` : "";
  return (
    `${label.padEnd(26)} n=${String(len.length).padStart(4)} | longueur : biais ${mean(len).toFixed(1).padStart(5)} %, 90e ${q(al, 0.9).toFixed(1).padStart(4)} %, max ${Math.max(...al).toFixed(1).padStart(4)} % | ` +
    `circonf. : biais ${mean(girth).toFixed(1).padStart(5)} %, 90e ${q(ag, 0.9).toFixed(1).padStart(4)} %, max ${Math.max(...ag).toFixed(1).padStart(4)} %${inM}`
  );
}

{
  for (const noisePx of [0, 2]) {
    console.log(`\n================ Repérage ${noisePx === 0 ? "parfait" : `bruité (σ = ${noisePx} px par point)`} ================`);
    const rows = runSweep({ noisePx });
    const ok = rows.filter((r) => r.pose);
    console.log(line("ANCIEN calcul (tous)", rows.map((r) => r.legacy.len), rows.map((r) => r.legacy.girth)));
    console.log(line("NOUVEAU calcul (tous)", ok.map((r) => r.pose!.len), ok.map((r) => r.pose!.girth), ok.map((r) => r.pose!.margin)));
    console.log("\nNOUVEAU calcul, par inclinaison :");
    for (const t of [0, 15, 30, 45]) {
      const s = ok.filter((r) => r.shot.tiltDeg === t);
      console.log(line(`  inclinaison ${t}°`, s.map((r) => r.pose!.len), s.map((r) => r.pose!.girth), s.map((r) => r.pose!.margin)));
    }
    console.log("\nNOUVEAU calcul, par largeur de la carte dans l'image :");
    for (const w of [150, 250, 400, 600]) {
      const s = ok.filter((r) => r.shot.cardWidthPx === w);
      console.log(line(`  carte de ${w} px`, s.map((r) => r.pose!.len), s.map((r) => r.pose!.girth), s.map((r) => r.pose!.margin)));
    }
    console.log("\nNOUVEAU calcul, par écart de focale (réelle / supposée) :");
    for (const ratio of [0.8, 1.0, 1.2]) {
      const s = ok.filter((r) => Math.abs(r.shot.focalPx / (CAMERA.focalFactor * LONG_SIDE) - ratio) < 1e-6);
      console.log(line(`  focale × ${ratio}`, s.map((r) => r.pose!.len), s.map((r) => r.pose!.girth), s.map((r) => r.pose!.margin)));
    }
  }
}
