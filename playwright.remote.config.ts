import { defineConfig } from "@playwright/test";

// Test de fumée sur le site déployé (Railway) : lit RAILWAY_TEST_URL, RAILWAY_TEST_SITE_USER, RAILWAY_TEST_SITE_PASSWORD et
// RAILWAY_TEST_ADMIN_PASSWORD dans .env (jamais dans le dépôt). Aucun serveur local, aucune base locale, aucun appel xAI.
//   npm run e2e:remote
try {
  process.loadEnvFile(".env");
} catch {
  // pas de .env : les variables doivent déjà être dans l'environnement
}

const url = process.env.RAILWAY_TEST_URL;
if (!url) throw new Error("RAILWAY_TEST_URL manquant (voir .env)");

export default defineConfig({
  testDir: "./e2e-remote",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: url,
    locale: "fr-FR",
    httpCredentials: { username: process.env.RAILWAY_TEST_SITE_USER ?? "bitometre", password: process.env.RAILWAY_TEST_SITE_PASSWORD ?? "" },
  },
  projects: [{ name: "remote", use: { browserName: "chromium" } }],
});
