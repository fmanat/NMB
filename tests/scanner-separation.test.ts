import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScannerBand } from "@/components/scanner/ScannerBand";
import { exampleReport } from "@/lib/exampleReport";
import * as scanner3d from "@/lib/scanner3d";
import * as silhouette from "@/lib/scannerSilhouette";

// Décision du propriétaire (03/10/2026, docs/DECISIONS.md) : la silhouette stylisée n'existe QUE dans le moteur canvas du bandeau
// de l'accueil. Le repli statique (SVG du serveur) et toutes les images de partage / Open Graph restent sur le cylindre abstrait.
// Ces tests empêchent qu'une régression glisse la silhouette ailleurs.

const SILHOUETTE = "src/lib/scannerSilhouette.ts";
const ENGINE = "src/components/scanner/scannerEngine.ts";
const exts = [".ts", ".tsx"];

function resolveModule(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(from), spec);
  else return null; // paquet externe
  base = normalize(base);
  for (const c of [base, ...exts.map((e) => base + e), ...exts.map((e) => join(base, "index" + e))]) {
    if (existsSync(c) && statSync(c).isFile()) return c.split("\\").join("/");
  }
  return null;
}

/** Imports d'un fichier. `dynamic` : import("…") ; `static` : import … from / export … from / import "…". */
function importsOf(file: string): { static: string[]; dynamic: string[] } {
  const src = readFileSync(file, "utf8");
  const stat: string[] = [];
  const dyn: string[] = [];
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']/g)) stat.push(m[1]);
  for (const m of src.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)) stat.push(m[1]);
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) dyn.push(m[1]);
  const res = (l: string[]) => l.map((s) => resolveModule(file, s)).filter((x): x is string => x !== null);
  return { static: res(stat), dynamic: res(dyn) };
}

/** Fermeture des imports à partir d'un fichier. `withDynamic` : suit aussi les import() (chargement différé compris). */
function closure(entry: string, withDynamic: boolean): Set<string> {
  const seen = new Set<string>();
  const todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const i = importsOf(f);
    todo.push(...i.static, ...(withDynamic ? i.dynamic : []));
  }
  return seen;
}

function allSources(dir = "src"): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return allSources(p);
    return exts.some((e) => p.endsWith(e)) ? [p.split("\\").join("/")] : [];
  });
}

describe("l'analyse d'imports voit bien ce qu'elle doit voir (test de sensibilité)", () => {
  it("le moteur importe la silhouette ; la coque ne l'atteint que par import dynamique", () => {
    expect(importsOf(ENGINE).static).toContain(SILHOUETTE);
    const shell = "src/components/scanner/ScannerShell.tsx";
    expect(importsOf(shell).dynamic).toContain(ENGINE);
    expect(closure(shell, false).has(SILHOUETTE)).toBe(false);
    expect(closure(shell, true).has(SILHOUETTE)).toBe(true);
  });
});

describe("la silhouette n'est utilisée que par le moteur animé", () => {
  it("seul scannerEngine.ts importe le module de la silhouette (ni statiquement ni dynamiquement)", () => {
    const importers = allSources().filter((f) => {
      const i = importsOf(f);
      return i.static.includes(SILHOUETTE) || i.dynamic.includes(SILHOUETTE);
    });
    expect(importers).toEqual([ENGINE]);
  });

  it("le module du cylindre (scanner3d.ts) n'importe pas la silhouette, même indirectement", () => {
    expect(closure("src/lib/scanner3d.ts", true).has(SILHOUETTE)).toBe(false);
    expect(readFileSync("src/lib/scanner3d.ts", "utf8")).not.toMatch(/silhouette/i);
  });

  it("le module de la silhouette ne tire rien d'autre que des constantes et fonctions pures (pas de React, pas de serveur)", () => {
    const c = [...closure(SILHOUETTE, true)].sort();
    expect(c.every((f) => f.startsWith("src/lib/") || f.startsWith("src/config/"))).toBe(true);
  });
});

describe("le repli statique reste le cylindre abstrait", () => {
  it("ScannerBand.tsx (repli SVG) n'importe ni n'utilise la silhouette, ni statiquement ni par sa fermeture statique", () => {
    const band = "src/components/scanner/ScannerBand.tsx";
    expect(closure(band, false).has(SILHOUETTE)).toBe(false);
    expect(closure(band, false).has(ENGINE)).toBe(false);
    const src = readFileSync(band, "utf8");
    for (const name of Object.keys(silhouette)) expect(src.includes(name), `ScannerBand.tsx utilise ${name}`).toBe(false);
    // …et il s'appuie bien sur la géométrie du cylindre.
    expect(importsOf(band).static).toContain("src/lib/scanner3d.ts");
    expect(src).toContain("generateCylinderPoints");
  });

  it("la géométrie du cylindre est conservée, intacte, dans scanner3d.ts", () => {
    for (const name of ["CYLINDER", "generateCylinderPoints", "ringPolyline", "ringHeights", "scanHeight", "scanProximity", "project", "STATIC_VIEW"]) {
      expect(name in scanner3d, name).toBe(true);
    }
    expect(scanner3d.CYLINDER).toEqual({ radius: 1, halfHeight: 0.85 });
  });

  const ex = exampleReport();
  const svgOf = (html: string) => html.match(/<svg[\s\S]*?<\/svg>/)![0];
  const golden = readFileSync("tests/fixtures/scanner-fallback.svg", "utf8").trimEnd();

  it("le SVG du repli est identique, octet pour octet, à celui du cylindre d'avant la silhouette", () => {
    const html = renderToStaticMarkup(createElement(ScannerBand, { ex }));
    const svg = svgOf(html);
    expect(svg).toBe(golden);
    expect(svg).not.toContain("<canvas");
  });

  it("le SVG du repli ne dépend pas de la courbure du rapport (la silhouette, elle, en dépend)", () => {
    const other = { ...ex, curvature: { category: "marked" as const, angleDeg: 35, direction: "right" as const } };
    const svg = svgOf(renderToStaticMarkup(createElement(ScannerBand, { ex: other })));
    expect(svg).toBe(golden);
    expect(silhouette.silhouetteSpec(other.curvature).bendDir).not.toEqual(silhouette.silhouetteSpec(ex.curvature).bendDir);
  });

  it("le texte réservé aux lecteurs d'écran reste sobre : visualisation schématique de mesure, sans description de forme", () => {
    const html = renderToStaticMarkup(createElement(ScannerBand, { ex }));
    const sr = html.match(/<span class="sr-only">([\s\S]*?)<\/span>/)?.[1] ?? "";
    expect(sr).toContain("Visualisation schématique de mesure");
    const banned = ["pénis", "penis", "verge", "gland", "sexe", "organe", "érection", "tige", "anatom", "cylindre", "silhouette"];
    for (const w of banned) expect(sr.toLowerCase().includes(w), `« ${w} » dans le texte alternatif`).toBe(false);
    // Le texte alternatif est identique pour le repli et pour le moteur (un seul texte).
    expect((html.match(/Visualisation schématique de mesure/g) ?? []).length).toBe(1);
  });
});

describe("les images de partage et Open Graph n'utilisent ni la silhouette ni le bandeau", () => {
  const entries = [
    "src/lib/cardImage.tsx",
    "src/app/og/neutre/route.tsx",
    "src/app/c/[id]/og/route.tsx",
    "src/app/c/[id]/story/route.tsx",
  ];
  const silhouetteNames = Object.keys(silhouette);
  const scannerFiles = [SILHOUETTE, ENGINE, "src/components/scanner/ScannerBand.tsx", "src/components/scanner/ScannerShell.tsx", "src/lib/scanner3d.ts"];

  for (const entry of entries) {
    it(`${entry} : fermeture des imports (dynamiques comprises) sans silhouette, moteur ni bandeau`, () => {
      expect(existsSync(entry)).toBe(true);
      const c = closure(entry, true);
      for (const f of scannerFiles) expect(c.has(f), `${entry} atteint ${f}`).toBe(false);
      // Les sources de la chaîne ne mentionnent aucun export de la silhouette.
      for (const f of c) {
        const src = readFileSync(f, "utf8");
        for (const n of silhouetteNames) {
          if (n.length < 8) continue; // noms courts (PROFILE, …) : ambigus, la fermeture des imports suffit
          expect(src.includes(n), `${relative(".", f)} mentionne ${n}`).toBe(false);
        }
      }
    });
  }

  it("toutes les routes d'image de l'application (og, story, icônes, opengraph-image) sont couvertes : aucune n'atteint la silhouette", () => {
    const imageFiles = allSources("src/app").filter((f) => /(^|\/)(og|story|opengraph-image|twitter-image|icon|apple-icon)(\/|\.|$)/.test(f) && /(route|opengraph-image|twitter-image|icon|apple-icon)\.tsx?$/.test(f));
    expect(imageFiles.length).toBeGreaterThanOrEqual(entries.length - 1); // au moins les routes connues (cardImage est une bibliothèque)
    for (const f of imageFiles) {
      const c = closure(f, true);
      for (const s of scannerFiles) expect(c.has(s), `${f} atteint ${s}`).toBe(false);
    }
  });

  it("seule la page d'accueil importe le bandeau ; aucune autre page, e-mail ou carte ne le fait", () => {
    const users = allSources().filter((f) => {
      const i = importsOf(f);
      return [...i.static, ...i.dynamic].some((x) => x.startsWith("src/components/scanner/") && f !== ENGINE && !f.startsWith("src/components/scanner/"));
    });
    expect(users).toEqual(["src/app/page.tsx"]);
  });
});
