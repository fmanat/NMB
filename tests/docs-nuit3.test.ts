import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("docs/JURISTE.md", () => {
  const t = read("docs/JURISTE.md");
  it("couvre tous les sujets demandés, chacun avec contexte, questions et passages concernés", () => {
    const topics = [
      "## 1. Loi SREN et Arcom",
      "## 2. Vérification d'âge limitée aux formules photo",
      "## 3. RGPD, article 9",
      "## 4. Transfert vers SpaceXAI LLC et conservation de 30 jours",
      "## 5. Online Safety Act",
      "## 6. Renonciation au droit de rétractation",
      "## 7. Ltd britannique avec établissement en France",
      "## 8. TVA et guichet unique (OSS)",
      "## 9. Score indulgent et pratiques commerciales trompeuses",
      "## 10. Signalement lié au filtrage d'empreintes",
    ];
    for (const h of topics) {
      expect(t, h).toContain(h);
      const body = t.split(h)[1].split(/\n## \d+\. |\n# Section à part/)[0];
      expect(body, h).toContain("**Contexte.**");
      expect(body, h).toContain("**Questions.**");
      expect(body, h).toContain("**Passages concernés.**");
    }
  });
  it("section à part pour la bêta gratuite : liste de contrôle avant ouverture au public", () => {
    expect(t).toContain("# Section à part : la bêta gratuite");
    for (const k of ["B1", "B5", "B13", "B14"]) expect(t).toContain(`| ${k} |`);
    expect(t).toMatch(/avant l'ouverture au public/i);
  });
  it("ne cite pas l'établissement en France comme existant", () => {
    expect(t).toMatch(/pas encore immatriculé/);
    expect(t).not.toMatch(/SIREN/);
  });
});

describe("docs/PASSAGE-PAYANT.md", () => {
  const t = read("docs/PASSAGE-PAYANT.md");
  it("chaque étape du tableau a un responsable, une dépendance et un délai", () => {
    const rows = t.split("\n").filter((l) => /^\| \d+ \|/.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(15);
    for (const r of rows) {
      const cells = r.split("|").map((c) => c.trim()).filter(Boolean);
      expect(cells.length, r).toBe(5);
      expect(cells[4], r).toMatch(/\d/); // un délai chiffré
    }
  });
  it("étape obligatoire : sauvegardes quotidiennes vérifiées avant tout paiement, avec test de restauration", () => {
    expect(t).toMatch(/### 7\. Sauvegardes quotidiennes de la base, \*\*vérifiées\*\* : ÉTAPE OBLIGATOIRE AVANT TOUT PAIEMENT/);
    expect(t).toContain("Tester une restauration");
    expect(t).toContain("Critère d'acceptation");
  });
  it("renvoie vers les demandes et le dossier du juriste", () => {
    for (const f of ["docs/DEMANDES/verotel.md", "docs/JURISTE.md", "docs/OUVERTURE.md"]) expect(t).toContain(f);
  });
});

describe("docs/OUVERTURE.md", () => {
  const t = read("docs/OUVERTURE.md");
  it("couvre les deux cas de domaine, les enregistrements DNS, le proxy, le chiffrement, le retrait du mot de passe et la vérification", () => {
    for (const k of ["Cas A", "Cas B", "CNAME", "TXT", "Proxied", "Full", "SITE_PASSWORD", "SITE_URL", "e2e:remote", "Bot Fight Mode", "503"]) expect(t, k).toContain(k);
  });
});
