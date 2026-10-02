import { defineConfig } from "@playwright/test";
import { hashPassword } from "./src/lib/admin/auth";

// Tests de bout en bout : deux copies du site, sur un schéma dédié (e2e) de la base de tests, avec les moteurs SIMULÉS.
//  - port 3201 : scénario de vision « ok » ;  port 3202 : scénario « confiance basse ».
// Aucun appel xAI, aucun prestataire réel. Le mot de passe d'administration ci-dessous n'existe que pour ces tests.
export const E2E = {
  // Schéma « e2e » dans la base de tests : le rôle nmb n'a pas le droit de créer une base, et les tests unitaires (schéma public) restent intacts.
  dbUrl: "postgresql://nmb:nmb@localhost:5432/nmb_test?options=-c%20search_path%3De2e",
  okUrl: "http://localhost:3201",
  lowUrl: "http://localhost:3202",
  altchaUrl: "http://localhost:3203",
  betaUrl: "http://localhost:3204",
  betaUser: "testeur-e2e",
  betaPassword: "mot-de-passe-de-protection-e2e",
  paymentSecret: "secret-e2e-paiement",
  adminPassword: "mot-de-passe-e2e-jetable",
} as const;

// Les copies du site tournent en mode développement (« next dev ») : le garde-fou qui interdit les moteurs simulés en production
// est figé à la construction, donc un site construit ne pourrait jamais les utiliser. Chaque copie a son dossier de travail.
const env = (scenario: string, dist: string, extra: Record<string, string> = {}) => ({
  NEXT_DIST_DIR: dist,
  DATABASE_URL: E2E.dbUrl,
  PAYMENT_PROVIDER: "simulation",
  PAYMENT_WEBHOOK_SECRET: E2E.paymentSecret,
  IP_HASH_SECRET: "secret-e2e-ip",
  AGE_TOKEN_SECRET: "secret-e2e-age",
  ADMIN_SESSION_SECRET: "secret-e2e-admin-session",
  ADMIN_PASSWORD_HASH: hashPassword(E2E.adminPassword),
  VISION_PROVIDER: "simulation",
  AGE_PROVIDER: "simulation",
  SCREENING_PROVIDER: "simulation",
  CAPTCHA_PROVIDER: "simulation",
  SIM_VISION_SCENARIO: scenario,
  XAI_API_KEY: "",
  STATS_WEBHOOK_URL: "",
  // Bandeau défilant de l'accueil : pas de mémoire des agrégats, pour qu'un test qui remplit la base voie le compteur tout de suite.
  TICKER_STATS_TTL_MS: "0",
  SITE_URL: "http://localhost:3201",
  ...extra,
});

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: { baseURL: E2E.okUrl, locale: "fr-FR", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testIgnore: /(beta|accessibilite|mobile).spec.ts/, use: { browserName: "chromium" } },
    // Mode bêta gratuite, site protégé par mot de passe (authentification HTTP) : copie dédiée sur le port 3204.
    { name: "beta", testMatch: /(beta|accessibilite|mobile).spec.ts/, use: { browserName: "chromium", baseURL: E2E.betaUrl, httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword } } },
  ],
  webServer: [
    { command: "npx next dev -p 3201", url: E2E.okUrl, env: env("ok", ".next-e2e-ok"), reuseExistingServer: false, timeout: 180_000 },
    // Captcha à preuve de travail réel (ALTCHA auto-hébergé), moteurs de vision simulés.
    {
      command: "npx next dev -p 3203",
      url: E2E.altchaUrl,
      env: env("ok", ".next-e2e-altcha", { CAPTCHA_PROVIDER: "altcha", ALTCHA_HMAC_KEY: "cle-e2e-altcha-de-32-caracteres-ou-plus", ALTCHA_MAX_NUMBER: "5000" }),
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: "npx next dev -p 3204",
      url: E2E.betaUrl + "/api/health",
      env: env("ok", ".next-e2e-beta", { FREE_BETA: "on", SITE_PASSWORD: E2E.betaPassword, SITE_USER: E2E.betaUser, SITE_URL: E2E.betaUrl }),
      reuseExistingServer: false,
      timeout: 180_000,
    },
    { command: "npx next dev -p 3202", url: E2E.lowUrl, env: env("low_confidence", ".next-e2e-low"), reuseExistingServer: false, timeout: 180_000 },
  ],
});
