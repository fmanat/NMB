import { describe, expect, it } from "vitest";
import { COMPANY, HOST, hasCompanyPlaceholders, missingCompanyFields } from "@/config/company";
import { isBetaOnly, isFreeBeta, isHiddenInBeta } from "@/lib/mode";
import { decideAccess, parseBasicAuth, safeEqual } from "@/lib/siteGate";

const basic = (u: string, p: string) => "Basic " + Buffer.from(`${u}:${p}`, "utf8").toString("base64");
const prod = { NODE_ENV: "production" };

describe("analyse de l'en-tête Basic", () => {
  it("lit utilisateur et mot de passe (mot de passe contenant « : » et UTF-8)", () => {
    expect(parseBasicAuth(basic("bitometre", "a:b é"))).toEqual({ user: "bitometre", password: "a:b é" });
  });
  it("refuse tout ce qui n'est pas Basic ou mal formé", () => {
    for (const h of [null, undefined, "", "Bearer abc", "Basic ", "Basic !!!", "Basic " + Buffer.from("sansdeuxpoints").toString("base64")]) expect(parseBasicAuth(h)).toBeNull();
  });
  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("protection par mot de passe", () => {
  const env = { ...prod, SITE_PASSWORD: "s3cret-de-test" };
  it("sans identifiants ou avec de mauvais identifiants : 401", () => {
    expect(decideAccess("/", null, env, false).action).toBe("unauthorized");
    expect(decideAccess("/", basic("bitometre", "faux"), env, false).action).toBe("unauthorized");
    expect(decideAccess("/", basic("autre", "s3cret-de-test"), env, false).action).toBe("unauthorized");
    expect(decideAccess("/admin", "Bearer s3cret-de-test", env, false).action).toBe("unauthorized");
  });
  it("avec les bons identifiants : accès, site marqué protégé", () => {
    expect(decideAccess("/", basic("bitometre", "s3cret-de-test"), env, false)).toEqual({ action: "next", protectedSite: true });
  });
  it("nom d'utilisateur configurable", () => {
    const e = { ...env, SITE_USER: "testeur" };
    expect(decideAccess("/", basic("testeur", "s3cret-de-test"), e, false).action).toBe("next");
    expect(decideAccess("/", basic("bitometre", "s3cret-de-test"), e, false).action).toBe("unauthorized");
  });
  it("tout est protégé, y compris l'API et les pages privées ; seul /api/health est libre", () => {
    for (const p of ["/api/analyse", "/api/payments/webhook", "/r/abc", "/admin", "/_next/static/x.js", "/robots.txt"]) expect(decideAccess(p, null, env, false).action).toBe("unauthorized");
    expect(decideAccess("/api/health", null, env, false).action).toBe("next");
  });
});

describe("notifications du prestataire de paiement sur un site protégé", () => {
  const env = { ...prod, SITE_PASSWORD: "s3cret-de-test" };
  it("avec Verotel configuré : seul /api/payments/webhook est joignable sans identifiants (la signature protège)", () => {
    const v = { ...env, PAYMENT_PROVIDER: "verotel" };
    expect(decideAccess("/api/payments/webhook", null, v, false)).toEqual({ action: "next", protectedSite: false });
    for (const p of ["/api/payments/webhook/x", "/api/payments", "/paiement/retour", "/api/analyse", "/"]) expect(decideAccess(p, null, v, false).action, p).toBe("unauthorized");
  });
  it("avec un autre prestataire (ou aucun) : tout reste protégé", () => {
    for (const provider of [undefined, "simulation", "stripe"]) expect(decideAccess("/api/payments/webhook", null, { ...env, PAYMENT_PROVIDER: provider }, false).action).toBe("unauthorized");
  });
  it("en bêta gratuite, ce chemin reste introuvable même avec Verotel configuré", () => {
    expect(decideAccess("/api/payments/webhook", null, { ...env, PAYMENT_PROVIDER: "verotel", FREE_BETA: "on" }, false).action).toBe("not_found");
  });
});

describe("garde-fou : identité de la Ltd non complétée", () => {
  it("les marqueurs sont présents tant que rien n'est renseigné (état actuel du dépôt)", () => {
    expect(hasCompanyPlaceholders()).toBe(true);
    expect(missingCompanyFields()).toEqual(expect.arrayContaining(["legalName", "companiesHouseNumber", "registeredOffice", "publicationDirector", "icoNumber", "contactEmail", "hostAddress"]));
    expect(COMPANY.legalName).toContain("[À COMPLÉTER");
    expect(HOST.legalName).toBe("Railway Corporation (États-Unis)");
  });
  it("une valeur renseignée n'est plus signalée", () => {
    expect(missingCompanyFields({ a: "Exemple Ltd", b: "[À COMPLÉTER : x]" })).toEqual(["b"]);
  });
  it("production, sans mot de passe, marqueurs présents : 503 partout sauf /api/health", () => {
    expect(decideAccess("/", null, prod, true).action).toBe("closed");
    expect(decideAccess("/mentions-legales", null, prod, true).action).toBe("closed");
    expect(decideAccess("/api/health", null, prod, true).action).toBe("next");
  });
  it("avec mot de passe : le site de test reste utilisable ; sans marqueurs : le site s'ouvre ; hors production : libre", () => {
    expect(decideAccess("/", basic("bitometre", "x"), { ...prod, SITE_PASSWORD: "x" }, true).action).toBe("next");
    expect(decideAccess("/", null, prod, false)).toEqual({ action: "next", protectedSite: false });
    expect(decideAccess("/", null, { NODE_ENV: "development" }, true).action).toBe("next");
  });
});

describe("bêta gratuite : chemins", () => {
  it("la variable FREE_BETA=on active le mode, rien d'autre", () => {
    expect(isFreeBeta({ FREE_BETA: "on" })).toBe(true);
    for (const v of [undefined, "", "off", "true", "1", "ON"]) expect(isFreeBeta({ FREE_BETA: v })).toBe(false);
  });
  it("formules photo, âge, captcha, paiement et CGV : 404 en bêta ; la page /conditions n'existe qu'en bêta", () => {
    const beta = { FREE_BETA: "on" };
    for (const p of ["/analyse/photo", "/verification-age", "/verification-age/simulation", "/api/analyse", "/api/age/callback", "/api/captcha/challenge", "/paiement/abc", "/paiement/abc/simulation", "/api/payments/webhook", "/cgv"]) {
      expect(isHiddenInBeta(p), p).toBe(true);
      expect(decideAccess(p, null, beta, false).action, p).toBe("not_found");
    }
    for (const p of ["/", "/analyse", "/analyse/questionnaire", "/r/abc", "/r/abc/defi", "/r/abc/partager", "/defi/abc", "/c/abc", "/c/abc/og", "/methode", "/mentions-legales", "/confidentialite", "/contact", "/conditions", "/admin", "/api/stats", "/analysephoto"]) {
      expect(isHiddenInBeta(p), p).toBe(false);
      expect(decideAccess(p, null, beta, false).action, p).toBe("next");
    }
    expect(decideAccess("/conditions", null, {}, false).action).toBe("not_found");
    expect(isBetaOnly("/conditions")).toBe(true);
  });
  it("hors bêta : tout existe comme avant", () => {
    for (const p of ["/analyse/photo", "/paiement/abc", "/cgv", "/api/payments/webhook"]) expect(decideAccess(p, null, {}, false).action).toBe("next");
  });
});
