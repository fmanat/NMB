import sharp from "sharp";
import { alertOf, E2E, expect, neutralImage, payReport, sendPhoto, test, withDb } from "./helpers";

test.describe("Formules B et C (photo neutre, moteurs simulés)", () => {
  test("B : âge simulé, réencodage dans le navigateur, étapes, aperçu verrouillé, paiement, rapport", async ({ page }) => {
    // Grande image avec une métadonnée : le navigateur doit la réduire à 1 600 px et effacer les métadonnées avant l'envoi.
    const big = await neutralImage(3200, 2400, true);
    expect((await sharp(big).metadata()).exif).toBeDefined();

    // On capture la pièce jointe réellement envoyée par le navigateur (le corps « Blob » n'est pas lisible via les requêtes Playwright).
    await page.addInitScript(() => {
      const w = window as unknown as { __posted?: string };
      const orig = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        if (url.endsWith("/api/analyse") && init?.body instanceof FormData) {
          const file = init.body.get("photo") as File;
          const bytes = new Uint8Array(await file.arrayBuffer());
          let bin = "";
          for (const byte of bytes) bin += String.fromCharCode(byte);
          w.__posted = btoa(bin);
        }
        return orig(input, init);
      };
    });

    await sendPhoto(page, { formula: "B", image: big });
    // Étapes réellement exécutées puis rapport (verrouillé).
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Indice de confiance")).toBeVisible();
    await expect(page.getByText("Symétrie")).toBeVisible();

    const b64 = await page.evaluate(() => (window as unknown as { __posted?: string }).__posted ?? null);
    expect(b64).not.toBeNull();
    const body = Buffer.from(b64!, "base64");
    expect(body.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff])); // JPEG
    const meta = await sharp(body).metadata();
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
    expect(meta.exif).toBeUndefined();
    expect(body.includes(Buffer.from("METADONNEE-DE-TEST"))).toBe(false);

    await payReport(page);
    await expect(page.getByRole("cell", { name: /cm$/ }).first()).toBeVisible();
    await expect(page.getByText("Conicité")).toBeVisible();

    // La photo n'a laissé aucune trace en base : pas de colonne binaire, pas d'octets JPEG dans les tables.
    await withDb(async (db) => {
      const cols = await db.query("SELECT data_type FROM information_schema.columns WHERE table_schema = 'e2e' AND data_type = 'bytea'");
      expect(cols.rowCount).toBe(0);
      const dump = await db.query("SELECT input::text AS i, results::text AS r FROM reports");
      for (const row of dump.rows) {
        expect(row.i + row.r).not.toContain("/9j/"); // début d'un JPEG en base 64
        expect(row.i + row.r).not.toContain("METADONNEE-DE-TEST");
      }
    });
  });

  test("C : mesures déclarées, comparaison déclaré / estimé dans le rapport", async ({ page }) => {
    await sendPhoto(page, { formula: "C", image: await neutralImage(), declared: { length: "13,5", girth: "11,8" } });
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible({ timeout: 60_000 });
    await payReport(page);
    await expect(page.getByRole("heading", { name: "Comparaison déclaré / estimé" })).toBeVisible();
  });

  test("l'écran d'envoi est inaccessible sans vérification d'âge, et l'API refuse sans jeton ni consentements", async ({ page, request, baseURL }) => {
    await page.goto("/analyse/photo?f=B");
    await expect(page).toHaveURL(/\/verification-age/);

    // Appel direct à l'API, sans jeton de majorité : refusé, aucun rapport créé.
    const before = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    const res = await request.post(`${baseURL}/api/analyse`, {
      multipart: {
        formula: "B",
        state: "erect",
        photo: { name: "photo.jpg", mimeType: "image/jpeg", buffer: await neutralImage() },
        consent_adult: "on",
        consent_mine: "on",
        consent_sensitive: "on",
        captcha: "simulation-ok",
      },
    });
    const text = await res.text();
    expect(text).not.toContain('"type":"ready"');
    const after = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    expect(after).toBe(before);
  });

  test("un consentement manquant (envoi direct à l'API, même avec âge vérifié) est refusé", async ({ page }) => {
    await page.goto("/analyse/photo?f=B");
    await page.getByRole("button", { name: "Vérifier mon âge" }).click();
    await page.getByRole("button", { name: "Simuler une vérification réussie" }).click();
    await expect(page).toHaveURL(/\/analyse\/photo\?f=B/);
    const img = await neutralImage();
    const before = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    // La requête partage les cookies du navigateur (jeton de majorité valide) mais omet la case « Cette photo est de moi ».
    const res = await page.request.post("/api/analyse", {
      multipart: {
        formula: "B",
        state: "erect",
        photo: { name: "photo.jpg", mimeType: "image/jpeg", buffer: img },
        consent_adult: "on",
        consent_sensitive: "on",
        captcha: "simulation-ok",
      },
    });
    expect(await res.text()).not.toContain('"type":"ready"');
    const after = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    expect(after).toBe(before);
  });

  test("confiance basse : refus neutre, aucun paiement demandé, aucun rapport créé", async ({ browser, ip }) => {
    const ctx = await browser.newContext({ baseURL: E2E.lowUrl, extraHTTPHeaders: { "x-forwarded-for": ip } });
    const page = await ctx.newPage();
    const before = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    await sendPhoto(page, { formula: "B", image: await neutralImage() });
    const msg = alertOf(page);
    await expect(msg).toBeVisible({ timeout: 60_000 });
    await expect(msg).toContainText("Aucun paiement n'est demandé");
    await expect(msg).not.toContainText(/âge|mineur|majeur|18/i); // le message ne dit jamais pourquoi, et jamais « âge »
    await expect(page).toHaveURL(/\/analyse\/photo/);
    const after = await withDb(async (db) => (await db.query("SELECT count(*)::int AS n FROM reports")).rows[0].n);
    expect(after).toBe(before);
    await ctx.close();
  });
});

test.describe("Captcha à preuve de travail (ALTCHA auto-hébergé)", () => {
  test("le navigateur résout le défi, l'analyse passe ; sans jeton valide, l'API refuse", async ({ browser, ip }) => {
    const ctx = await browser.newContext({ baseURL: E2E.altchaUrl, extraHTTPHeaders: { "x-forwarded-for": ip } });
    const page = await ctx.newPage();
    await sendPhoto(page, { formula: "B", image: await neutralImage(), simulatedCaptcha: false });
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible({ timeout: 60_000 });

    // Appel direct sans solution : refus du captcha, aucun rapport.
    const res = await page.request.post("/api/analyse", {
      multipart: {
        formula: "B",
        state: "erect",
        photo: { name: "photo.jpg", mimeType: "image/jpeg", buffer: await neutralImage() },
        consent_adult: "on",
        consent_mine: "on",
        consent_sensitive: "on",
        captcha: "simulation-ok",
      },
    });
    const text = await res.text();
    expect(text).toContain('"code":"captcha"');
    expect(text).not.toContain('"type":"ready"');
    await ctx.close();
  });
});
