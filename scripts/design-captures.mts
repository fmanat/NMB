// Captures d'écran de l'accueil, du questionnaire (/analyse) et du rapport à 390 et 1 440 px (revue visuelle).
//   npx tsx scripts/design-captures.mts <dossier de sortie>
// Cible : RAILWAY_TEST_URL et identifiants du .env (site de test protégé) ; supprime le rapport créé pour la capture.
// Les captures ne contiennent que l'interface (valeurs d'essai) ; les images PNG sont ignorées par git.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

try {
  process.loadEnvFile(".env");
} catch {
  /* variables déjà présentes */
}
const out = process.argv[2];
if (!out) throw new Error("Indiquez le dossier de sortie.");
mkdirSync(out, { recursive: true });
const base = process.env.CAPTURE_URL ?? process.env.RAILWAY_TEST_URL!;
const browser = await chromium.launch();
for (const [name, width, height] of [["390", 390, 844], ["1440", 1440, 900]] as const) {
  const ctx = await browser.newContext({
    baseURL: base,
    viewport: { width, height },
    locale: "fr-FR",
    httpCredentials: { username: process.env.RAILWAY_TEST_SITE_USER ?? "bitometre", password: process.env.RAILWAY_TEST_SITE_PASSWORD ?? "" },
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${out}/accueil-${name}.png`, fullPage: true });
  await page.goto("/analyse");
  if (page.url().endsWith("/analyse")) {
    // version avec le questionnaire sur /analyse ; sinon l'ancien parcours redirige vers /analyse/questionnaire
  }
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${out}/analyse-${name}.png`, fullPage: true });
  await page.goto("/analyse/questionnaire");
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Longueur/).fill("14,2");
  await page.getByLabel(/Circonférence/).fill("12,1");
  await page.getByLabel(/J'ai 18 ans ou plus/).check();
  await page.getByLabel(/Je consens au traitement/).check();
  await page.getByRole("button", { name: /Calculer mon rapport/ }).click();
  await page.waitForURL(/\/r\//);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${out}/rapport-${name}.png`, fullPage: true });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Supprimer mon rapport" }).click();
  await page.waitForLoadState("networkidle");
  await ctx.close();
}
await browser.close();
console.log("Captures dans", out);
