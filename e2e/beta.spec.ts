import { request as pwRequest, type Page } from "@playwright/test";
import { E2E, expect, fakeIp, reportIdFrom, test, withDb } from "./helpers";

// Mode « bêta gratuite » (FREE_BETA=on) et site protégé par mot de passe : copie dédiée du site (port 3204), moteurs simulés.

async function betaReport(page: Page, o: { length?: string; girth?: string } = {}): Promise<string> {
  await page.goto("/analyse/questionnaire");
  await page.getByLabel("Longueur (cm)").fill(o.length ?? "14,2");
  await page.getByLabel("Circonférence (cm)").fill(o.girth ?? "12,1");
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel(/Je consens au traitement des valeurs que je saisis/).check();
  await page.getByRole("button", { name: "Calculer mon rapport" }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
  return reportIdFrom(page.url());
}

test.describe("Site protégé par mot de passe", () => {
  test("sans identifiants ou avec un mauvais mot de passe : 401 partout ; /api/health reste libre", async () => {
    for (const creds of [undefined, { username: E2E.betaUser, password: "faux" }, { username: "autre", password: E2E.betaPassword }]) {
      const ctx = await pwRequest.newContext({ baseURL: E2E.betaUrl, httpCredentials: creds, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
      for (const path of ["/", "/admin", "/analyse/questionnaire", "/api/stats", "/robots.txt", "/r/" + "a".repeat(43)]) {
        const res = await ctx.get(path, { failOnStatusCode: false });
        expect(res.status(), `${path} sans bons identifiants`).toBe(401);
        expect(res.headers()["www-authenticate"]).toMatch(/^Basic /);
        expect(await res.text()).not.toContain("Bitomètre");
      }
      const health = await ctx.get("/api/health");
      expect(health.status()).toBe(200);
      expect(await health.json()).toEqual({ ok: true });
      await ctx.dispose();
    }
  });

  test("avec les bons identifiants : le site répond, noindex, en-têtes de sécurité présents", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const h = res.headers();
    expect(h["x-robots-tag"]).toContain("noindex");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});

test.describe("Bêta gratuite : formule A seule", () => {
  test("l'accueil ne parle ni de prix, ni de photo, ni des protocoles B et C", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Gratuit pendant la bêta", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Le questionnaire" })).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/€|PROTOCOLE [BC]|Trois protocoles|paiement unique|Photo jamais stockée/i);
    expect(text).not.toMatch(/\bphoto/i);
    await expect(page.getByRole("link", { name: "Conditions d'utilisation (bêta)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "CGV", exact: true })).toHaveCount(0);
  });

  test("routes des formules photo, âge, captcha, paiement et CGV : 404 ; /conditions disponible", async ({ request }) => {
    for (const path of ["/analyse/photo", "/analyse/photo?f=C", "/verification-age", "/paiement/" + "a".repeat(43), "/cgv", "/api/age/callback", "/api/captcha/challenge", "/api/payments/webhook"]) {
      const res = await request.get(path, { failOnStatusCode: false, maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }
    for (const method of ["post"] as const) {
      expect((await request[method]("/api/analyse", { failOnStatusCode: false })).status()).toBe(404);
      expect((await request[method]("/api/payments/webhook", { data: "{}", failOnStatusCode: false })).status()).toBe(404);
    }
    const cond = await request.get("/conditions");
    expect(cond.status()).toBe(200);
    expect(await cond.text()).toContain("Aucune garantie de conservation");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/conditions");
    expect(sitemap).not.toContain("/cgv");
  });

  test("le choix de protocole mène directement au questionnaire", async ({ page }) => {
    await page.goto("/analyse");
    await expect(page).toHaveURL(/\/analyse\/questionnaire$/);
    await expect(page.getByText("Bêta gratuite : le rapport est affiché immédiatement, sans paiement.")).toBeVisible();
  });

  test("sans consentement, pas de rapport ; avec, le rapport est débloqué sans paiement, avec la mention Bêta gratuite", async ({ page, request, baseURL }) => {
    await page.goto("/analyse/questionnaire");
    await page.getByLabel("Longueur (cm)").fill("14,2");
    await page.getByLabel("Circonférence (cm)").fill("12,1");
    await page.getByLabel("J'ai 18 ans ou plus.").check();
    await page.getByRole("button", { name: "Calculer mon rapport" }).click();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toContainText("consentir au traitement");
    await expect(page).toHaveURL(/\/analyse\/questionnaire/);

    const id = await betaReport(page);
    await expect(page.getByRole("heading", { name: "Rapport d'analyse" })).toBeVisible();
    await expect(page.getByText("BÊTA GRATUITE", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "14,2 cm" })).toBeVisible();
    await expect(page.getByText(/Bêta gratuite : ce rapport est conservé 90 jours au plus/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Débloquer/ })).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(/€|paiement|payer/i);
    // Aucun paiement n'a été créé ; le rapport est marqué bêta.
    await withDb(async (db) => {
      expect((await db.query("SELECT count(*)::int AS n FROM payments WHERE report_id = $1", [id])).rows[0].n).toBe(0);
      expect((await db.query("SELECT paid, free_beta FROM reports WHERE id = $1", [id])).rows[0]).toEqual({ paid: true, free_beta: true });
    });
    // Page privée : noindex et image neutre.
    const html = await (await request.get(`${baseURL}/r/${id}`)).text();
    expect(html).toMatch(/noindex/);
    expect(html).toContain("/og/neutre");
    // Le lien de paiement n'existe pas.
    expect((await request.get(`${baseURL}/paiement/${id}`, { failOnStatusCode: false })).status()).toBe(404);
  });

  test("carte de partage fonctionnelle en bêta", async ({ page, browser, baseURL, ip }) => {
    const id = await betaReport(page, { length: "13,7", girth: "11,9" });
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]+$/);
    const cardId = page.url().split("/c/")[1];
    // Page publique lue sans cookie : ni identifiant du rapport privé, ni mesure.
    const anon = await browser.newContext({ baseURL, httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword }, extraHTTPHeaders: { "x-forwarded-for": ip } });
    const pub = await anon.newPage();
    await pub.goto(`/c/${cardId}`);
    await expect(pub.getByText(/RAPPORT CLINIQUE N°/)).toBeVisible();
    const html = await pub.content();
    expect(html).not.toContain(id);
    expect(html).not.toContain("13,7");
    const og = await anon.request.get(`/c/${cardId}/og`);
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");
    await anon.close();
  });

  test("défi entre amis fonctionnel en bêta : l'ami remplit le questionnaire, sans paiement ni vérification d'âge", async ({ page, browser, baseURL }) => {
    const myId = await betaReport(page, { length: "14,2", girth: "12,1" });
    await page.goto(`/r/${myId}/defi`);
    await expect(page.getByText(/gratuit pendant la bêta/)).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/protocoles photo|paie son propre/i);
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    const path = new URL(await page.locator("input[readonly]").inputValue()).pathname;

    const friend = await browser.newContext({
      baseURL,
      httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword },
      extraHTTPHeaders: { "x-forwarded-for": fakeIp() },
    });
    const fp = await friend.newPage();
    await fp.goto(path);
    await expect(fp.getByRole("heading", { name: "Un ami vous défie" })).toBeVisible();
    expect(await fp.locator("body").innerText()).not.toMatch(/protocoles photo|vérification d'âge|payez/i);
    await fp.getByRole("button", { name: "Relever le défi" }).click();
    await expect(fp).toHaveURL(/\/analyse\/questionnaire$/);
    const friendId = await betaReport(fp, { length: "10", girth: "9,5" });

    await page.goto(`/r/${myId}/defi`);
    await expect(page.getByRole("columnheader", { name: "Votre ami" })).toBeVisible();
    expect(await page.locator("table").innerText()).not.toMatch(/\bcm\b/);
    await fp.goto(`/r/${friendId}/defi`);
    await expect(fp.getByRole("columnheader", { name: "Votre ami" })).toBeVisible();
    await friend.close();
  });

  test("mentions légales : marqueurs à compléter visibles, pas d'établissement en France ; confidentialité limitée à la bêta", async ({ page }) => {
    await page.goto("/mentions-legales");
    const legal = await page.locator("main").innerText();
    expect(legal).toContain("[À COMPLÉTER : raison sociale de la Ltd]");
    expect(legal).toContain("[À COMPLÉTER : numéro Companies House]");
    expect(legal).toContain("Railway Corporation");
    expect(legal).not.toMatch(/établissement en France|SIREN|Clever/i);
    await page.goto("/confidentialite");
    const priv = await page.locator("main").innerText();
    expect(priv).toMatch(/Hachée[\s\S]*effacée après 24 heures/);
    expect(priv).toContain("Aucun envoi à un prestataire d'analyse");
    expect(priv).toContain("Railway Corporation");
    expect(priv).not.toMatch(/SpaceXAI|xAI|photo.*30 jours|Stripe/);
    await page.goto("/methode");
    expect(await page.locator("main").innerText()).not.toMatch(/photographie|carte de référence|xAI/);
  });

  test("administration : accessible avec son propre mot de passe, bêta comptée à part", async ({ page }) => {
    await betaReport(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/connexion/);
    await page.getByLabel(/mot de passe/i).fill(E2E.adminPassword);
    await page.getByRole("button", { name: /connexion|se connecter/i }).click();
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText(/bêta gratuite/i).first()).toBeVisible();
  });
});

test.describe("Entonnoir de conversion (événements anonymes)", () => {
  const counts = () =>
    withDb(async (db) => {
      const r = await db.query("SELECT kind, count(*)::int AS n FROM funnel_events GROUP BY kind");
      const s = await db.query("SELECT kind, count(*)::int AS n FROM stat_events GROUP BY kind");
      return Object.fromEntries([...r.rows, ...s.rows].map((x) => [x.kind, x.n as number])) as Record<string, number>;
    });
  const n = (c: Record<string, number>, k: string) => c[k] ?? 0;

  test("accueil, début, questionnaire terminé, rapport affiché, carte, défi créé et relevé sont comptés, sans aucun cookie", async ({ page, browser, baseURL }) => {
    const before = await counts();
    await page.goto("/");
    await expect.poll(async () => n(await counts(), "home_view")).toBe(n(before, "home_view") + 1);
    const id = await betaReport(page); // questionnaire_start, questionnaire_done, report_view
    await expect.poll(async () => n(await counts(), "report_view")).toBe(n(before, "report_view") + 1);
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page).toHaveURL(/\/c\//);
    await page.goto(`/r/${id}/defi`);
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    const path = new URL(await page.locator("input[readonly]").inputValue()).pathname;
    // Aucun cookie posé par la mesure d'audience ni par le parcours du créateur.
    expect(await page.context().cookies()).toEqual([]);

    const friend = await browser.newContext({ baseURL, httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const fp = await friend.newPage();
    await fp.goto(path);
    await fp.getByRole("button", { name: "Relever le défi" }).click();
    await expect(fp).toHaveURL(/\/analyse\/questionnaire$/);
    await betaReport(fp); // le défi est « relevé » quand le rapport de l'ami est créé
    await friend.close();

    const after = await counts();
    for (const k of ["questionnaire_start", "questionnaire_done", "card_created", "challenge_created", "challenge_taken"]) {
      expect(n(after, k), k).toBeGreaterThanOrEqual(n(before, k) + 1);
    }
    expect(n(after, "locked_preview")).toBe(n(before, "locked_preview")); // pas d'aperçu verrouillé en bêta
    // La table n'a aucune colonne d'identité.
    await withDb(async (db) => {
      const cols = (await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'funnel_events' AND table_schema = current_schema()")).rows.map((r) => r.column_name).sort();
      expect(cols).toEqual(["created_at", "id", "kind"]);
    });
  });

  test("Do Not Track : aucun événement compté", async ({ browser, baseURL }) => {
    const before = await counts();
    const ctx = await browser.newContext({ baseURL, httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword }, extraHTTPHeaders: { dnt: "1", "x-forwarded-for": fakeIp() } });
    const p = await ctx.newPage();
    await p.goto("/");
    await p.goto("/analyse/questionnaire");
    await p.waitForTimeout(1500);
    expect(await counts()).toEqual(before);
    await ctx.close();
  });

  test("l'administration affiche l'entonnoir avec les taux de passage", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Mot de passe").fill(E2E.adminPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { name: "Entonnoir de conversion" })).toBeVisible();
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Entonnoir de conversion" }) });
    await expect(card.getByRole("row", { name: /Visite de l'accueil/ })).toBeVisible();
    await expect(card.getByRole("row", { name: /Défi relevé/ })).toBeVisible();
    expect(await card.innerText()).toMatch(/\d+ %/);
    await expect(card.getByRole("columnheader", { name: /7 jours/ })).toBeVisible();
    await expect(card.getByRole("columnheader", { name: /Depuis le début/ })).toBeVisible();
  });
});
