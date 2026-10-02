import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exampleReport } from "@/lib/exampleReport";
import {
  CLASSES,
  CLASS_LABEL,
  HIGH_FROM,
  LOW_BELOW,
  PROFILES,
  RANK,
  classOf,
  profileById,
  profileFor,
  type ProfileClass,
} from "@/lib/profiles";
import { buildQuestionnaireReport, isOutOfReferenceRange } from "@/lib/reportCore";
import { buildCardContent } from "@/lib/share";
import { ReportDashboard } from "@/components/report/ReportDashboard";
import { ProfileCard } from "@/components/report/ProfileCard";

// Les seuils sont écrits EN DUR ici (et non lus dans le module) : si quelqu'un les change, ce test doit le voir.
const LOW = 33;
const HIGH = 67;
const expectedClass = (p: number): ProfileClass => (p < LOW ? "low" : p < HIGH ? "mid" : "high");

describe("seuils : constantes nommées et bornes exactes", () => {
  it("les constantes valent 33 et 67", () => {
    expect(LOW_BELOW).toBe(LOW);
    expect(HIGH_FROM).toBe(HIGH);
    expect(CLASS_LABEL.low).toContain(String(LOW));
    expect(CLASS_LABEL.mid).toContain(String(LOW));
    expect(CLASS_LABEL.mid).toContain(String(HIGH));
    expect(CLASS_LABEL.high).toContain(String(HIGH));
  });

  it("chaque classe contient sa borne basse : 33 est « moyen », 67 est « haut »", () => {
    expect(classOf(0)).toBe("low");
    expect(classOf(0.1)).toBe("low");
    expect(classOf(32.9)).toBe("low");
    expect(classOf(32.94)).toBe("low"); // arrondi à 32,9 comme dans le rapport
    expect(classOf(33)).toBe("mid");
    expect(classOf(33.0)).toBe("mid");
    expect(classOf(33.1)).toBe("mid");
    expect(classOf(66.9)).toBe("mid");
    expect(classOf(66.94)).toBe("mid");
    expect(classOf(67)).toBe("high");
    expect(classOf(67.1)).toBe("high");
    expect(classOf(99.9)).toBe("high");
    expect(classOf(100)).toBe("high");
  });

  it("le percentile est arrondi à une décimale avant la comparaison (comme dans le rapport)", () => {
    expect(classOf(32.96)).toBe("mid"); // affiché 33,0
    expect(classOf(66.96)).toBe("high"); // affiché 67,0
    expect(classOf(33.04)).toBe("mid");
  });

  it("valeur non finie : erreur explicite, jamais un profil au hasard", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => classOf(bad)).toThrow(RangeError);
      expect(() => profileFor(bad, 50)).toThrow(RangeError);
      expect(() => profileFor(50, bad)).toThrow(RangeError);
    }
  });

  it("même règle aux deux axes", () => {
    for (const p of [0, 10, 32.9, 33, 50, 66.9, 67, 90, 100]) {
      const byLength = profileFor(p, 50);
      const byGirth = profileFor(50, p);
      expect(byLength.lengthClass).toBe(expectedClass(p));
      expect(byGirth.girthClass).toBe(expectedClass(p));
    }
  });
});

describe("les neuf profils", () => {
  it("exactement neuf, une case de la grille chacun, identifiants stables", () => {
    expect(PROFILES).toHaveLength(9);
    const cells = new Set(PROFILES.map((p) => `${p.lengthClass}/${p.girthClass}`));
    expect(cells.size).toBe(9);
    for (const l of CLASSES) for (const c of CLASSES) expect(cells.has(`${l}/${c}`)).toBe(true);
    // Les identifiants ne doivent JAMAIS changer (ils sont enregistrés dans les cartes de partage).
    expect(PROFILES.map((p) => p.id)).toEqual(["l1c1", "l1c2", "l1c3", "l2c1", "l2c2", "l2c3", "l3c1", "l3c2", "l3c3"]);
    for (const p of PROFILES) expect(p.id).toBe(`l${RANK[p.lengthClass]}c${RANK[p.girthClass]}`);
  });

  it("noms uniques, descriptions uniques, rien de vide", () => {
    expect(new Set(PROFILES.map((p) => p.name)).size).toBe(9);
    expect(new Set(PROFILES.map((p) => p.description)).size).toBe(9);
    expect(new Set(PROFILES.map((p) => p.id)).size).toBe(9);
    for (const p of PROFILES) {
      expect(p.name.trim().length).toBeGreaterThan(2);
      expect(p.description.trim().length).toBeGreaterThan(20);
    }
  });

  it("profileById retrouve chaque profil et ignore les identifiants inconnus", () => {
    for (const p of PROFILES) expect(profileById(p.id)).toBe(p);
    for (const bad of ["", "l4c1", "L1C1", "x", undefined, null, 12, {}]) expect(profileById(bad)).toBeUndefined();
  });
});

describe("rédaction : sobre, neutre, sans chiffre ni terme blessant", () => {
  // Liste de termes (mots entiers, insensible à la casse) qu'aucun nom ni aucune phrase ne doit contenir.
  const VULGAR_OR_DEMEANING = [
    // vulgarité et argot
    "bite", "bites", "zob", "queue", "sexe", "verge", "pénis", "penis", "kiki", "nouille", "chibre", "engin", "bander", "burne", "couille", "couilles",
    // dénigrement et jugement de valeur
    "petit", "petite", "petits", "minuscule", "micro", "mini", "nain", "court", "courte", "faible", "nul", "nulle", "pauvre", "maigre", "chétif", "chétive",
    "insuffisant", "insuffisante", "déficient", "raté", "ratée", "honte", "ridicule", "complexe", "gros", "grosse", "énorme", "géant", "monstre", "monstrueux",
    "trop", "anormal", "anormale", "normal", "normale", "norme", "idéal", "idéale", "parfait", "parfaite", "meilleur", "meilleure", "pire", "mieux",
    "défaut", "problème", "carence", "manque", "mauvais", "mauvaise", "bon", "bonne", "champion", "record", "supérieur", "inférieur", "médiocre", "moyen", "moyenne",
    // promesses médicales
    "santé", "médical", "médicale", "diagnostic", "guérir", "soigner", "traitement", "pathologie", "performance", "garanti",
    // anatomie
    "corps", "organe", "peau", "gland", "érection", "repos",
  ];
  const NUMBER_WORDS = ["zéro", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "vingt", "cent", "mille", "million", "premier", "seconde", "dernier", "double", "triple", "moitié", "tiers", "quart"];
  const hasWord = (text: string, word: string) => new RegExp(`(?<![\\p{L}])${word}(?![\\p{L}])`, "iu").test(text);

  for (const p of PROFILES) {
    const texts: [string, string][] = [["nom", p.name], ["phrase", p.description]];
    for (const [kind, text] of texts) {
      it(`${p.id} (${p.name}) : ${kind} sans chiffre ni nombre en lettres`, () => {
        expect(text).not.toMatch(/\d/);
        for (const w of NUMBER_WORDS) expect(hasWord(text, w), `« ${w} » dans « ${text} »`).toBe(false);
      });
      it(`${p.id} (${p.name}) : ${kind} sans terme vulgaire, dénigrant, médical ni anatomique`, () => {
        for (const w of VULGAR_OR_DEMEANING) expect(hasWord(text, w), `« ${w} » dans « ${text} »`).toBe(false);
      });
    }
    it(`${p.id} (${p.name}) : la description est une seule phrase`, () => {
      expect(p.description.endsWith(".")).toBe(true);
      expect(p.description.slice(0, -1)).not.toMatch(/[.!?…]/); // un seul point final, aucune autre phrase
      expect(p.description.length).toBeLessThanOrEqual(200);
    });
  }

  it("le test de sensibilité : la liste détecte bien un terme interdit et un chiffre", () => {
    expect(hasWord("Un profil petit mais fier", "petit")).toBe(true);
    expect(hasWord("Un profil habite ici", "bite")).toBe(false); // mot entier seulement
    expect(/\d/.test("Profil 7")).toBe(true);
    expect(hasWord("Le deuxième", "deux")).toBe(false);
    expect(hasWord("deux profils", "deux")).toBe(true);
  });
});

describe("profileFor : cohérence avec les percentiles du rapport", () => {
  it("monotonie : en augmentant un percentile, la classe de cet axe ne baisse jamais, l'autre axe ne bouge pas", () => {
    for (let fixed = 0; fixed <= 100; fixed += 5) {
      let prevL = 0;
      let prevC = 0;
      for (let p = 0; p <= 100; p += 0.1) {
        const a = profileFor(p, fixed);
        const b = profileFor(fixed, p);
        expect(RANK[a.lengthClass]).toBeGreaterThanOrEqual(prevL);
        expect(RANK[b.girthClass]).toBeGreaterThanOrEqual(prevC);
        expect(a.girthClass).toBe(expectedClass(fixed));
        expect(b.lengthClass).toBe(expectedClass(fixed));
        prevL = RANK[a.lengthClass];
        prevC = RANK[b.girthClass];
      }
    }
  });

  it("chaque case est atteignable par des percentiles possibles (0,1 à 99,9, pas de 0,1)", () => {
    const seen = new Set<string>();
    for (let l = 0.1; l <= 99.9; l += 0.1) for (const c of [0.1, 20, 33, 50, 66.9, 67, 99.9]) seen.add(profileFor(l, c).id);
    for (let c = 0.1; c <= 99.9; c += 0.1) for (const l of [0.1, 20, 33, 50, 66.9, 67, 99.9]) seen.add(profileFor(l, c).id);
    expect([...seen].sort()).toEqual(PROFILES.map((p) => p.id));
  });

  it("sur de vrais rapports (au repos et en érection, plage plausible) : le profil suit les percentiles du rapport, les neuf cas sont atteints", () => {
    for (const state of ["rest", "erect"] as const) {
      const seen = new Set<string>();
      for (let length = 4; length <= 22; length = Math.round((length + 0.1) * 10) / 10) {
        for (let girth = 5; girth <= 18; girth = Math.round((girth + 0.1) * 10) / 10) {
          if (isOutOfReferenceRange({ state, length, girth })) continue;
          const r = buildQuestionnaireReport({ state, length, girth, curvature: "none", direction: "none" });
          const p = profileFor(r.length.percentile, r.girth.percentile);
          expect(p.lengthClass, `${state} ${length}×${girth}`).toBe(expectedClass(r.length.percentile));
          expect(p.girthClass, `${state} ${length}×${girth}`).toBe(expectedClass(r.girth.percentile));
          seen.add(p.id);
        }
      }
      expect(seen.size, state).toBe(9);
    }
  });

  it("le profil ne dépend que des deux percentiles : la courbure, la direction et le score n'y changent rien", () => {
    const base = { state: "erect", length: 13.1, girth: 11.7 } as const;
    const ids = new Set(
      (["none", "light", "marked"] as const).flatMap((curvature) =>
        (["none", "left", "up"] as const).map((direction) => {
          const r = buildQuestionnaireReport({ ...base, curvature, direction });
          return profileFor(r.length.percentile, r.girth.percentile).id;
        }),
      ),
    );
    expect([...ids]).toEqual(["l2c2"]);
  });

  it("valeurs connues (érection : longueur 13,12 cm et circonférence 11,66 cm sont les médianes de référence)", () => {
    const at = (length: number, girth: number) => {
      const r = buildQuestionnaireReport({ state: "erect", length, girth, curvature: "none", direction: "none" });
      return profileFor(r.length.percentile, r.girth.percentile).id;
    };
    expect(at(11, 10)).toBe("l1c1");
    expect(at(11, 11.7)).toBe("l1c2");
    expect(at(11, 14)).toBe("l1c3");
    expect(at(13.1, 10)).toBe("l2c1");
    expect(at(13.1, 11.7)).toBe("l2c2");
    expect(at(13.1, 14)).toBe("l2c3");
    expect(at(16, 10)).toBe("l3c1");
    expect(at(16, 11.7)).toBe("l3c2");
    expect(at(16, 14)).toBe("l3c3");
  });

  it("le rapport d'exemple de l'accueil a son profil (case centrale)", () => {
    const r = exampleReport();
    expect(profileFor(r.length.percentile, r.girth.percentile).id).toBe("l2c2");
  });
});

describe("affichage", () => {
  it("la carte de profil du rapport montre le nom et la phrase, marque l'exemple, sans chiffre", () => {
    const r = exampleReport();
    const p = profileFor(r.length.percentile, r.girth.percentile);
    const html = renderToStaticMarkup(createElement(ProfileCard, { results: r, example: true }));
    expect(html).toContain(p.name.replace("'", "&#x27;"));
    expect(html).toContain(p.description.replace(/'/g, "&#x27;"));
    expect(html).toContain("Exemple fictif");
    expect(html).toContain(`data-profile="${p.id}"`);
    const real = renderToStaticMarkup(createElement(ProfileCard, { results: r }));
    expect(real).not.toContain("Exemple fictif");
  });

  it("le tableau de bord (rapport réel et exemple) contient le profil", () => {
    const r = exampleReport();
    expect(renderToStaticMarkup(createElement(ReportDashboard, { results: r }))).toContain("Profil morphologique");
    expect(renderToStaticMarkup(createElement(ReportDashboard, { results: r, example: true }))).toContain("Profil morphologique");
  });
});

describe("carte de partage : le profil n'apparaît que si l'utilisateur le choisit", () => {
  const r = buildQuestionnaireReport({ state: "erect", length: 16, girth: 10, curvature: "none", direction: "none" });
  const id = "x".repeat(43);

  it("par défaut (aucune option), aucune trace du profil dans le contenu enregistré", () => {
    for (const options of [
      { mode: "score" as const },
      { mode: "score" as const, profile: false },
      { mode: "percentiles" as const, percentiles: ["length" as const] },
      { mode: "landmark" as const, landmark: "Tour Eiffel" },
    ]) {
      const c = buildCardContent(r, id, options);
      expect("profile" in c).toBe(false);
      expect(JSON.stringify(c)).not.toMatch(/"profile"|l\dc\d/);
    }
  });

  it("choisi : l'identifiant stable du profil, avec chacun des modes", () => {
    expect(buildCardContent(r, id, { mode: "score", profile: true }).profile).toBe("l3c1");
    expect(buildCardContent(r, id, { mode: "percentiles", percentiles: ["girth"], profile: true }).profile).toBe("l3c1");
    expect(buildCardContent(r, id, { mode: "landmark", landmark: "Tour Eiffel", profile: true }).profile).toBe("l3c1");
  });

  it("seule la valeur booléenne vraie l'active (jamais une chaîne ni un nombre)", () => {
    for (const bad of ["true", "on", 1, "oui"]) expect("profile" in buildCardContent(r, id, { mode: "score", profile: bad as never })).toBe(false);
  });

  it("le contenu choisi ne contient que l'identifiant, ni nom ni percentile ni mesure", () => {
    const json = JSON.stringify(buildCardContent(r, id, { mode: "score", profile: true }));
    expect(json).toContain('"profile":"l3c1"');
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(["basis", "dossier", "landmark", "percentiles", "profile", "score"]);
    for (const hidden of ["girth", "length", "Longiligne", "description"]) expect(json).not.toContain(hidden);
  });
});
