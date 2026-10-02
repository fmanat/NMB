import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

describe("animations d'apparition : variables et règles (design system section 37)", () => {
  it("variables de durée et d'accélération exactes", () => {
    expect(css).toMatch(/--duration-fast:\s*150ms/);
    expect(css).toMatch(/--duration-normal:\s*200ms/);
    expect(css).toMatch(/--duration-slow:\s*400ms/);
    expect(css).toMatch(/--duration-data:\s*700ms/);
    expect(css).toMatch(/--ease-standard:\s*cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  });
  it("aucune animation hors état « run » (sans JavaScript, la valeur finale s'affiche)", () => {
    for (const m of css.matchAll(/^([^\n{]*)\{[^}]*\banimation:[^}]*\}/gm)) {
      const sel = m[1];
      if (/\.ticker|@keyframes/.test(sel)) continue;
      if (/\.anim-/.test(sel)) expect(sel).toContain('[data-reveal="run"]');
    }
  });
  it("mouvement réduit : animations et transitions des données désactivées", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\[data-reveal\] \.anim-ring[^}]*animation: none !important; transition: none !important/);
  });
  it("l'état de départ masque des tracés et marqueurs, jamais du texte", () => {
    const pending = [...css.matchAll(/\[data-reveal="pending"\][^{]*\{/g)].map((m) => m[0]);
    for (const p of pending) expect(p).toMatch(/\.anim-/);
  });
});
