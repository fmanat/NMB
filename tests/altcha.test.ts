import { createHash, createHmac } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createChallenge, verifySolution, ALTCHA_VALID_SECONDS } from "@/lib/captcha/altcha";
import { solveChallenge } from "@/lib/captcha/altchaClient";
import { pool } from "@/lib/db";
import { getCaptcha } from "@/lib/providers";

const KEY = "cle-de-test-altcha-de-32-caracteres-au-moins";

beforeEach(async () => {
  process.env.ALTCHA_HMAC_KEY = KEY;
  process.env.ALTCHA_MAX_NUMBER = "2000"; // rapide en test
  process.env.CAPTCHA_PROVIDER = "altcha";
  await pool().query("TRUNCATE captcha_used");
});
afterAll(async () => {
  process.env.CAPTCHA_PROVIDER = "simulation";
  await pool().query("TRUNCATE captcha_used");
  await pool().end();
});

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64");
const decode = (t: string) => JSON.parse(Buffer.from(t, "base64").toString("utf8"));

describe("ALTCHA : défi", () => {
  it("défi conforme au protocole : SHA-256, sel avec expiration, défi = SHA-256(sel + n), signature = HMAC du défi", async () => {
    const c = createChallenge();
    expect(c.algorithm).toBe("SHA-256");
    expect(c.maxnumber).toBe(2000);
    expect(c.salt).toMatch(/^[0-9a-f]{24}\?expires=\d+$/);
    expect(c.signature).toBe(createHmac("sha256", KEY).update(c.challenge).digest("hex"));
    // Le nombre secret existe bien dans l'intervalle annoncé.
    let found = -1;
    for (let n = 0; n <= c.maxnumber; n++) if (createHash("sha256").update(c.salt + n).digest("hex") === c.challenge) found = n;
    expect(found).toBeGreaterThanOrEqual(0);
    // Validité : environ 5 minutes.
    const exp = Number(c.salt.split("expires=")[1]);
    expect(exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(ALTCHA_VALID_SECONDS);
    expect(exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(ALTCHA_VALID_SECONDS - 5);
  });

  it("deux défis successifs sont différents", () => {
    expect(createChallenge().challenge).not.toBe(createChallenge().challenge);
    expect(createChallenge().salt).not.toBe(createChallenge().salt);
  });

  it("désactivé sans clé, ou avec une clé trop courte", () => {
    delete process.env.ALTCHA_HMAC_KEY;
    expect(() => createChallenge()).toThrow(/ALTCHA_HMAC_KEY/);
    process.env.ALTCHA_HMAC_KEY = "court";
    expect(() => createChallenge()).toThrow(/ALTCHA_HMAC_KEY/);
  });
});

describe("ALTCHA : solution", () => {
  it("le navigateur résout, le serveur accepte ; la même solution rejouée est refusée", async () => {
    const solution = await solveChallenge(createChallenge());
    expect(await verifySolution(solution)).toBe(true);
    expect(await verifySolution(solution)).toBe(false); // rejeu
  });

  it("refuse un mauvais nombre, une signature falsifiée, un défi signé avec une autre clé, une solution expirée", async () => {
    const c = createChallenge();
    const good = decode(await solveChallenge(c));
    expect(await verifySolution(b64({ ...good, number: (good.number + 1) % 2000 }))).toBe(false);
    expect(await verifySolution(b64({ ...good, signature: "0".repeat(64) }))).toBe(false);
    expect(await verifySolution(b64({ ...good, salt: good.salt.replace(/^./, "x") }))).toBe(false);

    process.env.ALTCHA_HMAC_KEY = "une-autre-cle-de-test-de-32-caracteres-ou-plus";
    expect(await verifySolution(b64(good))).toBe(false); // émis avec l'ancienne clé
    process.env.ALTCHA_HMAC_KEY = KEY;

    const late = await solveChallenge(createChallenge(Date.now() - 10 * 60_000)); // défi émis il y a 10 minutes
    expect(await verifySolution(late)).toBe(false);
    // Et la bonne solution, non consommée par les essais ci-dessus, passe encore.
    expect(await verifySolution(b64(good))).toBe(true);
  });

  it("refuse tout ce qui est mal formé, sans exception", async () => {
    const good = decode(await solveChallenge(createChallenge()));
    for (const bad of [null, "", "pas du base64 !", b64({}), b64({ ...good, algorithm: "SHA-1" }), b64({ ...good, number: -1 }), b64({ ...good, number: 99_999_999 }), b64({ ...good, number: "3" }), b64({ ...good, salt: "sans-expiration" }), b64({ ...good, salt: `${good.salt.split("?")[0]}?expires=abc` }), "A".repeat(5000)]) {
      expect(await verifySolution(bad as string | null), String(bad).slice(0, 40)).toBe(false);
    }
  });

  it("une solution calculée sans passer par le serveur (défi inventé par le client) est refusée", async () => {
    const salt = `abcdef?expires=${Math.floor(Date.now() / 1000) + 300}`;
    const challenge = createHash("sha256").update(salt + "5").digest("hex");
    expect(await verifySolution(b64({ algorithm: "SHA-256", challenge, number: 5, salt, signature: "00" }))).toBe(false);
  });
});

describe("ALTCHA : adaptateur et route", () => {
  it("CAPTCHA_PROVIDER=altcha : vérifie une vraie solution, refuse l'absence de jeton et le jeton du simulateur", async () => {
    const captcha = getCaptcha();
    expect(captcha.id).toBe("altcha");
    expect(await captcha.verify(null, "1.2.3.4")).toBe(false);
    expect(await captcha.verify("simulation-ok", "1.2.3.4")).toBe(false);
    expect(await captcha.verify(await solveChallenge(createChallenge()), "1.2.3.4")).toBe(true);
  });

  it("la route de défi répond seulement en mode altcha, sans mise en cache", async () => {
    const { GET } = await import("@/app/api/captcha/challenge/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ algorithm: "SHA-256", maxnumber: 2000 });
    expect(body.signature).toHaveLength(64);

    process.env.CAPTCHA_PROVIDER = "simulation";
    expect((await GET()).status).toBe(404);
    process.env.CAPTCHA_PROVIDER = "altcha";
    delete process.env.ALTCHA_HMAC_KEY;
    expect((await GET()).status).toBe(503);
  });

  it("ne garde aucune adresse IP : la table ne contient que signature et expiration", async () => {
    const cols = (await pool().query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'captcha_used' ORDER BY 1")).rows.map((r) => r.column_name);
    expect(cols).toEqual(["expires_at", "signature"]);
  });
});
