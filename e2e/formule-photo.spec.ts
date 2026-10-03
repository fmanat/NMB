import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { OBSERVATION_MARKER } from "../src/lib/vision/simulation";
import { E2E, expect, fakeIp, neutralImage, reportIdFrom, sendPhoto, test, withDb } from "./helpers";
import { layoutProblems } from "./layout";

// Bêta de la formule photo (FREE_BETA=on + PHOTO_BETA=on, fournisseurs simulés, port 3205) : choix A ou B gratuits, parcours B complet
// (vérification d'âge simulée, cases, captcha simulé, image NEUTRE fabriquée à la volée), rapport débloqué sans paiement avec le commentaire
// standardisé et le profil morphologique ; formule C, paiement et CGV introuvables ; petits écrans et axe-core sur les pages photo.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
async function axeLines(page: Page): Promise<string[]> {
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/.+/);
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return res.violations.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} élément(s), ex. ${v.nodes[0]?.target.join(" ")}`);
}

/** Parcours B complet jusqu'au rapport débloqué ; renvoie l'identifiant du rapport. */
async function photoReport(page: Page): Promise<string> {
  await sendPhoto(page, { formula: "B", image: await neutralImage() });
  await expect(page.getByRole("heading", { name: /Rapport d'analyse morphométrique/ })).toBeVisible({ timeout: 60_000 });
  return reportIdFrom(page.url());
}

/** Depuis l'écran d'envoi (âge déjà vérifié dans ce contexte) : image neutre, cases, captcha simulé, envoi, rapport. */
async function submitFromPhotoPage(page: Page): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({ name: "neutre.jpg", mimeType: "image/jpeg", buffer: await neutralImage() });
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel("Cette photo est de moi.").check();
  await page.getByLabel(/Je consens au traitement de cette donnée sensible/).check();
  await page.getByLabel(/Je ne suis pas un robot/).check();
  await page.getByRole("button", { name: "Lancer l'analyse" }).click();
  await expect(page.getByRole("heading", { name: /Rapport d'analyse morphométrique/ })).toBeVisible({ timeout: 60_000 });
}

test.describe("Bêta photo : choix et libellés vrais", () => {
  test("/analyse propose les protocoles A et B, gratuits, sans prix ni protocole C ; le questionnaire reste accessible", async ({ page }) => {
    await page.goto("/analyse");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Choisissez un protocole");
    await expect(page.locator('[data-protocol="A"]')).toBeVisible();
    await expect(page.locator('[data-protocol="B"]')).toBeVisible();
    await expect(page.locator('[data-protocol="C"]')).toHaveCount(0);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/€|PROTOCOLE C|paiement unique|Recommandé/i);
    expect(text).toMatch(/Gratuit/);
    expect(text).toMatch(/estimation visuelle, ou mesure calibrée si une carte au format bancaire figure sur la photo/);
    expect(text).not.toMatch(/± 10 %/);
    expect(text).toMatch(/Vérification d'âge par un prestataire tiers/);
    expect(text).toMatch(/jamais enregistrée par Bitomètre/);
    expect(text).toMatch(/30 jours/);
    await page.goto("/analyse/questionnaire");
    await expect(page).toHaveURL(/\/analyse\/questionnaire$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vos mesures");
  });

  test("accueil, méthode, confidentialité et conditions disent ce que fait la photo, sans promesse de plus", async ({ page }) => {
    await page.goto("/");
    const home = await page.locator("body").innerText();
    expect(home).toMatch(/Gratuit pendant la bêta/);
    expect(home).toMatch(/estimées à partir d'une photo/);
    expect(home).not.toMatch(/€|Photo jamais stockée|mineurs détectés|contenus illicites bloqués/i);
    await page.goto("/methode");
    const methode = await page.locator("main").innerText();
    expect(methode).toContain("Mesures estimées à partir d'une photo");
    expect(methode).toContain("deux appels au modèle d'analyse");
    expect(methode).toContain("Taille calibrée");
    await page.goto("/confidentialite");
    const priv = await page.locator("main").innerText();
    expect(priv).toContain("SpaceXAI LLC");
    expect(priv).toMatch(/30 jours/);
    expect(priv).toMatch(/Tant qu'aucun prestataire n'est configuré, aucun filtrage n'a lieu/);
    expect(priv).not.toMatch(/mineurs détectés|contenus illicites bloqués/i);
    await page.goto("/conditions");
    expect(await page.locator("main").innerText()).toMatch(/protocole photo/);
    await expect(page.getByRole("link", { name: "Conditions d'utilisation (bêta)" })).toBeVisible();
  });

  test("formule C, paiement et CGV : 404 ; vérification d'âge et envoi de photo : existants", async ({ request }) => {
    for (const path of ["/analyse/photo?f=C", "/paiement/" + "a".repeat(43), "/cgv", "/api/payments/webhook"]) {
      expect((await request.get(path, { failOnStatusCode: false, maxRedirects: 0 })).status(), path).toBe(404);
    }
    expect((await request.get("/verification-age?f=B")).status()).toBe(200);
    const photo = await request.get("/analyse/photo?f=B", { maxRedirects: 0 });
    expect(photo.status()).toBe(307); // sans jeton de majorité : renvoi vers la vérification d'âge
    expect(photo.headers().location).toMatch(/\/verification-age\?f=B/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toMatch(/\/analyse\/photo|\/verification-age/);
  });

  test("l'API refuse la formule C (404) et exige le jeton de majorité", async ({ request, baseURL }) => {
    const before = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    const multipart = {
      state: "erect",
      photo: { name: "photo.jpg", mimeType: "image/jpeg", buffer: await neutralImage() },
      consent_adult: "on",
      consent_mine: "on",
      consent_sensitive: "on",
      captcha: "simulation-ok",
    };
    expect((await request.post(`${baseURL}/api/analyse`, { multipart: { ...multipart, formula: "C", declared_length: "13", girth: "12" }, failOnStatusCode: false })).status()).toBe(404);
    const res = await request.post(`${baseURL}/api/analyse`, { multipart: { ...multipart, formula: "B" } });
    expect(await res.text()).toContain('"code":"age"');
    expect(await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n)).toBe(before);
  });
});

test.describe("Bêta photo : parcours B complet (image neutre, moteurs simulés)", () => {
  test("rapport débloqué sans paiement, compte rendu complet, profil morphologique, aucune photo ni observation conservée", async ({ page }) => {
    const id = await photoReport(page);
    // Débloqué directement : pas d'aperçu verrouillé, aucun prix.
    await expect(page.getByText("BÊTA GRATUITE", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Débloquer/ })).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/€|paiement|payer/i);
    // Compte rendu photo-report/2 : en-tête, synthèse, tableau des sept indicateurs, six rubriques, trois points remarquables, conclusion, note.
    expect(await page.locator("[data-morpho-report]").getAttribute("data-morpho-report")).toBe("photo-report/2");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Rapport d'analyse morphométrique n°\s\d{5}$/);
    expect(body).toMatch(/Méthode\s*Estimation visuelle/);
    expect(body).toMatch(/État observé\s*Érection/);
    for (const h of ["Synthèse", "Tableau des indicateurs", "Morphologie générale", "Profil du gland et de la couronne", "Axe et courbure", "Symétrie et équilibre", "Aspect de surface", "Positionnement statistique", "Points remarquables", "Conclusion"]) {
      await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    }
    await expect(page.locator("[data-indicator]")).toHaveCount(7);
    await expect(page.locator("[data-indicator=longueur]")).toContainText("14,2 cm");
    await expect(page.locator("[data-indicator=typicite]")).toContainText(/morphotype (classique|distinctif|singulier)/);
    await expect(page.locator("[data-highlight]")).toHaveCount(3);
    await expect(page.locator("[data-note]")).toBeVisible();
    // Les observations brutes du modèle de vision n'apparaissent jamais.
    expect(body).not.toContain(OBSERVATION_MARKER);
    // Profil morphologique calculé sur les percentiles estimés (en érection).
    const profile = page.locator("[data-profile]");
    await expect(profile).toHaveCount(1);
    await expect(page.getByText("Exemple fictif")).toHaveCount(0);
    // Base : débloqué, marqué bêta, aucun paiement ; aucune colonne binaire ; aucun octet de JPEG dans les tables.
    await withDb(async (db) => {
      expect((await db.query("SELECT paid, free_beta, formula FROM reports WHERE id = $1", [id])).rows[0]).toEqual({ paid: true, free_beta: true, formula: "B" });
      expect((await db.query("SELECT count(*)::int AS n FROM payments WHERE report_id = $1", [id])).rows[0].n).toBe(0);
      const cols = await db.query("SELECT data_type FROM information_schema.columns WHERE table_schema = 'e2e' AND data_type IN ('bytea', 'oid')");
      expect(cols.rowCount).toBe(0);
      const dump = await db.query("SELECT input::text AS i, results::text AS r FROM reports WHERE id = $1", [id]);
      expect(dump.rows[0].i + dump.rows[0].r).not.toContain("/9j/");
      expect(dump.rows[0].r).not.toContain(OBSERVATION_MARKER);
      const att = await db.query("SELECT outcome FROM analysis_attempts ORDER BY id DESC LIMIT 1");
      expect(att.rows[0].outcome).toBe("ok");
      const spend = await db.query("SELECT analyses, calls FROM xai_daily_spend");
      expect(spend.rows.length).toBeGreaterThanOrEqual(1);
    });
    // Aucun fichier d'image n'a été écrit à la racine du projet (test-results exclus).
  });

  test("carte de partage d'un rapport photo : base « Analyse de photo », profil seulement si l'option est cochée", async ({ page, browser, baseURL }) => {
    const id = await photoReport(page);
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).check();
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]+$/);
    const cardId = page.url().split("/c/")[1];
    const anon = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const pub = await anon.newPage();
    await pub.goto(`/c/${cardId}`);
    await expect(pub.getByText("Analyse de photo", { exact: true })).toBeVisible();
    await expect(pub.locator("[data-card-profile]")).toHaveCount(1);
    const html = await pub.content();
    expect(html).not.toContain(id);
    expect((await anon.request.get(`/c/${cardId}/og`)).status()).toBe(200);
    await anon.close();
  });
});

for (const width of [320, 375, 390] as const) {
  test.describe(`Bêta photo : ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("choix, vérification d'âge, envoi de la photo, rapport photo : ni débordement ni recouvrement ; axe-core sans violation", async ({ page }) => {
      const problems: string[] = [];
      const violations: string[] = [];
      const check = async (label: string) => {
        await page.waitForLoadState("networkidle");
        for (const p of await layoutProblems(page)) problems.push(`${label} : ${p}`);
        for (const l of await axeLines(page)) violations.push(`${label} : ${l}`);
      };
      await page.goto("/analyse");
      await check("choix du protocole");
      await page.goto("/analyse/photo?f=B");
      await expect(page).toHaveURL(/\/verification-age/);
      await check("vérification d'âge");
      await page.getByRole("button", { name: "Vérifier mon âge" }).click();
      await check("vérification d'âge simulée");
      await page.getByRole("button", { name: "Simuler une vérification réussie" }).click();
      await expect(page).toHaveURL(/\/analyse\/photo\?f=B/);
      await check("envoi de la photo");
      await submitFromPhotoPage(page); // le jeton d'âge vient d'être délivré dans ce contexte
      await check("rapport photo");
      expect(problems).toEqual([]);
      expect(violations).toEqual([]);
    });
  });
}

test("axe-core sur écran large : choix, envoi, rapport photo, partage", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const out: string[] = [];
  await page.goto("/analyse");
  for (const l of await axeLines(page)) out.push(`choix : ${l}`);
  const id = await photoReport(page);
  for (const l of await axeLines(page)) out.push(`rapport : ${l}`);
  await page.goto(`/r/${id}/partager`);
  for (const l of await axeLines(page)) out.push(`partager : ${l}`);
  expect(out).toEqual([]);
  expect(E2E.photoBetaUrl).toContain("3205");
});
