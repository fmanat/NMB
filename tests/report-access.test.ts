import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPORT_ACCESS } from "@/config/site";

const read = (p: string) => readFileSync(p, "utf8");

describe("durée d'accès au rapport", () => {
  it("est reportée dans la FAQ, avec la même durée que la configuration", () => {
    expect(read("content/seo/faq.md")).toContain(`au moins ${REPORT_ACCESS.minYears} ans et téléchargeable en PDF`);
  });

  it("est reportée dans les CGV, l'accueil et le rapport à partir de la configuration", () => {
    // La page de paiement est réduite au prix, à la renonciation et au bouton (04/10/2026) : la durée est dans les conditions.
    for (const f of ["src/app/cgv/page.tsx", "src/app/page.tsx", "src/app/r/[id]/page.tsx"]) {
      expect(read(f)).toContain("REPORT_ACCESS.minYears");
    }
  });

  it("n'a plus aucune promesse d'accès à vie dans le code ni les contenus", () => {
    for (const f of ["src/app/cgv/page.tsx", "src/app/page.tsx", "content/seo/faq.md"]) {
      expect(read(f)).not.toMatch(/accès à vie/i);
    }
  });
});
