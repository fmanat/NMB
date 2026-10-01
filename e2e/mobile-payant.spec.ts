import { createReportA, expect, test } from "./helpers";
import { layoutProblems } from "./layout";

// Mise en page sur petits écrans de la version PAYANTE (hors bêta) : choix du protocole, CGV, aperçu verrouillé, paiement,
// vérification d'âge simulée, envoi de la photo. Même détecteur que mobile.spec.ts.
for (const width of [320, 375, 390]) {
  test.describe(`Petits écrans, version payante : ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("écrans du parcours payant : ni débordement, ni recouvrement, ni texte coupé", async ({ page }) => {
      const report: string[] = [];
      const check = async (label: string) => {
        await page.waitForLoadState("networkidle");
        for (const p of await layoutProblems(page)) report.push(`${label} : ${p}`);
      };
      for (const path of ["/", "/analyse", "/cgv", "/analyse/questionnaire"]) {
        await page.goto(path);
        await check(path);
      }
      const id = await createReportA(page);
      await check("aperçu verrouillé");
      await page.goto(`/paiement/${id}`);
      await check("paiement");
      await page.goto("/analyse/photo?f=B");
      await check("vérification d'âge");
      await page.getByRole("button", { name: "Vérifier mon âge" }).click();
      await check("vérification d'âge simulée");
      await page.getByRole("button", { name: "Simuler une vérification réussie" }).click();
      await expect(page).toHaveURL(/\/analyse\/photo\?f=B/);
      await check("envoi de la photo B");
      await page.goto("/analyse/photo?f=C");
      await check("envoi de la photo C");
      expect(report).toEqual([]);
    });
  });
}
