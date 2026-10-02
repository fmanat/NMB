import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LIMITS } from "@/config/site";
import { exampleReport, EXAMPLE_INPUT } from "@/lib/exampleReport";
import { aboveText } from "@/lib/format";
import * as reportModule from "@/lib/report";
import * as core from "@/lib/reportCore";
import { buildQuestionnaireReport, isOutOfReferenceRange, OUT_OF_RANGE_MESSAGE, questionnaireSchema } from "@/lib/report";
import { TRY_BOUNDS, TRY_DEFAULTS, simulate, snap } from "@/lib/tryIt";
import { DimensionMetrics, SizeReferences } from "@/components/report/ReportParts";
import { ReportDashboard } from "@/components/report/ReportDashboard";

/** Chaîne du questionnaire réel (actions.ts) : validation du schéma, plage plausible, puis calcul du rapport. */
function realPipeline(state: "rest" | "erect", length: number, girth: number) {
  const parsed = questionnaireSchema.parse({ state, length, girth, curvature: EXAMPLE_INPUT.curvature, direction: EXAMPLE_INPUT.direction });
  if (isOutOfReferenceRange(parsed)) return null;
  return buildQuestionnaireReport(parsed);
}

describe("simulation « Essayez » : équivalence avec le rapport réel", () => {
  const couples: [number, number][] = [
    [13.8, 11.9], [9.2, 9.3], [13.1, 11.7], [16.5, 13], [11.5, 10], [14.9, 12.3], [7.5, 8], [6.6, 7.4], [19.7, 16], [10.1, 9.9], [12.3, 11.1],
  ];
  for (const state of ["rest", "erect"] as const) {
    for (const [l, g] of couples) {
      it(`${state}, ${l} cm × ${g} cm : mêmes résultats que le rapport réel`, () => {
        const real = realPipeline(state, l, g);
        const sim = simulate({ state, length: l, girth: g });
        if (real === null) {
          expect(sim.kind).toBe("outOfRange");
        } else {
          expect(sim.kind).toBe("ok");
          if (sim.kind === "ok") expect(sim.results).toEqual(real);
        }
      });
    }
  }

  it("les valeurs de départ sont celles du rapport d'exemple et donnent exactement le rapport d'exemple", () => {
    expect(TRY_DEFAULTS).toEqual({ state: EXAMPLE_INPUT.state, length: EXAMPLE_INPUT.length, girth: EXAMPLE_INPUT.girth });
    const sim = simulate(TRY_DEFAULTS);
    expect(sim.kind).toBe("ok");
    if (sim.kind === "ok") expect(sim.results).toEqual(exampleReport());
  });

  it("les repères (objets du quotidien, monuments) et les percentiles viennent des fonctions du rapport", () => {
    const sim = simulate({ state: "erect", length: 15, girth: 12 });
    expect(sim.kind).toBe("ok");
    if (sim.kind !== "ok") return;
    const real = buildQuestionnaireReport({ state: "erect", length: 15, girth: 12, curvature: EXAMPLE_INPUT.curvature, direction: EXAMPLE_INPUT.direction });
    expect(sim.results.everyday).toEqual(real.everyday);
    expect(sim.results.landmarks).toEqual(real.landmarks);
    expect(sim.results.length.percentile).toBe(real.length.percentile);
    expect(sim.results.girth.percentile).toBe(real.girth.percentile);
    // Longueur 15 cm : un smartphone de 15 cm vaut exactement 1 fois.
    expect(sim.results.everyday.find((o) => o.label === "Smartphone")?.times).toBe(1);
  });

  it("le percentile monte avec la valeur, et la médiane de référence donne environ 50", () => {
    const at = (l: number) => {
      const s = simulate({ state: "erect", length: l, girth: 11.9 });
      if (s.kind !== "ok") throw new Error("hors plage");
      return s.results.length.percentile;
    };
    expect(at(12)).toBeLessThan(at(13));
    expect(at(13)).toBeLessThan(at(14));
    expect(at(13.1)).toBeGreaterThan(48);
    expect(at(13.1)).toBeLessThan(52);
  });
});

describe("simulation « Essayez » : bornes", () => {
  it("les bornes des curseurs sont celles du questionnaire", () => {
    expect(TRY_BOUNDS.length).toEqual({ min: LIMITS.length.min, max: LIMITS.length.max });
    expect(TRY_BOUNDS.girth).toEqual({ min: LIMITS.girth.min, max: LIMITS.girth.max });
    expect(TRY_BOUNDS.step).toBe(0.1);
  });

  it("aux bornes extrêmes, le comportement est celui du questionnaire : valeur refusée si hors plage plausible, jamais d'exception", () => {
    for (const state of ["rest", "erect"] as const) {
      for (const length of [TRY_BOUNDS.length.min, TRY_BOUNDS.length.max]) {
        for (const girth of [TRY_BOUNDS.girth.min, TRY_BOUNDS.girth.max]) {
          const sim = simulate({ state, length, girth });
          const real = realPipeline(state, length, girth);
          expect(sim.kind).toBe(real === null ? "outOfRange" : "ok");
        }
      }
    }
    // Le message affiché est celui du questionnaire.
    expect(OUT_OF_RANGE_MESSAGE).toMatch(/plage que ce protocole peut traiter/);
  });

  it("le plus petit et le plus grand couple plausibles donnent des percentiles bornés à 0,1 et 99,9, sans NaN", () => {
    const low = simulate({ state: "erect", length: 6.5, girth: 7.3 });
    const high = simulate({ state: "erect", length: 19.7, girth: 16 });
    for (const s of [low, high]) {
      expect(s.kind).toBe("ok");
      if (s.kind !== "ok") continue;
      for (const p of [s.results.length.percentile, s.results.girth.percentile]) {
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0.1);
        expect(p).toBeLessThanOrEqual(99.9);
      }
      expect(aboveText(s.results.length.percentile)).toMatch(/^Au-dessus de \d+ % de la population de référence$/);
    }
  });

  it("snap ramène dans les bornes, au pas de 0,1, et ignore les valeurs non finies", () => {
    expect(snap("length", 1)).toBe(2);
    expect(snap("length", 99)).toBe(30);
    expect(snap("girth", 2.9)).toBe(3);
    expect(snap("girth", 26)).toBe(25);
    expect(snap("length", 13.7999999)).toBe(13.8);
    expect(snap("length", Number.NaN)).toBe(TRY_DEFAULTS.length);
    expect(snap("girth", Infinity)).toBe(TRY_DEFAULTS.girth);
  });

  it("le module de calcul partagé et le module du rapport exposent les mêmes fonctions", () => {
    for (const k of ["buildQuestionnaireReport", "isOutOfReferenceRange", "clampPercentile", "DIRECTION_FR", "OUT_OF_RANGE_MESSAGE"] as const) {
      expect(reportModule[k]).toBe(core[k]);
    }
  });
});

describe("simulation « Essayez » : mêmes composants que le rapport", () => {
  it("cartes de longueur et de circonférence et repères de taille : identiques, octet pour octet, à ceux du tableau de bord du rapport", () => {
    const r = exampleReport();
    const dashboard = renderToStaticMarkup(createElement(ReportDashboard, { results: r }));
    const metrics = renderToStaticMarkup(createElement(DimensionMetrics, { results: r }));
    const refs = renderToStaticMarkup(createElement(SizeReferences, { results: r }));
    expect(metrics.length).toBeGreaterThan(500);
    expect(dashboard).toContain(metrics);
    expect(dashboard).toContain(refs);
  });
});

describe("simulation « Essayez » : aucun réseau, aucun stockage, aucune dépendance serveur", () => {
  const root = resolve(__dirname, "..");
  const read = (f: string) => readFileSync(f, "utf8");
  const resolveImport = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? resolve(root, "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      try {
        readFileSync(base + ext);
        return base + ext;
      } catch {
        // essai suivant
      }
    }
    return null;
  };

  // Fermeture des imports de la simulation (hors chargement différé, qui est le seul `import()` autorisé : TryItLoader).
  function closure(entry: string) {
    const seen = new Set<string>();
    const externals = new Set<string>();
    const walk = (f: string) => {
      if (seen.has(f)) return;
      seen.add(f);
      const src = read(f);
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/g)) {
        const target = resolveImport(f, m[1]);
        if (target) walk(target);
        else if (!m[1].startsWith(".") && !m[1].startsWith("@/")) externals.add(m[1]);
        else throw new Error(`import non résolu : ${m[1]} dans ${f}`);
      }
    };
    walk(entry);
    return { files: [...seen], externals: [...externals] };
  }

  const entry = resolve(root, "src/components/try/TryIt.tsx");
  const { files, externals } = closure(entry);

  it("n'importe que React (aucun zod, pg, accès serveur ou base)", () => {
    expect(externals.sort()).toEqual(["react"]);
    expect(files.some((f) => /\/(repo|db|admin|providers|vision)\b/.test(f))).toBe(false);
    expect(files.some((f) => f.endsWith("/lib/report.ts"))).toBe(false); // report.ts embarque zod : la simulation passe par reportCore.ts
  });

  it("ne contient ni requête réseau ni stockage", () => {
    const forbidden = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|document\.cookie|navigator\.clipboard)\b/;
    for (const f of files) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, f).not.toMatch(forbidden);
    }
  });

  it("le composant de simulation est chargé par import dynamique (jamais importé statiquement par la page ni le chargeur)", () => {
    const loader = read(resolve(root, "src/components/try/TryItLoader.tsx"));
    expect(loader).toMatch(/dynamic\(\(\) => import\("\.\/TryIt"\)/);
    expect(loader).not.toMatch(/^import .*["']\.\/TryIt["']/m);
    const section = read(resolve(root, "src/components/try/TrySection.tsx"));
    expect(section).not.toMatch(/from ["']\.\/TryIt["']/);
  });
});
