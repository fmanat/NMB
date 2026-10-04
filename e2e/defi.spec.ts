import { createReportA, expect, fakeIp, payReport, test } from "./helpers";

test.describe("Défi entre amis", () => {
  test("invitation, parcours de l'ami, comparaison, retrait", async ({ page, browser, baseURL }) => {
    const myId = await createReportA(page, { length: "14,2", girth: "12,1" });
    await payReport(page);

    // Création du lien de défi.
    await page.goto(`/r/${myId}/defi`);
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    await expect(page.getByText("En attente : personne n'a encore relevé le défi.")).toBeVisible();
    const share = page.locator("[data-share-toolbar]");
    for (const name of ["Copier", "WhatsApp", "Telegram", "X"]) await expect(share.getByRole(name === "Copier" ? "button" : "link", { name, exact: true })).toBeVisible();
    const inviteUrl = await page.getByLabel("Lien du défi à envoyer à votre ami").inputValue();
    const path = new URL(inviteUrl).pathname;
    expect(path).toMatch(/^\/defi\/[A-Za-z0-9_-]+$/);
    // Le lien ne révèle rien du créateur.
    expect(path).not.toContain(myId);

    // L'ami : autre navigateur, autre adresse, relève le défi et paie son propre rapport.
    const friend = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const fp = await friend.newPage();
    await fp.goto(path);
    await expect(fp.getByRole("heading", { name: "Un ami vous défie" })).toBeVisible();
    const inviteHtml = await fp.content();
    expect(inviteHtml).not.toContain(myId);
    expect(inviteHtml).not.toContain("14,2");
    await fp.getByRole("button", { name: "Relever le défi" }).click();
    await expect(fp).toHaveURL(/\/analyse$/);
    const friendId = await createReportA(fp, { length: "10", girth: "9,5" });
    await payReport(fp);

    // Comparaison côté créateur : scores et percentiles, sans mesure en cm.
    await page.goto(`/r/${myId}/defi`);
    await expect(page.getByRole("columnheader", { name: "Votre ami" })).toBeVisible();
    const table = await page.locator("table").innerText();
    expect(table).toContain("Score");
    expect(table).not.toMatch(/\bcm\b/);

    // Comparaison côté ami.
    await fp.goto(`/r/${friendId}/defi`);
    await expect(fp.getByRole("columnheader", { name: "Votre ami" })).toBeVisible();

    // Retrait du créateur : la comparaison disparaît pour les deux.
    await page.goto(`/r/${myId}/defi`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /Retirer mon rapport de la comparaison/ }).click();
    await expect(page.getByText(/Vous avez retiré votre rapport/)).toBeVisible();
    await fp.goto(`/r/${friendId}/defi`);
    await expect(fp.getByText(/L'autre participant a retiré son rapport/)).toBeVisible();
    await expect(fp.locator("table")).toHaveCount(0);
    await friend.close();
  });

  test("un lien de défi inconnu ou déjà relevé ne donne rien", async ({ page, request, baseURL }) => {
    expect((await request.get(`${baseURL}/defi/inexistant-0123456789`)).status()).toBe(404);
    const id = await createReportA(page);
    await payReport(page);
    await page.goto(`/r/${id}/defi`);
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    const path = new URL(await page.getByLabel("Lien du défi à envoyer à votre ami").inputValue()).pathname;
    await page.goto(path);
    await page.getByRole("button", { name: "Relever le défi" }).click();
    await expect(page).toHaveURL(/\/analyse$/);
    await createReportA(page);
    // Un troisième visiteur : défi indisponible.
    await page.context().clearCookies();
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Ce défi n'est plus disponible" })).toBeVisible();
    await expect(page.getByText(/déjà été relevé ou retiré/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Relever le défi" })).toHaveCount(0);
  });
});
