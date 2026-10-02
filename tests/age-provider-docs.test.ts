import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGE_PROVIDER_REQUIRED_VARS, AGE_PROVIDER_VARS, NOT_READY_AGE_PROVIDERS, REAL_AGE_PROVIDERS } from "@/lib/photoBeta";

// Les variables de vérification d'âge documentées (.env.example, README.md, docs/ACTIVATION-PHOTO.md) doivent être exactement celles du code.

const read = (p: string) => readFileSync(p, "utf8");
const ENV_EXAMPLE = read(".env.example");
const README = read("README.md");
const ACTIVATION = read("docs/ACTIVATION-PHOTO.md");

const allProviderVars = Object.values(AGE_PROVIDER_VARS).flatMap((v) => [...v.required, ...v.optional]);
const PREFIX = /\b((?:AGEVERIF|YOTI)_[A-Z0-9_]+)\b/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const SRC = sourceFiles("src").map((p) => ({ p, t: read(p) }));

describe("variables de vérification d'âge : documentation et code identiques", () => {
  it("chaque variable du code est documentée dans .env.example (ligne NOM=), README.md et docs/ACTIVATION-PHOTO.md", () => {
    expect(allProviderVars.length).toBeGreaterThanOrEqual(5);
    for (const name of allProviderVars) {
      expect(ENV_EXAMPLE, `.env.example ${name}`).toMatch(new RegExp(`^${name}=`, "m"));
      expect(README, `README ${name}`).toContain(`\`${name}\``);
      expect(ACTIVATION, `ACTIVATION ${name}`).toContain(name);
    }
  });

  it("aucune variable AGEVERIF_* ou YOTI_* des documents n'est inconnue du code (pas de nom périmé ni inventé)", () => {
    const known = new Set(allProviderVars);
    for (const [label, text] of [[".env.example", ENV_EXAMPLE], ["README", README], ["ACTIVATION", ACTIVATION]] as const) {
      const names = new Set([...text.matchAll(PREFIX)].map((m) => m[1]));
      for (const n of names) expect(known.has(n), `${label} cite ${n}, inconnue du code`).toBe(true);
    }
  });

  it("AgeVerif : les variables lues par l'adaptateur sont exactement celles du code (obligatoires et facultatives)", () => {
    const src = read("src/lib/providers/ageverif.ts");
    const read_ = new Set([...src.matchAll(/(?:need\(\s*"|process\.env\.)(AGEVERIF_[A-Z0-9_]+)/g)].map((m) => m[1]));
    const declared = new Set([...AGE_PROVIDER_VARS.ageverif.required, ...AGE_PROVIDER_VARS.ageverif.optional]);
    expect(read_).toEqual(declared);
    // Les variables obligatoires du garde-fou contiennent celles du prestataire, plus le secret du jeton et l'adresse du site.
    expect(AGE_PROVIDER_REQUIRED_VARS.ageverif).toEqual([...AGE_PROVIDER_VARS.ageverif.required.filter((n) => !n.endsWith("_CHALLENGES")), "AGE_TOKEN_SECRET", "SITE_URL"]);
    // Les variables que l'adaptateur exige (need) sont obligatoires, celle qu'il lit en option est facultative.
    const needed = new Set([...src.matchAll(/need\(\s*"(AGEVERIF_[A-Z0-9_]+)"/g)].map((m) => m[1]));
    expect(needed).toEqual(new Set(AGE_PROVIDER_VARS.ageverif.required));
  });

  it("Yoti : noms réservés, aucun code du site ne les lit ; pas d'adaptateur ; non prêt", () => {
    expect(AGE_PROVIDER_VARS.yoti.reserved).toBe(true);
    for (const f of SRC.filter((s) => !s.p.endsWith("photoBeta.ts"))) expect(f.t, f.p).not.toMatch(/YOTI_/);
    expect(REAL_AGE_PROVIDERS).not.toContain("yoti");
    expect(Object.keys(NOT_READY_AGE_PROVIDERS)).toContain("yoti");
    expect(AGE_PROVIDER_REQUIRED_VARS).not.toHaveProperty("yoti");
    expect(ACTIVATION).toMatch(/Adaptateur Yoti[^\n]*NON écrit|adaptateur n'est PAS écrit/i);
    expect(ACTIVATION).toContain("`yoti` ne compte pas comme prestataire prêt");
    expect(ENV_EXAMPLE).toMatch(/NOMS RÉSERVÉS, NON LUS PAR LE CODE/);
    expect(README).toMatch(/noms réservés, non lus par le code/);
    // Documentation de chaque variable : rôle, où la trouver, obligatoire ou non (commentaire de .env.example).
    for (const name of allProviderVars) expect(ENV_EXAMPLE, name).toMatch(new RegExp(`#\\s+${name}\\s+\\S`));
  });

  it("le tableau « variables à poser » du chapitre 2 ne cite que des variables connues de .env.example et lues dans le code", () => {
    const chapter = ACTIVATION.split("## 2. ")[1].split("## 3. ")[0];
    const rows = chapter.split("\n").filter((l) => /^\| \d+ \|/.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(11);
    const names = rows.flatMap((r) => [...(r.split("|")[2] ?? "").matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]));
    for (const n of ["ALTCHA_HMAC_KEY", "CAPTCHA_PROVIDER", "XAI_API_KEY", "VISION_PROVIDER", "XAI_EFFORT", "XAI_PRICE_IN_PER_M", "XAI_DAILY_CAP_USD", "AGEVERIF_CLIENT_ID", "AGE_PROVIDER", "SCREENING_PROVIDER", "PHOTO_BETA"]) {
      expect(names, n).toContain(n);
    }
    for (const n of names) {
      expect(ENV_EXAMPLE, `.env.example ${n}`).toMatch(new RegExp(`^${n}=`, "m"));
      expect(SRC.some((s) => new RegExp(`\\b${n}\\b`).test(s.t)), `${n} lue dans le code`).toBe(true);
    }
    // PHOTO_BETA est posée en dernier.
    expect(rows[rows.length - 1]).toContain("PHOTO_BETA");
  });

  it("l'adresse de retour documentée est celle que construit le code", () => {
    const src = read("src/lib/providers/ageverif.ts");
    expect(src).toContain("/api/age/callback");
    expect(ACTIVATION).toContain("https://bitometre.com/api/age/callback");
    expect(ENV_EXAMPLE).toContain("SITE_URL + /api/age/callback");
  });

  it("le texte de /verification-age ne prétend plus au « double anonymat »", () => {
    const page = read("src/app/verification-age/page.tsx");
    expect(page).not.toMatch(/double\s+anonymat|ne sait pas quel site/i);
    expect(page).toMatch(/peut savoir/);
  });
});
