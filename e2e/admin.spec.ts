import type { Page } from "@playwright/test";
import { alertOf, E2E, expect, test } from "./helpers";

/** Clique « Se connecter » et attend la réponse du serveur (chaque échec est volontairement ralenti). */
async function submit(page: Page) {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/connexion")),
    page.getByRole("button", { name: "Se connecter" }).click(),
  ]);
}

// Mot de passe de test : défini uniquement dans la configuration des copies de test (empreinte passée par l'environnement), jamais écrit en base ni dans .env.
test.describe("Administration", () => {
  test("accès protégé, mauvais mot de passe refusé, connexion, déconnexion", async ({ page }) => {
    // Sans connexion : renvoyé vers la page de connexion.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);

    // Mauvais mot de passe.
    await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe-long");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(alertOf(page)).toContainText("Mot de passe incorrect");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);

    // Bon mot de passe.
    await page.getByLabel("Mot de passe").fill(E2E.adminPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
    // Le tableau de bord n'affiche aucune donnée personnelle : pas d'adresse IP ni d'identifiant de rapport complet.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\b10\.\d+\.\d+\.\d+\b/);

    // Déconnexion : la page n'est plus accessible.
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);
  });

  test("un cookie forgé ne donne pas accès", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "nmb_admin", value: "forge.0.abc", domain: new URL(baseURL!).hostname, path: "/admin" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);
  });

  test("trop d'échecs : la connexion est bloquée même avec le bon mot de passe", async ({ page }) => {
    await page.goto("/admin/connexion");
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Mot de passe").fill(`mauvais-essai-numero-${i}`);
      await submit(page);
    }
    await page.getByLabel("Mot de passe").fill(E2E.adminPassword);
    await submit(page);
    await expect(alertOf(page)).toContainText("Trop de tentatives");
    await expect(page).toHaveURL(/\/admin\/connexion/);
  });
});
