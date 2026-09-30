import { afterEach, describe, expect, it } from "vitest";
import { ADMIN } from "@/config/site";
import { LoginLimiter, adminConfigured, hashPassword, isAdminTokenValid, issueAdminToken, verifyPassword } from "@/lib/admin/auth";

describe("mot de passe administrateur", () => {
  it("refuse un mot de passe de moins de 12 caractères", () => {
    expect(() => hashPassword("court")).toThrow(/12 caractères/);
  });

  it("vérifie le bon mot de passe et refuse les autres", () => {
    const stored = hashPassword("un mot de passe solide");
    expect(verifyPassword("un mot de passe solide", stored)).toBe(true);
    expect(verifyPassword("un mot de passe solidE", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("deux empreintes du même mot de passe diffèrent (sel aléatoire)", () => {
    expect(hashPassword("un mot de passe solide")).not.toBe(hashPassword("un mot de passe solide"));
  });

  it("format « scrypt:sel:empreinte » sans caractère $ (interprété par le fichier .env)", () => {
    const stored = hashPassword("un mot de passe solide");
    expect(stored).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(stored).not.toContain("$");
  });

  it("une empreinte absente ou mal formée ne valide jamais rien", () => {
    expect(verifyPassword("un mot de passe solide", undefined)).toBe(false);
    expect(verifyPassword("un mot de passe solide", "")).toBe(false);
    expect(verifyPassword("un mot de passe solide", "texte-quelconque")).toBe(false);
    expect(verifyPassword("un mot de passe solide", "scrypt:zz:zz")).toBe(false);
    expect(verifyPassword("un mot de passe solide", "md5:00:00")).toBe(false);
  });
});

describe("session administrateur", () => {
  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = "secret-de-test-admin";
  });

  it("valable 8 heures, puis expirée", () => {
    process.env.ADMIN_SESSION_SECRET = "secret-de-test-admin";
    const t0 = 1_700_000_000_000;
    const token = issueAdminToken(t0);
    expect(isAdminTokenValid(token, t0 + (ADMIN.sessionHours * 60 - 1) * 60_000)).toBe(true);
    expect(isAdminTokenValid(token, t0 + (ADMIN.sessionHours * 60 + 1) * 60_000)).toBe(false);
  });

  it("refuse un jeton modifié, vide ou inventé", () => {
    process.env.ADMIN_SESSION_SECRET = "secret-de-test-admin";
    const t0 = 1_700_000_000_000;
    const [exp, nonce, sig] = issueAdminToken(t0).split(".");
    expect(isAdminTokenValid(`${Number(exp) + 3_600_000}.${nonce}.${sig}`, t0)).toBe(false);
    expect(isAdminTokenValid(`${exp}.${nonce}.${"0".repeat(64)}`, t0)).toBe(false);
    expect(isAdminTokenValid(`${exp}.${nonce}.pas-de-l-hexadecimal`, t0)).toBe(false);
    expect(isAdminTokenValid("n'importe quoi", t0)).toBe(false);
    expect(isAdminTokenValid("", t0)).toBe(false);
    expect(isAdminTokenValid(null, t0)).toBe(false);
    expect(isAdminTokenValid(undefined, t0)).toBe(false);
  });

  it("un jeton signé avec un autre secret est refusé", () => {
    process.env.ADMIN_SESSION_SECRET = "premier-secret";
    const token = issueAdminToken();
    process.env.ADMIN_SESSION_SECRET = "second-secret";
    expect(isAdminTokenValid(token)).toBe(false);
  });

  it("sans secret configuré, aucune session n'est valide", () => {
    process.env.ADMIN_SESSION_SECRET = "secret-de-test-admin";
    const token = issueAdminToken();
    delete process.env.ADMIN_SESSION_SECRET;
    expect(isAdminTokenValid(token)).toBe(false);
  });

  it("l'administration n'est disponible que si l'empreinte ET le secret sont renseignés", () => {
    const hash = process.env.ADMIN_PASSWORD_HASH;
    const secret = process.env.ADMIN_SESSION_SECRET;
    try {
      process.env.ADMIN_PASSWORD_HASH = "scrypt:aa:bb";
      process.env.ADMIN_SESSION_SECRET = "x";
      expect(adminConfigured()).toBe(true);
      delete process.env.ADMIN_SESSION_SECRET;
      expect(adminConfigured()).toBe(false);
      process.env.ADMIN_SESSION_SECRET = "x";
      delete process.env.ADMIN_PASSWORD_HASH;
      expect(adminConfigured()).toBe(false);
    } finally {
      if (hash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
      else process.env.ADMIN_PASSWORD_HASH = hash;
      if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
      else process.env.ADMIN_SESSION_SECRET = secret;
    }
  });
});

describe("limitation des tentatives de connexion", () => {
  const MIN = 60_000;

  it("bloque après 5 échecs dans la fenêtre, pas avant", () => {
    const l = new LoginLimiter(5, 15 * MIN);
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) l.registerFailure("ip", t + i);
    expect(l.isBlocked("ip", t + 10)).toBe(false);
    l.registerFailure("ip", t + 5);
    expect(l.isBlocked("ip", t + 10)).toBe(true);
  });

  it("le blocage expire avec la fenêtre", () => {
    const l = new LoginLimiter(5, 15 * MIN);
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) l.registerFailure("ip", t);
    expect(l.isBlocked("ip", t + 14 * MIN)).toBe(true);
    expect(l.isBlocked("ip", t + 16 * MIN)).toBe(false);
  });

  it("une connexion réussie remet le compteur à zéro", () => {
    const l = new LoginLimiter(5, 15 * MIN);
    for (let i = 0; i < 5; i++) l.registerFailure("ip", 1000);
    l.reset("ip");
    expect(l.isBlocked("ip", 1001)).toBe(false);
  });

  it("chaque adresse a son propre compteur", () => {
    const l = new LoginLimiter(2, 15 * MIN);
    l.registerFailure("a", 1000);
    l.registerFailure("a", 1000);
    expect(l.isBlocked("a", 1001)).toBe(true);
    expect(l.isBlocked("b", 1001)).toBe(false);
  });
});
