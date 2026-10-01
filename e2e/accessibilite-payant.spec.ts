import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createReportA, expect, test } from "./helpers";

// Même contrôle automatique axe-core que e2e/accessibilite.spec.ts, sur les écrans de la version PAYANTE (hors bêta) : choix du
// protocole, CGV, aperçu verrouillé, paiement, vérification d'âge, envoi de la photo (moteurs simulés, image jamais envoyée ici).
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function scan(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/.+/); // le titre est diffusé en flux par Next.js : il peut arriver un instant après le contenu
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const lines = res.violations.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} élément(s), ex. ${v.nodes[0]?.target.join(" ")}`);
  expect(lines, `${label} : violations axe`).toEqual([]);
}

test.describe("Accessibilité : version payante", () => {
  test("accueil, choix du protocole, CGV, aperçu verrouillé, paiement", async ({ page }) => {
    for (const path of ["/", "/analyse", "/cgv", "/analyse/questionnaire"]) {
      await page.goto(path);
      await scan(page, path);
    }
    const id = await createReportA(page);
    await scan(page, "aperçu verrouillé");
    await page.goto(`/paiement/${id}`);
    await scan(page, "paiement");
    await page.getByRole("button", { name: /^Payer/ }).click(); // sans la case : message d'erreur
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible();
    await scan(page, "paiement avec erreur");
  });

  test("vérification d'âge simulée et envoi de la photo", async ({ page }) => {
    await page.goto("/analyse/photo?f=B");
    await expect(page).toHaveURL(/\/verification-age/);
    await scan(page, "vérification d'âge");
    await page.getByRole("button", { name: "Vérifier mon âge" }).click();
    await scan(page, "vérification d'âge simulée");
    await page.getByRole("button", { name: "Simuler une vérification réussie" }).click();
    await expect(page).toHaveURL(/\/analyse\/photo\?f=B/);
    await scan(page, "envoi de la photo B");
    await page.goto("/analyse/photo?f=C");
    await scan(page, "envoi de la photo C");
  });
});
