import type { Page } from "@playwright/test";
import { E2E, expect, fakeIp, reportIdFrom, test } from "./helpers";
import { layoutProblems } from "./layout";

// Mise en page sur petits écrans (320, 375 et 390 px de large) : aucun défilement horizontal, aucun texte qui en recouvre un autre,
// aucun texte coupé. Détection par les rectangles réels de chaque morceau de texte (Range.getClientRects), page par page.

async function betaReport(page: Page): Promise<string> {
  await page.goto("/analyse/questionnaire");
  await page.getByLabel("Longueur (cm)").fill("14,2");
  await page.getByLabel("Circonférence (cm)").fill("12,1");
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel(/Je consens au traitement des valeurs que je saisis/).check();
  await page.getByRole("button", { name: "Calculer mon rapport" }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
  return reportIdFrom(page.url());
}

const WIDTHS = [320, 375, 390] as const;

for (const width of WIDTHS) {
  test.describe(`Petits écrans : ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("pages publiques : ni débordement, ni recouvrement, ni texte coupé", async ({ page }) => {
      const report: string[] = [];
      for (const path of ["/", "/analyse/questionnaire", "/methode", "/conditions", "/confidentialite", "/mentions-legales", "/contact", "/admin/connexion"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        for (const p of await layoutProblems(page)) report.push(`${path} : ${p}`);
      }
      expect(report).toEqual([]);
    });

    test("rapport, partage, carte, défi, invitation", async ({ page, browser, baseURL }) => {
      const report: string[] = [];
      const check = async (label: string) => {
        await page.waitForLoadState("networkidle");
        for (const p of await layoutProblems(page)) report.push(`${label} : ${p}`);
      };
      const id = await betaReport(page);
      await check("rapport");
      await page.goto(`/r/${id}/partager`);
      await check("partager");
      await page.getByRole("button", { name: "Créer la carte" }).click();
      await expect(page).toHaveURL(/\/c\//);
      await check("carte");
      await page.goto(`/r/${id}/partager`);
      await check("partager (avec carte)");
      await page.goto(`/r/${id}/defi`);
      await check("défi (création)");
      await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
      await expect(page.getByText("En attente : personne n'a encore relevé le défi.")).toBeVisible();
      await check("défi (lien créé)");
      const path = new URL(await page.locator("input[readonly]").inputValue()).pathname;
      const friend = await browser.newContext({ baseURL, viewport: { width, height: 800 }, httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
      const fp = await friend.newPage();
      await fp.goto(path);
      for (const p of await layoutProblems(fp)) report.push(`invitation : ${p}`);
      await fp.getByRole("button", { name: "Relever le défi" }).click();
      await fp.waitForURL(/\/analyse$/);
      await betaReport(fp);
      await page.goto(`/r/${id}/defi`);
      await expect(page.getByRole("columnheader", { name: "Votre ami" })).toBeVisible();
      await check("défi (comparaison)");
      await friend.close();
      expect(report).toEqual([]);
    });

    test("états : fenêtre d'âge ouverte, message d'erreur du questionnaire", async ({ page }) => {
      const report: string[] = [];
      await page.goto("/");
      await page.getByRole("button", { name: "Démarrer mon analyse" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByLabel("Année de naissance").fill("2030");
      await page.getByLabel(/J'ai 18 ans ou plus/).check();
      await page.getByRole("button", { name: "Continuer" }).click();
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
      for (const p of await layoutProblems(page)) report.push(`fenêtre d'âge : ${p}`);
      await page.goto("/analyse/questionnaire");
      await page.getByLabel("Longueur (cm)").fill("14,2");
      await page.getByLabel("Circonférence (cm)").fill("12,1");
      await page.getByRole("button", { name: "Calculer mon rapport" }).click();
      await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible();
      for (const p of await layoutProblems(page)) report.push(`questionnaire en erreur : ${p}`);
      expect(report).toEqual([]);
    });
  });
}

// Contrôle de sensibilité : le détecteur doit signaler un vrai recouvrement et un vrai débordement (sinon un test vert ne prouve rien).
test.describe("Petits écrans : le détecteur voit les vrais problèmes", () => {
  test.use({ viewport: { width: 320, height: 800 } });
  test("recouvrement, texte coupé, défilement horizontal", async ({ page }) => {
    await page.goto("/contact");
    expect(await layoutProblems(page)).toEqual([]);
    await page.addStyleTag({ content: "h1{position:relative;top:56px}" }); // le titre descend sur le paragraphe suivant
    expect((await layoutProblems(page)).some((p) => p.startsWith("recouvrement"))).toBe(true);
    await page.reload();
    await page.addStyleTag({ content: "main p{margin-left:200px;white-space:nowrap}" }); // texte qui sort de l'écran
    const p = await layoutProblems(page);
    expect(p.some((x) => x.startsWith("texte coupé à droite"))).toBe(true);
    expect(p.some((x) => x.startsWith("défilement horizontal"))).toBe(true);
  });

  test("texte réservé aux lecteurs d'écran (boîte de 1 px, contenu imbriqué) : ignoré ; le même texte visible : signalé", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle"); // hydratation terminée : React ne retire plus rien du document
    const html = (style: string) => `<div id="sr-test" style="${style}"><ul><li><span style="white-space:nowrap">Texte réservé aux lecteurs d'écran, long et sans retour à la ligne possible, plus large que l'écran</span></li></ul></div>`;
    await page.evaluate((h) => document.querySelector("main")!.insertAdjacentHTML("beforeend", h), html("position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"));
    await expect(page.locator("#sr-test")).toHaveCount(1);
    expect(await layoutProblems(page)).toEqual([]);
    await page.evaluate(() => document.getElementById("sr-test")!.setAttribute("style", "position:static;overflow:visible"));
    expect((await layoutProblems(page)).some((x) => x.startsWith("texte coupé à droite"))).toBe(true);
  });
});

// Premier écran mobile : le bandeau « scanner » (visualisation schématique et valeurs de l'exemple fictif) précède le bouton principal,
// et le bouton reste entièrement visible sans défilement.
for (const [w, h] of [[390, 844], [375, 700], [360, 740]] as const) {
  test.describe(`Premier écran de l'accueil : ${w} × ${h} px`, () => {
    test.use({ viewport: { width: w, height: h } });
    test("le bandeau scanner (valeurs de l'exemple) est avant le bouton, qui est entièrement visible", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const cta = page.locator("main").getByRole("button", { name: "Démarrer mon analyse" }).first();
      const band = page.getByLabel("Scanner : aperçu d'un rapport d'exemple");
      await expect(band).toBeVisible();
      await expect(band.getByText("Exemple · valeurs fictives")).toBeVisible();
      await expect(band.getByText("13,8 cm")).toBeVisible();
      await expect(band.getByText("11,9 cm")).toBeVisible();
      await expect(band.getByText(/^\d+ \/ 100$/)).toBeVisible();
      const c = (await band.boundingBox())!;
      const b = (await cta.boundingBox())!;
      expect(c.y + c.height, "le bandeau est au-dessus du bouton").toBeLessThanOrEqual(b.y + 1);
      expect(b.y + b.height, "le bouton est dans le premier écran").toBeLessThanOrEqual(h);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      // Le rapport d'exemple complet reste plus bas dans la page.
      await expect(page.locator("#exemple")).toBeAttached();
    });
  });
}
