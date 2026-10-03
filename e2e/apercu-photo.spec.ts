import type { Page } from "@playwright/test";
import { E2E, expect, neutralImage, test, withDb } from "./helpers";

// Aperçu de la formule photo (FREE_BETA=on, PHOTO_BETA=admin, port 3206, moteurs simulés) : invisible du public ; avec une session
// d'administration, parcours complet. Sans prestataire réel de vérification d'âge, la session d'administration en tient lieu, et
// l'écran le dit (rien n'est présenté comme une vérification d'âge).

async function login(page: Page) {
  await page.goto("/admin/connexion");
  await page.getByLabel("Mot de passe").fill(E2E.adminPassword);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("Aperçu de la formule photo (PHOTO_BETA=admin)", () => {
  test("public : aucune trace de la formule photo (404, questionnaire seul)", async ({ page, request }) => {
    for (const path of ["/analyse/photo?f=B", "/verification-age?f=B", "/api/captcha/challenge", "/api/age/callback"]) {
      expect((await request.get(path, { failOnStatusCode: false, maxRedirects: 0 })).status(), path).toBe(404);
    }
    expect((await request.post("/api/analyse", { failOnStatusCode: false, multipart: { formula: "B" } })).status()).toBe(404);
    await page.goto("/analyse");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vos mesures");
    await expect(page.locator("[data-protocol=B]")).toHaveCount(0);
  });

  test("session d'administration : lien depuis le tableau de bord, choix A ou B, âge remplacé par la session, rapport complet", async ({ page }) => {
    await login(page);
    // Session valable sur tout le site, envoyée au retour d'un prestataire d'âge (navigation venue d'un autre site) : SameSite=Lax.
    const session = (await page.context().cookies()).find((c) => c.name === "nmb_admin_session");
    expect(session).toMatchObject({ path: "/", sameSite: "Lax", httpOnly: true });
    await page.locator("[data-photo-preview-link]").click();
    await expect(page.locator("[data-photo-preview]")).toBeVisible();
    await page.locator("[data-protocol=B]").click();
    await expect(page).toHaveURL(/\/verification-age\?f=B/);
    await expect(page.getByText("Aucun prestataire de vérification d'âge n'est encore branché")).toBeVisible();
    await page.getByRole("button", { name: "Continuer (aperçu administrateur)" }).click();
    await expect(page).toHaveURL(/\/analyse\/photo\?f=B/);
    await expect(page.locator("[data-photo-preview]")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: "neutre.jpg", mimeType: "image/jpeg", buffer: await neutralImage() });
    await page.getByLabel("J'ai 18 ans ou plus.").check();
    await page.getByLabel("Cette photo est de moi.").check();
    await page.getByLabel(/Je consens au traitement de cette donnée sensible/).check();
    await page.getByLabel(/Je ne suis pas un robot/).check();
    await page.getByRole("button", { name: "Lancer l'analyse" }).click();
    await expect(page.getByRole("heading", { name: /Rapport d'analyse morphométrique/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("BÊTA GRATUITE", { exact: true })).toBeVisible();
    const id = page.url().split("/r/")[1];
    await withDb(async (db) => {
      expect((await db.query("SELECT paid, free_beta FROM reports WHERE id = $1", [id])).rows[0]).toEqual({ paid: true, free_beta: true });
    });

    // Déconnexion : la formule photo redevient introuvable, même avec le jeton d'âge encore valide.
    await page.goto("/admin");
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion/);
    const res = await page.request.get("/analyse/photo?f=B", { failOnStatusCode: false, maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });
});
