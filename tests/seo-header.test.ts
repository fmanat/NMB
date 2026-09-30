import { describe, expect, it } from "vitest";
import { parseSeoFile } from "@/lib/seo";

const parse = (raw: string) => parseSeoFile(raw, "faq.md", new Set(["faq"]));
const wrap = (header: string) => `---\n${header}\n---\nTexte.`;
const base = "slug: faq\ntitle: T\nmetaDescription: D\ntargetKeyword: k";

describe("en-tête au format du cahier des charges (sans guillemets)", () => {
  it("accepte « espace deux-points espace » dans les valeurs, sans guillemets", () => {
    const p = parse(
      wrap(
        "slug: faq\ntitle: Taille moyenne : que disent les études ?\nmetaDescription: Description : avec deux-points.\ntargetKeyword: mot\n" +
          "faq:\n  - q: Question : avec deux-points ?\n    a: Réponse : oui.\n" +
          "sources:\n  - title: Auteur — Congenital penile curvature: French guidelines\n    url: https://exemple.org/a?x=1&y=2",
      ),
    );
    expect(p.title).toBe("Taille moyenne : que disent les études ?");
    expect(p.metaDescription).toBe("Description : avec deux-points.");
    expect(p.faq).toEqual([{ q: "Question : avec deux-points ?", a: "Réponse : oui." }]);
    expect(p.sources).toEqual([{ title: "Auteur — Congenital penile curvature: French guidelines", url: "https://exemple.org/a?x=1&y=2" }]);
  });

  it("conserve apostrophes typographiques et guillemets français tels quels", () => {
    const p = parse(wrap(`${base}\nfaq:\n  - q: Qu’est-ce qu’un « grower » ?\n    a: C’est descriptif.`));
    expect(p.faq[0]).toEqual({ q: "Qu’est-ce qu’un « grower » ?", a: "C’est descriptif." });
  });

  it("accepte aussi des valeurs entre guillemets, qui sont retirés", () => {
    expect(parse(wrap(`slug: faq\ntitle: "Titre : entre guillemets"\nmetaDescription: D\ntargetKeyword: k`)).title).toBe("Titre : entre guillemets");
  });

  it("plusieurs éléments de liste, dans l'ordre", () => {
    const p = parse(wrap(`${base}\nfaq:\n  - q: Un ?\n    a: A1.\n  - q: Deux ?\n    a: A2.`));
    expect(p.faq.map((f) => f.q)).toEqual(["Un ?", "Deux ?"]);
  });

  it("signale un champ inconnu (faute de frappe), avec le numéro de ligne", () => {
    expect(() => parse(wrap(`${base}\ntargetKeywords: x`))).toThrow(/ligne 6 du fichier : champ inconnu « targetKeywords »/);
  });

  it("signale un champ en double, une clé inconnue dans une liste, une ligne non reconnue", () => {
    expect(() => parse(wrap(`${base}\ntitle: Autre`))).toThrow(/présent deux fois/);
    expect(() => parse(wrap(`${base}\nfaq:\n  - question: X\n    a: Y`))).toThrow(/clé « question » inconnue/);
    expect(() => parse(wrap(`${base}\nn'importe quoi`))).toThrow(/ligne non reconnue/);
  });

  it("une liste doit être introduite sans valeur sur la même ligne", () => {
    expect(() => parse(wrap(`${base}\nfaq: oui`))).toThrow(/doit être suivi d'une liste/);
  });

  it("une réponse sans question est refusée", () => {
    expect(() => parse(wrap(`${base}\nfaq:\n  - a: Réponse seule`))).toThrow(/faq\[1\]\.q/);
  });
});
