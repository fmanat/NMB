import sharp from "sharp";
import { createReportA, expect, payReport, test } from "./helpers";

test.describe("Carte de partage", () => {
  test("création, page publique, images 1200×630 et 1080×1920, suppression", async ({ page, browser, baseURL, ip }) => {
    const id = await createReportA(page, { length: "14,2", girth: "12,1" });
    await payReport(page);

    // Une carte n'est pas créable tant que le rapport n'est pas payé : test sur un second rapport.
    const other = await createReportA(page);
    await page.goto(`/r/${other}/partager`);
    await expect(page).toHaveURL(new RegExp(`/r/${other}$`));

    await page.goto(`/r/${id}/partager`);
    await page.getByRole("button", { name: "Créer la carte et la partager" }).click();
    await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]+(\?nouvelle=1)?$/);
    // L'auteur arrive sur sa carte avec ?nouvelle=1 : la barre de partage passe en premier.
    expect(new URL(page.url()).searchParams.get("nouvelle")).toBe("1");
    const cardId = new URL(page.url()).pathname.split("/c/")[1];
    const share = page.getByRole("region", { name: "Partager la carte" });
    const link = share.getByLabel("Lien à partager");
    await expect(link).toHaveValue(new RegExp(`/c/${cardId}$`));
    for (const name of ["Copier", "WhatsApp", "Telegram", "X"]) await expect(share.getByRole(name === "Copier" ? "button" : "link", { name, exact: true })).toBeVisible();
    await expect(share.getByRole("link", { name: /Télécharger l'image/ })).toHaveAttribute("href", `/c/${cardId}/story`);

    // Page publique : lisible sans aucun cookie, sans donnée du rapport privé (ni mesure en cm, ni identifiant du rapport).
    const anon = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": ip } });
    const pub = await anon.newPage();
    await pub.goto(`/c/${cardId}`);
    await expect(pub.getByText(/RAPPORT CLINIQUE N°/)).toBeVisible();
    // Le visiteur n'a pas la barre de partage de l'auteur : il a l'invitation à faire le test.
    await expect(pub.getByRole("heading", { name: "Et vous, à quel percentile êtes-vous ?" })).toBeVisible();
    await expect(pub.getByRole("region", { name: "Et vous, à quel percentile êtes-vous ?" }).getByRole("button", { name: "Découvrir mon percentile" })).toBeVisible();
    await expect(pub.getByLabel("Lien à partager")).toHaveCount(0);
    const html = await pub.content();
    expect(html).not.toContain(id);
    expect(html).not.toContain("14,2");
    expect(html).toMatch(/noindex/);

    // Images de partage : tailles exactes.
    const og = await anon.request.get(`/c/${cardId}/og`);
    expect(og.status()).toBe(200);
    const ogMeta = await sharp(await og.body()).metadata();
    expect([ogMeta.width, ogMeta.height]).toEqual([1200, 630]);
    const story = await anon.request.get(`/c/${cardId}/story`);
    expect(story.status()).toBe(200);
    const storyMeta = await sharp(await story.body()).metadata();
    expect([storyMeta.width, storyMeta.height]).toEqual([1080, 1920]);

    // Image Open Graph neutre pour les pages privées.
    const neutral = await anon.request.get("/og/neutre");
    expect(neutral.status()).toBe(200);
    const nMeta = await sharp(await neutral.body()).metadata();
    expect([nMeta.width, nMeta.height]).toEqual([1200, 630]);

    // Suppression depuis le rapport : la carte, sa page et ses images disparaissent.
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("button", { name: "Retirer" }).click();
    for (const path of [`/c/${cardId}`, `/c/${cardId}/og`, `/c/${cardId}/story`]) {
      expect((await anon.request.get(path)).status(), path).toBe(404);
    }
    await anon.close();
  });

  test("supprimer le rapport supprime aussi ses cartes", async ({ page, request, baseURL }) => {
    const id = await createReportA(page);
    await payReport(page);
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("button", { name: "Créer la carte et la partager" }).click();
    const cardId = new URL(page.url()).pathname.split("/c/")[1];
    await page.goto(`/r/${id}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Supprimer mon rapport" }).click();
    await expect.poll(async () => (await request.get(`${baseURL}/c/${cardId}`)).status()).toBe(404);
  });
});
