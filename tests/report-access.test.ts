import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPORT_ACCESS } from "@/config/site";

const read = (p: string) => readFileSync(p, "utf8");

describe("durée d'accès au rapport", () => {
  it("est reportée dans la FAQ, avec la même durée que la configuration", () => {
    expect(read("content/seo/faq.md")).toContain(`au moins ${REPORT_ACCESS.minYears} ans et téléchargeable en PDF`);
  });

  it("est reportée dans les CGV, le paiement et l'accueil à partir de la configuration", () => {
    for (const f of ["src/app/cgv/page.tsx", "src/app/paiement/[id]/PayForm.tsx", "src/app/page.tsx"]) {
      expect(read(f)).toContain("REPORT_ACCESS.minYears");
    }
  });

  it("n'a plus aucune promesse d'accès à vie dans le code ni les contenus", () => {
    for (const f of ["src/app/cgv/page.tsx", "src/app/page.tsx", "content/seo/faq.md"]) {
      expect(read(f)).not.toMatch(/accès à vie/i);
    }
  });
});
