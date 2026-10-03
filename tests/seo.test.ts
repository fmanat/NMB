import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { faqJsonLd, getSeoPage, loadSeoPages, parseSeoFile, renderBody, sitemapEntries, SeoError, SEO_SLUGS } from "@/lib/seo";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "seo");

const header = (over: Record<string, string> = {}) => {
  const f = { slug: "faq", title: "Titre de test", metaDescription: "Description de test.", targetKeyword: "mot test", ...over };
  return `---\n${Object.entries(f).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n`;
};
const parse = (raw: string, filename = "faq.md", existing: string[] = ["faq"]) => parseSeoFile(raw, filename, new Set(existing));

describe("chargeur de pages : en-tête", () => {
  it("lit une page valide", () => {
    const p = parse(header() + "## Titre\n\nTexte.");
    expect(p.slug).toBe("faq");
    expect(p.title).toBe("Titre de test");
    expect(p.faq).toEqual([]);
    expect(p.headings).toEqual([{ depth: 2, text: "Titre", id: "titre" }]);
  });

  it("refuse un en-tête absent", () => {
    expect(() => parse("## Sans en-tête")).toThrow(/en-tête manquant/);
  });

  it("title : 60 caractères acceptés, 61 refusés (caractères, pas octets)", () => {
    expect(() => parse(header({ title: "é".repeat(60) }) + "Texte")).not.toThrow();
    expect(() => parse(header({ title: "é".repeat(61) }) + "Texte")).toThrow(/61 caractères/);
  });

  it("metaDescription : 155 acceptés, 156 refusés", () => {
    expect(() => parse(header({ metaDescription: "a".repeat(155) }) + "Texte")).not.toThrow();
    expect(() => parse(header({ metaDescription: "a".repeat(156) }) + "Texte")).toThrow(/156 caractères/);
  });

  it("champs obligatoires", () => {
    expect(() => parse("---\nslug: faq\n---\nTexte")).toThrow(/title/);
    expect(() => parse(header({ targetKeyword: "''" }) + "Texte")).toThrow(/targetKeyword/);
  });

  it("slug inconnu ou nom de fichier différent", () => {
    expect(() => parse(header({ slug: "autre" }) + "Texte", "autre.md")).toThrow(/slug inconnu/);
    expect(() => parse(header({ slug: "faq" }) + "Texte", "mauvais-nom.md")).toThrow(/doit être faq\.md/);
  });

  it("questions et sources : champs complets, adresses http(s) uniquement", () => {
    const bad = "---\nslug: faq\ntitle: T\nmetaDescription: D\ntargetKeyword: k\nfaq:\n  - q: Seulement une question\n---\nTexte";
    expect(() => parse(bad)).toThrow(/faq\[1\]\.a/);
    const badUrl = "---\nslug: faq\ntitle: T\nmetaDescription: D\ntargetKeyword: k\nsources:\n  - title: S\n    url: javascript:alert(1)\n---\nTexte";
    expect(() => parse(badUrl)).toThrow(/http\(s\)/);
  });
});

describe("chargeur de pages : corps Markdown", () => {
  const ex = new Set(["faq"]);

  it("interdit le H1 et les titres plus profonds que H3", () => {
    expect(() => renderBody("# Titre un", "f.md", ex)).toThrow(/H1/);
    expect(() => renderBody("#### Quatre", "f.md", ex)).toThrow(/H4/);
    expect(() => renderBody("## Deux\n### Trois", "f.md", ex)).not.toThrow();
  });

  it("interdit les images et le HTML brut", () => {
    expect(() => renderBody("![x](https://example.org/a.png)", "f.md", ex)).toThrow(/images/);
    expect(() => renderBody("<script>alert(1)</script>", "f.md", ex)).toThrow(/HTML brut/);
    expect(() => renderBody("Texte <b>gras</b>", "f.md", ex)).toThrow(/HTML brut/);
  });

  it("résout les liens internes par slug et /analyse ; une page pas encore présente est signalée et son lien rendu en texte simple", () => {
    const r = renderBody("[a](/analyse) [b](faq) [c](taille-repos-erection) [d](/courbure-penis-normale#x) [e](/)", "f.md", ex);
    expect(r.html).toContain('href="/analyse"');
    expect(r.html).toContain('href="/faq"');
    expect(r.html).toContain('href="/"');
    expect(r.html).not.toContain('href="/taille-repos-erection"');
    expect(r.html).not.toContain('href="/courbure-penis-normale');
    expect(r.html).toContain(" c ");
    expect(r.pending.sort()).toEqual(["courbure-penis-normale", "taille-repos-erection"]);
  });

  it("autorise les pages publiques du site (méthode, confidentialité, CGV, contact, mentions légales)", () => {
    const r = renderBody("[a](/methode) [b](confidentialite) [c](/cgv#x) [d](contact) [e](mentions-legales)", "f.md", ex);
    for (const h of ["/methode", "/confidentialite", "/cgv#x", "/contact", "/mentions-legales"]) expect(r.html).toContain(`href="${h}"`);
    expect(r.pending).toEqual([]);
  });

  it("bêta gratuite : les CGV n'existent pas, le lien devient du texte simple", () => {
    const before = process.env.FREE_BETA;
    process.env.FREE_BETA = "on";
    try {
      const r = renderBody("Voir les [conditions générales de vente](/cgv).", "f.md", ex);
      expect(r.html).not.toContain('href="/cgv"');
      expect(r.html).toContain("conditions générales de vente");
    } finally {
      if (before === undefined) delete process.env.FREE_BETA;
      else process.env.FREE_BETA = before;
    }
    expect(renderBody("[CGV](/cgv)", "f.md", ex).html).toContain('href="/cgv"');
  });

  it("refuse un lien interne inconnu ou un schéma dangereux", () => {
    expect(() => renderBody("[x](page-inconnue)", "f.md", ex)).toThrow(/lien interne inconnu/);
    expect(() => renderBody("[x](/r/abc)", "f.md", ex)).toThrow(/lien interne inconnu/);
    expect(() => renderBody("[x](javascript:alert(1))", "f.md", ex)).toThrow(SeoError);
  });

  it("liens externes : ouverts avec noopener nofollow", () => {
    const r = renderBody("[s](https://example.org/etude)", "f.md", ex);
    expect(r.html).toContain('rel="noopener nofollow"');
    expect(r.html).toContain('href="https://example.org/etude"');
  });

  it("identifiants de titres uniques, sans accents, et compte de mots", () => {
    const r = renderBody("## Écart moyen\n\nUn deux trois.\n\n## Écart moyen\n\nQuatre cinq.", "f.md", ex);
    expect(r.headings.map((h) => h.id)).toEqual(["ecart-moyen", "ecart-moyen-2"]);
    expect(r.words).toBe(2 + 3 + 2 + 2);
  });

  it("le texte est échappé : pas d'injection par le contenu d'un lien ou d'un titre", () => {
    const r = renderBody('## Titre "x"\n\n[a"onmouseover="alert(1)](https://example.org/q"r)', "f.md", ex);
    expect(r.html).not.toContain('onmouseover="alert');
  });
});

describe("dossier content/seo", () => {
  it("charge uniquement les fichiers nommés d'après un slug attendu, dans l'ordre du cahier des charges", () => {
    const pages = loadSeoPages(FIXTURES);
    expect(pages.map((p) => p.slug)).toEqual(["courbure-penis-normale", "faq"]);
    expect(SEO_SLUGS.indexOf("courbure-penis-normale")).toBeLessThan(SEO_SLUGS.indexOf("faq"));
  });

  it("les liens vers une page présente ne sont pas signalés comme manquants", () => {
    const faq = getSeoPage("faq", FIXTURES)!;
    expect(faq.pendingLinks).toEqual([]);
    expect(faq.bodyHtml).toContain('href="/courbure-penis-normale"');
  });

  it("page absente ou slug inconnu : null ; dossier absent : liste vide", () => {
    expect(getSeoPage("taille-repos-erection", FIXTURES)).toBeNull();
    expect(getSeoPage("n-importe-quoi", FIXTURES)).toBeNull();
    expect(loadSeoPages(join(FIXTURES, "nexiste-pas"))).toEqual([]);
  });
});

describe("balisage FAQ (schema.org) et sitemap", () => {
  it("FAQPage valide, sans balise exploitable", () => {
    expect(faqJsonLd({ faq: [] })).toBeNull();
    const json = faqJsonLd({ faq: [{ q: "Pourquoi </script> ?", a: "Parce que <b>oui</b>." }] })!;
    expect(json).not.toContain("<");
    const data = JSON.parse(json);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity[0]["@type"]).toBe("Question");
    expect(data.mainEntity[0].acceptedAnswer.text).toContain("oui");
  });

  it("le sitemap ne contient les pages de contenu qu'une fois publiées, jamais de page privée", () => {
    const pages = [{ slug: "faq" as const, modifiedAt: new Date("2026-01-01"), verified: null }];
    const off = sitemapEntries("https://exemple.fr", pages, false).map((e) => e.url);
    const on = sitemapEntries("https://exemple.fr", pages, true).map((e) => e.url);
    expect(off).not.toContain("https://exemple.fr/faq");
    expect(on).toContain("https://exemple.fr/faq");
    for (const u of on) for (const priv of ["/r/", "/paiement", "/c/", "/defi", "/api", "/analyse", "/verification-age"]) expect(u).not.toContain(priv);
  });
});
