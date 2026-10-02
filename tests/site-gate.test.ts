import { describe, expect, it } from "vitest";
import { COMPANY, HOST } from "@/config/company";
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
    expect(decideAccess("/", null, env).action).toBe("unauthorized");
    expect(decideAccess("/", basic("bitometre", "faux"), env).action).toBe("unauthorized");
    expect(decideAccess("/", basic("autre", "s3cret-de-test"), env).action).toBe("unauthorized");
    expect(decideAccess("/admin", "Bearer s3cret-de-test", env).action).toBe("unauthorized");
  });
  it("avec les bons identifiants : accès, site marqué protégé", () => {
    expect(decideAccess("/", basic("bitometre", "s3cret-de-test"), env)).toEqual({ action: "next", protectedSite: true });
  });
  it("nom d'utilisateur configurable", () => {
    const e = { ...env, SITE_USER: "testeur" };
    expect(decideAccess("/", basic("testeur", "s3cret-de-test"), e).action).toBe("next");
    expect(decideAccess("/", basic("bitometre", "s3cret-de-test"), e).action).toBe("unauthorized");
  });
  it("tout est protégé, y compris l'API et les pages privées ; seul /api/health est libre", () => {
    for (const p of ["/api/analyse", "/api/payments/webhook", "/r/abc", "/admin", "/_next/static/x.js", "/robots.txt"]) expect(decideAccess(p, null, env).action).toBe("unauthorized");
    expect(decideAccess("/api/health", null, env).action).toBe("next");
  });
});

describe("notifications du prestataire de paiement sur un site protégé", () => {
  const env = { ...prod, SITE_PASSWORD: "s3cret-de-test" };
  it("avec Verotel configuré : seul /api/payments/webhook est joignable sans identifiants (la signature protège)", () => {
    const v = { ...env, PAYMENT_PROVIDER: "verotel" };
    expect(decideAccess("/api/payments/webhook", null, v)).toEqual({ action: "next", protectedSite: false });
    for (const p of ["/api/payments/webhook/x", "/api/payments", "/paiement/retour", "/api/analyse", "/"]) expect(decideAccess(p, null, v).action, p).toBe("unauthorized");
  });
  it("avec un autre prestataire (ou aucun) : tout reste protégé", () => {
    for (const provider of [undefined, "simulation", "stripe"]) expect(decideAccess("/api/payments/webhook", null, { ...env, PAYMENT_PROVIDER: provider }).action).toBe("unauthorized");
  });
  it("en bêta gratuite, ce chemin reste introuvable même avec Verotel configuré", () => {
    expect(decideAccess("/api/payments/webhook", null, { ...env, PAYMENT_PROVIDER: "verotel", FREE_BETA: "on" }).action).toBe("not_found");
  });
});

describe("site ouvert : plus de blocage sur l'identité de l'éditeur", () => {
  it("production, sans mot de passe : le site s'ouvre (plus de 503)", () => {
    expect(decideAccess("/", null, prod)).toEqual({ action: "next", protectedSite: false });
    expect(decideAccess("/mentions-legales", null, prod).action).toBe("next");
  });
  it("seule information publique sur l'éditeur : l'adresse de contact ; l'hébergeur reste indiqué", () => {
    expect(Object.keys(COMPANY)).toEqual(["contactEmail"]);
    expect(COMPANY.contactEmail).toBe("contact@bitometre.com");
    expect(HOST.address).toContain("548 Market St");
    expect(HOST.legalName).toBe("Railway Corporation (États-Unis)");
  });
  it("avec mot de passe : le site de test reste protégé", () => {
    expect(decideAccess("/", null, { ...prod, SITE_PASSWORD: "x" }).action).toBe("unauthorized");
    expect(decideAccess("/", basic("bitometre", "x"), { ...prod, SITE_PASSWORD: "x" }).action).toBe("next");
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
      expect(decideAccess(p, null, beta).action, p).toBe("not_found");
    }
    for (const p of ["/", "/analyse", "/analyse/questionnaire", "/r/abc", "/r/abc/defi", "/r/abc/partager", "/defi/abc", "/c/abc", "/c/abc/og", "/methode", "/mentions-legales", "/confidentialite", "/contact", "/conditions", "/admin", "/api/stats", "/analysephoto"]) {
      expect(isHiddenInBeta(p), p).toBe(false);
      expect(decideAccess(p, null, beta).action, p).toBe("next");
    }
    expect(decideAccess("/conditions", null, {}).action).toBe("not_found");
    expect(isBetaOnly("/conditions")).toBe(true);
  });
  it("hors bêta : tout existe comme avant", () => {
    for (const p of ["/analyse/photo", "/paiement/abc", "/cgv", "/api/payments/webhook"]) expect(decideAccess(p, null, {}).action).toBe("next");
  });
});
