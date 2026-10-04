import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { umamiBeforeSend, umamiWebsiteId } from "@/lib/umami";

const ID = "0dc8016e-4a93-499c-92f8-5154bc743fed";
const send = (path: string, url: string, referrer = "", gpc = false) => umamiBeforeSend("event", { url, referrer, title: "Titre" }, { path, gpc });

describe("Umami : activation", () => {
  it("seulement avec un identifiant de site valide", () => {
    expect(umamiWebsiteId({ UMAMI_WEBSITE_ID: ID })).toBe(ID);
    expect(umamiWebsiteId({ UMAMI_WEBSITE_ID: "" })).toBeNull();
    expect(umamiWebsiteId({})).toBeNull();
    expect(umamiWebsiteId({ UMAMI_WEBSITE_ID: "pas-un-uuid" })).toBeNull();
  });
});

describe("Umami : liens privés masqués avant l'envoi", () => {
  it("rapport, carte, défi, paiement : identifiant remplacé dans l'adresse, l'origine et le titre", () => {
    expect(send("/r/AbC_123-x", "/r/AbC_123-x")).toMatchObject({ url: "/r/[id]", title: "Page privée" });
    expect(send("/c/k9", "https://bitometre.com/c/k9/og")).toMatchObject({ url: "https://bitometre.com/c/[id]/og" });
    expect(send("/defi/zz", "/defi/zz")).toMatchObject({ url: "/defi/[id]", title: "Page privée" });
    expect(send("/paiement/abc", "/paiement/abc")).toMatchObject({ url: "/paiement/[id]", title: "Page privée" });
    expect(send("/", "/", "/r/secret")).toMatchObject({ url: "/", referrer: "/r/[id]", title: "Titre" });
    expect(send("/", "/", "https://bitometre.com/paiement/secret")).toMatchObject({ referrer: "https://bitometre.com/paiement/[id]" });
  });

  it("pages publiques inchangées (dont /paiement/retour)", () => {
    expect(send("/paiement/retour", "/paiement/retour")).toMatchObject({ url: "/paiement/retour", title: "Titre" });
    expect(send("/taille-penis-14-cm", "/taille-penis-14-cm", "https://www.google.com/")).toMatchObject({
      url: "/taille-penis-14-cm",
      referrer: "https://www.google.com/",
    });
  });

  it("aucun envoi avec Global Privacy Control ni sur l'administration", () => {
    expect(send("/", "/", "", true)).toBeNull();
    expect(send("/admin", "/admin")).toBeNull();
    expect(send("/admin/stats", "/admin/stats")).toBeNull();
  });

  it("la fonction sérialisée dans la page fonctionne seule (sans dépendance extérieure)", () => {
    const fn = new Function(`return (${umamiBeforeSend.toString()})`)() as typeof umamiBeforeSend;
    expect(fn("event", { url: "/r/x" }, { path: "/r/x", gpc: false })).toMatchObject({ url: "/r/[id]" });
  });
});

describe("Umami : textes et réglages", () => {
  it("script : ne pas suivre, sans paramètres ni ancre, filtre avant envoi", () => {
    const c = readFileSync("src/components/Umami.tsx", "utf8");
    for (const a of ['data-do-not-track="true"', 'data-exclude-search="true"', 'data-exclude-hash="true"', "data-before-send"]) expect(c).toContain(a);
  });

  it("la politique de confidentialité décrit Umami quand il est actif", () => {
    const p = readFileSync("src/app/confidentialite/page.tsx", "utf8");
    expect(p).toContain("Nous utilisons aussi Umami");
    expect(p).toContain("liens privés de rapport, de carte, de défi et de paiement sont masqués");
    expect(p).toContain("aucun autre outil tiers de mesure");
  });

  it("la CSP n'autorise Umami que s'il est configuré", () => {
    const n = readFileSync("next.config.ts", "utf8");
    expect(n).toMatch(/umamiWebsiteId\(\) \? `/);
  });

  it("variable documentée", () => {
    expect(readFileSync(".env.example", "utf8")).toMatch(/^UMAMI_WEBSITE_ID=$/m);
  });
});
