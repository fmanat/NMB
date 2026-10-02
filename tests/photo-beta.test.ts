import { afterEach, describe, expect, it, vi } from "vitest";
import { isHiddenInBeta, isPhotoBeta } from "@/lib/mode";
import {
  AGE_PROVIDER_REQUIRED_VARS,
  NOT_READY_AGE_PROVIDERS,
  REAL_AGE_PROVIDERS,
  SCREENING_ABSENT_WARNING,
  isPhotoBetaActive,
  isPhotoBetaRequested,
  photoBetaDecision,
  startupWarnings,
} from "@/lib/photoBeta";
import { absentScreening } from "@/lib/providers/absent";
import { getAgeProvider, getScreening } from "@/lib/providers";
import { decideAccess } from "@/lib/siteGate";

// Configuration de production complète et valide pour la bêta photo (valeurs fictives, aucun secret réel).
const PROD_OK = {
  NODE_ENV: "production",
  FREE_BETA: "on",
  PHOTO_BETA: "on",
  AGE_PROVIDER: "ageverif",
  AGEVERIF_CLIENT_ID: "id-fictif",
  AGEVERIF_CLIENT_SECRET: "secret-fictif",
  AGE_TOKEN_SECRET: "secret-fictif",
  SITE_URL: "https://exemple.test",
  VISION_PROVIDER: "xai",
  XAI_API_KEY: "cle-fictive",
  CAPTCHA_PROVIDER: "altcha",
  ALTCHA_HMAC_KEY: "cle-fictive-de-32-caracteres-au-moins",
  SCREENING_PROVIDER: "",
};
const DEV = { NODE_ENV: "development", FREE_BETA: "on", PHOTO_BETA: "on", AGE_PROVIDER: "simulation", VISION_PROVIDER: "simulation", CAPTCHA_PROVIDER: "simulation", SCREENING_PROVIDER: "simulation" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PHOTO_BETA : désactivée par défaut, seule la valeur « on » est reconnue", () => {
  it("absente, vide ou autre valeur : rien ne change", () => {
    for (const v of [undefined, "", "off", "true", "1", "ON", "yes"]) {
      const env = { ...DEV, PHOTO_BETA: v };
      expect(isPhotoBetaRequested(env), String(v)).toBe(false);
      expect(photoBetaDecision(env)).toEqual({ requested: false, active: false, reasons: [] });
      expect(isPhotoBeta(env)).toBe(false);
    }
    expect(isPhotoBetaRequested({ PHOTO_BETA: "on" })).toBe(true);
  });

  it("sans FREE_BETA=on, la bêta photo n'a pas d'effet (la version payante a déjà ses formules photo)", () => {
    const d = photoBetaDecision({ ...DEV, FREE_BETA: "" });
    expect(d.active).toBe(false);
    expect(d.reasons.join(" ")).toContain("FREE_BETA");
    expect(isPhotoBeta({ ...DEV, FREE_BETA: "" })).toBe(false);
  });

  it("hors production, les fournisseurs simulés suffisent", () => {
    for (const nodeEnv of ["development", "test", undefined]) {
      expect(photoBetaDecision({ ...DEV, NODE_ENV: nodeEnv }), String(nodeEnv)).toEqual({ requested: true, active: true, reasons: [] });
    }
    expect(isPhotoBeta(DEV)).toBe(true);
  });
});

describe("garde-fou de production : table de vérité prod / non-prod × fournisseur × variables", () => {
  const required = (provider: string) => AGE_PROVIDER_REQUIRED_VARS[provider];

  it("prestataires réels reconnus et leurs variables obligatoires (documentées)", () => {
    // Bloc 8 : yoti n'a pas d'adaptateur validé en réel, il ne compte PAS comme prestataire prêt.
    expect(REAL_AGE_PROVIDERS).toEqual(["ageverif"]);
    expect(required("ageverif")).toEqual(["AGEVERIF_CLIENT_ID", "AGEVERIF_CLIENT_SECRET", "AGE_TOKEN_SECRET", "SITE_URL"]);
    expect(required("yoti")).toBeUndefined();
    expect(Object.keys(NOT_READY_AGE_PROVIDERS)).toEqual(["yoti"]);
    // Aucun prestataire n'est à la fois « prêt » et « non prêt ».
    for (const p of Object.keys(NOT_READY_AGE_PROVIDERS)) expect(REAL_AGE_PROVIDERS).not.toContain(p);
  });

  const cases: { label: string; env: Record<string, string | undefined>; active: boolean; reason?: RegExp }[] = [
    { label: "prod · ageverif complet", env: PROD_OK, active: true },
    {
      label: "prod · yoti, toutes les variables posées (ancienne et nouvelle liste) : NON prêt, refusé",
      env: { ...PROD_OK, AGE_PROVIDER: "yoti", AGEVERIF_CLIENT_ID: "", AGEVERIF_CLIENT_SECRET: "", YOTI_CLIENT_SDK_ID: "sdk-fictif", YOTI_API_KEY: "cle-fictive", YOTI_KEY_PEM: "pem-fictif" },
      active: false,
      reason: /yoti.*adaptateur Yoti non écrit.*ne compte pas comme prestataire réel prêt/,
    },
    { label: "prod · yoti sans aucune variable : refusé", env: { ...PROD_OK, AGE_PROVIDER: "yoti" }, active: false, reason: /adaptateur Yoti non écrit/ },
    { label: "prod · nom hérité de l'objet (constructor) : inconnu, refusé sans erreur", env: { ...PROD_OK, AGE_PROVIDER: "constructor" }, active: false, reason: /prestataire réel de vérification d'âge prêt/ },
    { label: "prod · yoti, majuscules : inconnu, refusé", env: { ...PROD_OK, AGE_PROVIDER: "YOTI" }, active: false, reason: /prestataire réel de vérification d'âge prêt/ },
    { label: "prod · simulation", env: { ...PROD_OK, AGE_PROVIDER: "simulation" }, active: false, reason: /prestataire réel/ },
    { label: "prod · AGE_PROVIDER vide", env: { ...PROD_OK, AGE_PROVIDER: "" }, active: false, reason: /\(vide\)/ },
    { label: "prod · AGE_PROVIDER absente", env: { ...PROD_OK, AGE_PROVIDER: undefined }, active: false, reason: /prestataire réel/ },
    { label: "prod · inconnu", env: { ...PROD_OK, AGE_PROVIDER: "autre" }, active: false, reason: /prestataire réel/ },
    { label: "prod · ageverif sans secret", env: { ...PROD_OK, AGEVERIF_CLIENT_SECRET: "" }, active: false, reason: /AGEVERIF_CLIENT_SECRET/ },
    { label: "prod · ageverif sans identifiant (espaces)", env: { ...PROD_OK, AGEVERIF_CLIENT_ID: "   " }, active: false, reason: /AGEVERIF_CLIENT_ID/ },
    { label: "prod · ageverif sans SITE_URL", env: { ...PROD_OK, SITE_URL: undefined }, active: false, reason: /SITE_URL/ },
    { label: "prod · ageverif sans AGE_TOKEN_SECRET", env: { ...PROD_OK, AGE_TOKEN_SECRET: "" }, active: false, reason: /AGE_TOKEN_SECRET/ },
    { label: "prod · vision simulée", env: { ...PROD_OK, VISION_PROVIDER: "simulation" }, active: false, reason: /VISION_PROVIDER/ },
    { label: "prod · xai sans clé", env: { ...PROD_OK, XAI_API_KEY: "" }, active: false, reason: /XAI_API_KEY/ },
    { label: "prod · captcha simulé", env: { ...PROD_OK, CAPTCHA_PROVIDER: "simulation" }, active: false, reason: /CAPTCHA_PROVIDER/ },
    { label: "prod · altcha sans clé", env: { ...PROD_OK, ALTCHA_HMAC_KEY: undefined }, active: false, reason: /ALTCHA_HMAC_KEY/ },
    { label: "prod · filtrage simulé", env: { ...PROD_OK, SCREENING_PROVIDER: "simulation" }, active: false, reason: /SCREENING_PROVIDER/ },
    { label: "prod · filtrage off", env: { ...PROD_OK, SCREENING_PROVIDER: "off" }, active: false, reason: /SCREENING_PROVIDER/ },
    { label: "prod · filtrage absent (variable manquante)", env: { ...PROD_OK, SCREENING_PROVIDER: undefined }, active: true },
    { label: "non-prod · simulation partout", env: DEV, active: true },
    { label: "non-prod · yoti : le garde-fou de production ne s'applique pas", env: { ...DEV, AGE_PROVIDER: "yoti" }, active: true },
    { label: "non-prod · ageverif sans variables", env: { ...DEV, AGE_PROVIDER: "ageverif" }, active: true },
  ];
  for (const c of cases) {
    it(c.label, () => {
      const d = photoBetaDecision(c.env);
      expect(d.requested).toBe(true);
      expect(d.active).toBe(c.active);
      expect(isPhotoBetaActive(c.env)).toBe(c.active);
      if (c.active) expect(d.reasons).toEqual([]);
      else {
        expect(d.reasons.length).toBeGreaterThan(0);
        if (c.reason) expect(d.reasons.join(" ")).toMatch(c.reason);
      }
    });
  }

  it("plusieurs manques sont tous listés (un seul message au démarrage les cite)", () => {
    const d = photoBetaDecision({ ...PROD_OK, AGE_PROVIDER: "simulation", VISION_PROVIDER: "simulation", CAPTCHA_PROVIDER: "off" });
    expect(d.reasons).toHaveLength(3);
  });
});

describe("avertissements au démarrage", () => {
  it("PHOTO_BETA=on refusée : un avertissement qui cite les raisons", () => {
    const w = startupWarnings({ ...PROD_OK, AGE_PROVIDER: "simulation" });
    expect(w).toHaveLength(1); // le refus seul : en bêta gratuite sans bêta photo active, aucun flux photo n'existe, donc rien sur le filtrage
    expect(w[0]).toMatch(/PHOTO_BETA=on ignorée/);
    expect(w[0]).toMatch(/prestataire réel/);
  });

  it("filtrage absent : avertissement seulement quand un flux photo existe (bêta photo active, ou version payante)", () => {
    expect(startupWarnings(PROD_OK)).toEqual([SCREENING_ABSENT_WARNING]);
    const sim = startupWarnings({ ...PROD_OK, SCREENING_PROVIDER: "simulation" }); // interdit en prod → bêta refusée (un seul avertissement) ; pas de flux photo
    expect(sim).toHaveLength(1);
    expect(sim[0]).toMatch(/PHOTO_BETA=on ignorée.*SCREENING_PROVIDER/);
    expect(startupWarnings({ NODE_ENV: "production", FREE_BETA: "", SCREENING_PROVIDER: "" })).toEqual([SCREENING_ABSENT_WARNING]); // version payante
    expect(startupWarnings({ NODE_ENV: "production", FREE_BETA: "on", SCREENING_PROVIDER: "" })).toEqual([]); // bêta gratuite seule : aucune photo
    expect(startupWarnings({ ...PROD_OK, SCREENING_PROVIDER: "photodna" })).toEqual([]);
  });

  it("rien à signaler quand PHOTO_BETA est absente et le filtrage configuré", () => {
    expect(startupWarnings({ NODE_ENV: "production", SCREENING_PROVIDER: "photodna" })).toEqual([]);
  });
});

describe("filtrage d'empreintes optionnel", () => {
  it("variable vide ou absente : fournisseur « none », qui n'a bloqué personne mais avertit à chaque analyse, même en production", async () => {
    for (const v of [undefined, "", "  "]) {
      vi.stubEnv("SCREENING_PROVIDER", v as string);
      expect(getScreening().id, String(v)).toBe("none");
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    expect(await absentScreening.screen(Buffer.from("octets"))).toEqual({ blocked: false });
    expect(warn).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(warn.mock.calls[0][0])) as { event: string; message: string };
    expect(line.event).toBe("screening_absent");
    expect(line.message).toBe(SCREENING_ABSENT_WARNING);
    expect(line.message).not.toMatch(/bloqu|détect/i); // n'affirme jamais un pouvoir qu'il n'a pas
  });

  it("« simulation » et « off » restent réservés au développement (ils refusent en production, comme avant)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SCREENING_PROVIDER", "simulation");
    await expect(getScreening().screen(Buffer.from("x"))).rejects.toThrow(/interdit en production/);
    vi.stubEnv("SCREENING_PROVIDER", "off");
    await expect(getScreening().screen(Buffer.from("x"))).rejects.toThrow(/interdit en production/);
    vi.stubEnv("SCREENING_PROVIDER", "inconnu");
    expect(() => getScreening()).toThrow(/inconnu/);
  });

  it("AGE_PROVIDER=yoti est reconnu par le garde-fou mais son adaptateur n'existe pas encore : erreur explicite, jamais une simulation", () => {
    vi.stubEnv("AGE_PROVIDER", "yoti");
    expect(() => getAgeProvider()).toThrow(/yoti.*pas encore/i);
  });
});

describe("chemins : bêta photo active ou non", () => {
  const PHOTO = ["/analyse/photo", "/analyse/photo/x", "/verification-age", "/verification-age/simulation", "/api/analyse", "/api/age/callback", "/api/captcha/challenge"];
  const PAY = ["/paiement/abc", "/api/payments/webhook", "/cgv"];

  it("bêta gratuite sans bêta photo : exactement le comportement d'aujourd'hui (tout masqué)", () => {
    const env = { FREE_BETA: "on" };
    for (const p of [...PHOTO, ...PAY]) {
      expect(isHiddenInBeta(p, env), p).toBe(true);
      expect(decideAccess(p, null, env).action, p).toBe("not_found");
    }
  });

  it("bêta photo active (hors production) : les chemins de la formule B existent, paiement et CGV restent introuvables", () => {
    for (const p of PHOTO) {
      expect(isHiddenInBeta(p, DEV), p).toBe(false);
      expect(decideAccess(p, null, DEV).action, p).toBe("next");
    }
    for (const p of PAY) {
      expect(isHiddenInBeta(p, DEV), p).toBe(true);
      expect(decideAccess(p, null, DEV).action, p).toBe("not_found");
    }
    expect(decideAccess("/conditions", null, DEV).action).toBe("next");
    expect(decideAccess("/analyse/questionnaire", null, DEV).action).toBe("next");
  });

  it("production : PHOTO_BETA=on sans prestataire d'âge réel : les chemins photo restent en 404 (garde-fou)", () => {
    const env = { ...PROD_OK, AGE_PROVIDER: "simulation" };
    for (const p of PHOTO) expect(decideAccess(p, null, env).action, p).toBe("not_found");
    for (const p of PHOTO) expect(decideAccess(p, null, PROD_OK).action, p).toBe("next");
  });

  it("hors bêta gratuite : PHOTO_BETA n'a aucun effet sur les chemins", () => {
    for (const p of [...PHOTO, ...PAY]) {
      expect(decideAccess(p, null, { PHOTO_BETA: "on" }).action, p).toBe("next");
      expect(decideAccess(p, null, {}).action, p).toBe("next");
    }
  });
});
