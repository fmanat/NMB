import { PROFILES } from "../src/lib/profiles";
import { createReportA, expect, fillQuestionnaire, payReport, reportIdFrom, test } from "./helpers";

// Version payante (port 3201) : le profil morphologique n'est pas dans l'aperçu verrouillé, il apparaît dans le rapport débloqué,
// et la carte de partage ne le montre que si l'option est cochée. Valeurs en érection : l'état se choisit au premier écran du test (aucun choix par défaut).

test.describe("Profils : version payante", () => {
  test("rapport verrouillé : aucun profil ; débloqué : le profil attendu (érection, 16 cm × 14 cm : Le Panoramique)", async ({ page }) => {
    await fillQuestionnaire(page, { state: "erect", length: "16", girth: "14" });
    await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
    const id = reportIdFrom(page.url());

    // Aperçu verrouillé : ni profil, ni nom de profil.
    await expect(page.getByRole("link", { name: /Débloquer pour/ })).toBeVisible();
    expect(await page.content()).not.toContain("data-profile");
    for (const p of PROFILES) await expect(page.getByText(p.name, { exact: true })).toHaveCount(0);

    await payReport(page);
    const card = page.locator('[data-profile="l3c3"]');
    await expect(card.getByRole("heading", { level: 2, name: "Le Panoramique" })).toBeVisible();
    await expect(page.locator("[data-profile]")).toHaveCount(1);

    // Carte : sans l'option, aucun profil ; avec l'option, le nom.
    await page.goto(`/r/${id}/partager`);
    await expect(page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" })).not.toBeChecked();
    await page.getByRole("button", { name: "Créer la carte et la partager" }).click();
    await expect(page).toHaveURL(/\/c\//);
    await expect(page.locator("[data-card-profile]")).toHaveCount(0);
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).check();
    await page.getByRole("button", { name: "Créer la carte et la partager" }).click();
    await expect(page.locator("[data-card-profile]")).toContainText("Le Panoramique");
  });

  test("un rapport qui n'est pas payé reste verrouillé : le profil n'apparaît pas même en ouvrant le partage", async ({ page }) => {
    const id = await createReportA(page, { length: "14,2", girth: "12,1" });
    await page.goto(`/r/${id}/partager`);
    await expect(page).toHaveURL(new RegExp(`/r/${id}$`));
    expect(await page.content()).not.toContain("data-profile");
  });
});
