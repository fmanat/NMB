// Affiche les chiffres du kit presse (docs/PRESSE), calculés avec les fonctions du site : à relancer après toute mise à jour des références.
//
//   npm run presse:chiffres
//
// Sources : Veale et al., BJU International, 2015 (moyennes, écarts-types, effectifs) et loi normale du site (percentiles, proportions).

import { evalFigure } from "@/lib/seoFigures";

const LIGNES: [string, string][] = [
  ["Longueur moyenne en érection (Veale)", "moyenne:erect-length"],
  ["Écart-type de la longueur en érection (Veale)", "ecart-type:erect-length"],
  ["Hommes mesurés, longueur en érection (Veale)", "effectif:erect-length"],
  ["Longueur moyenne au repos (Veale)", "moyenne:rest-length"],
  ["Hommes mesurés, longueur au repos (Veale)", "effectif:rest-length"],
  ["Circonférence moyenne en érection (Veale)", "moyenne:erect-girth"],
  ["Hommes mesurés, circonférence en érection (Veale)", "effectif:erect-girth"],
  ["25e percentile, longueur en érection", "quantile:erect-length:25"],
  ["75e percentile, longueur en érection", "quantile:erect-length:75"],
  ["5e percentile, longueur en érection", "quantile:erect-length:5"],
  ["95e percentile, longueur en érection", "quantile:erect-length:95"],
  ["Part entre 12 et 14 cm en érection", "entre:erect-length:12:14"],
  ["Rang de 10 cm au repos", "rang:rest-length:10"],
  ["Rang de 10 cm en érection", "rang:erect-length:10"],
  ["Rang de 13,5 cm en érection", "rang:erect-length:13.5"],
  ["Rang de 14,5 cm en érection", "rang:erect-length:14.5"],
];

for (const [libelle, jeton] of LIGNES) console.log(`${libelle.padEnd(52)} ${evalFigure(jeton)}`);
