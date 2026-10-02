import AxeBuilder from "@axe-core/playwright";
import { expect, request as pwRequest, test, type Page } from "@playwright/test";

// Test de fumée du site de test déployé (bêta gratuite, protégé par mot de passe). Voir playwright.remote.config.ts.
const URL_ = process.env.RAILWAY_TEST_URL!;
const SITE_USER = process.env.RAILWAY_TEST_SITE_USER ?? "bitometre";
const SITE_PASSWORD = process.env.RAILWAY_TEST_SITE_PASSWORD ?? "";
const ADMIN_PASSWORD = process.env.RAILWAY_TEST_ADMIN_PASSWORD ?? "";

const idFrom = (u: string) => u.match(/\/r\/([A-Za-z0-9_-]+)/)![1];

async function report(page: Page, length: string, girth: string): Promise<string> {
  await page.goto("/analyse/questionnaire");
  await page.getByLabel("Longueur (cm)").fill(length);
  await page.getByLabel("Circonférence (cm)").fill(girth);
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel(/Je consens au traitement des valeurs que je saisis/).check();
  await page.getByRole("button", { name: "Calculer mon rapport" }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
  return idFrom(page.url());
}

test.describe("Site de test Railway", () => {
  test("protection par mot de passe : 401 sans identifiants, /api/health libre", async () => {
    for (const creds of [undefined, { username: SITE_USER, password: "faux-mot-de-passe" }]) {
      const ctx = await pwRequest.newContext({ baseURL: URL_, httpCredentials: creds });
      for (const path of ["/", "/admin", "/analyse/questionnaire", "/api/stats", "/robots.txt"]) {
        const r = await ctx.get(path, { failOnStatusCode: false });
        expect(r.status(), path).toBe(401);
        expect(await r.text()).not.toContain("Bitomètre");
      }
      const h = await ctx.get("/api/health");
      expect(h.status()).toBe(200);
      expect(await h.json()).toEqual({ ok: true });
      await ctx.dispose();
    }
  });

  test("en-têtes de sécurité, HTTPS, noindex", async ({ request }) => {
    expect(URL_.startsWith("https://")).toBe(true);
    const r = await request.get("/");
    expect(r.status()).toBe(200);
    const h = r.headers();
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["x-robots-tag"]).toContain("noindex");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("bêta : formules photo, paiement, CGV introuvables ; conditions disponibles ; accueil sans prix", async ({ request, page }) => {
    for (const path of ["/analyse/photo", "/analyse/photo?f=C", "/verification-age", "/paiement/" + "a".repeat(43), "/cgv", "/api/age/callback", "/api/captcha/challenge", "/api/payments/webhook"]) {
      expect((await request.get(path, { failOnStatusCode: false, maxRedirects: 0 })).status(), path).toBe(404);
    }
    expect((await request.post("/api/analyse", { failOnStatusCode: false })).status()).toBe(404);
    expect((await request.get("/conditions")).status()).toBe(200);
    await page.goto("/");
    const text = await page.locator("body").innerText();
    expect(text).toContain("Gratuit");
    expect(text).not.toMatch(/€|PROTOCOLE [BC]|\bphoto/i);
  });

  test("parcours A, carte de partage, défi et comparaison", async ({ page, browser }) => {
    const id = await report(page, "14,2", "12,1");
    await expect(page.getByRole("heading", { name: "Rapport morphologique" })).toBeVisible();
    await expect(page.getByText("BÊTA GRATUITE", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "14,2 cm" })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/€|paiement|payer/i);

    // Carte de partage.
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]+$/);
    const cardId = page.url().split("/c/")[1];
    const og = await page.request.get(`/c/${cardId}/og`);
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");

    // Défi : l'ami remplit le questionnaire, sans paiement ni vérification d'âge.
    await page.goto(`/r/${id}/defi`);
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    const path = new URL(await page.locator("input[readonly]").inputValue()).pathname;
    const friend = await browser.newContext({ baseURL: URL_, httpCredentials: { username: SITE_USER, password: SITE_PASSWORD } });
    const fp = await friend.newPage();
    await fp.goto(path);
    await fp.getByRole("button", { name: "Relever le défi" }).click();
    await expect(fp).toHaveURL(/\/analyse\/questionnaire$/);
    const friendId = await report(fp, "10", "9,5");
    await page.goto(`/r/${id}/defi`);
    await expect(page.getByRole("columnheader", { name: "Votre ami" })).toBeVisible();
    expect(await page.locator("table").innerText()).not.toMatch(/\bcm\b/);

    // Nettoyage : suppression des deux rapports de test depuis leur page.
    for (const [p, rid] of [[fp, friendId], [page, id]] as const) {
      await p.goto(`/r/${rid}`);
      p.once("dialog", (d) => d.accept());
      await p.getByRole("button", { name: "Supprimer mon rapport" }).click();
      expect((await p.request.get(`/r/${rid}`, { failOnStatusCode: false })).status()).toBe(404);
    }
    await friend.close();
  });

  test("administration : connexion, tableau de bord, entonnoir", async ({ page }) => {
    expect(ADMIN_PASSWORD.length).toBeGreaterThan(11);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await page.getByLabel("Mot de passe").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Entonnoir de conversion" })).toBeVisible();
    await expect(page.getByText(/bêta gratuite/i).first()).toBeVisible();
    await page.getByRole("button", { name: "Se déconnecter" }).click();
  });

  test("accessibilité (axe-core) sur la version de production déployée", async ({ page }) => {
    for (const path of ["/", "/analyse/questionnaire", "/conditions", "/confidentialite", "/mentions-legales", "/methode", "/contact"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      expect(res.violations.map((v) => `${v.id} : ${v.help}`), path).toEqual([]);
    }
  });

  test("mentions légales : marqueurs à compléter visibles (identité de la Ltd non renseignée)", async ({ page }) => {
    await page.goto("/mentions-legales");
    const t = await page.locator("main").innerText();
    expect(t).toContain("[À COMPLÉTER : raison sociale de la Ltd]");
    expect(t).toContain("Railway Corporation");
  });
});
