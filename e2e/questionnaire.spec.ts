import { alertOf, createReportA, expect, fillQuestionnaire, payReport, signedWebhook, test, withDb } from "./helpers";

test.describe("Formule A (questionnaire)", () => {
  test("parcours complet : calcul, aperçu verrouillé, paiement simulé, rapport, suppression", async ({ page, request, baseURL }) => {
    const id = await createReportA(page, { length: "14,2", girth: "12,1" });
    expect(id.length).toBeGreaterThanOrEqual(32);

    // Aperçu verrouillé : rien de ce qui est payant n'est présent dans le HTML reçu par le navigateur.
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible();
    const html = await (await request.get(`${baseURL}/r/${id}`)).text();
    for (const secret of ["14,2", "12,1", "Rapport morphologique", "Commentaire simulé", "Dossier "]) {
      expect(html, `le HTML du rapport verrouillé ne doit pas contenir « ${secret} »`).not.toContain(secret);
    }
    // Image de partage neutre sur la page privée.
    expect(html).toContain("/og/neutre");
    expect(html).toMatch(/noindex/);

    await payReport(page);
    await expect(page.getByRole("cell", { name: "14,2 cm" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Télécharger en PDF" })).toBeVisible();
    await expect(page.getByText(/au moins 3 ans et téléchargeable en PDF/)).toBeVisible();

    // Suppression définitive.
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Supprimer mon rapport" }).click();
    const gone = await request.get(`${baseURL}/r/${id}`);
    expect(gone.status()).toBe(404);
    await withDb(async (db) => {
      expect((await db.query("SELECT 1 FROM reports WHERE id = $1", [id])).rowCount).toBe(0);
    });
  });

  test("le paiement exige la case de renonciation", async ({ page }) => {
    await fillQuestionnaire(page);
    await page.getByRole("link", { name: /Débloquer pour/ }).click();
    await page.getByRole("button", { name: /^Payer/ }).click();
    await expect(alertOf(page)).toBeVisible();
    await expect(page).toHaveURL(/\/paiement\//);
    // Aucune redirection vers le prestataire : le rapport reste verrouillé.
    const id = page.url().split("/paiement/")[1].split(/[?#]/)[0];
    await page.goto(`/r/${id}`);
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible();
  });

  test("refus : case 18 ans absente, valeurs hors plafond, valeurs absurdes", async ({ page }) => {
    await fillQuestionnaire(page, { adult: false });
    await expect(alertOf(page)).toContainText("18 ans");
    await expect(page).toHaveURL(/\/analyse\/questionnaire/);

    await fillQuestionnaire(page, { length: "40", girth: "12" });
    await expect(alertOf(page)).toBeVisible();
    await expect(page).toHaveURL(/\/analyse\/questionnaire/);

    await fillQuestionnaire(page, { length: "13", girth: "abc" });
    await expect(alertOf(page)).toBeVisible();
  });

  test("sécurité : identifiants de rapport longs, aléatoires, non devinables", async ({ page }) => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(await createReportA(page));
    }
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id.length).toBeGreaterThanOrEqual(32);
    // Un identifiant voisin ne donne rien.
    const res = await page.request.get(`/r/${ids[0].slice(0, -1)}${ids[0].endsWith("a") ? "b" : "a"}`);
    expect(res.status()).toBe(404);
  });

  test("sécurité : un retour sur la page du site ne débloque pas ; notification rejouée deux fois sans double effet", async ({ page, request, baseURL }) => {
    const id = await createReportA(page);
    await page.getByRole("link", { name: /Débloquer pour/ }).click();
    await page.getByLabel(/Je demande l'accès immédiat/).check();
    await page.getByRole("button", { name: /^Payer/ }).click();
    await expect(page).toHaveURL(/\/simulation\?ref=/);
    const ref = new URL(page.url()).searchParams.get("ref")!;

    // Revenir sur la page du rapport sans notification signée : toujours verrouillé.
    await page.goto(`/r/${id}?retour=1`);
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible();

    // Notification non signée ou mal signée : refusée.
    const payment = await withDb(async (db) => (await db.query("SELECT amount_cents, currency FROM payments WHERE provider_ref = $1", [ref])).rows[0]);
    const body = { type: "payment.succeeded", providerRef: ref, amountCents: payment.amount_cents, currency: payment.currency };
    const bad = await request.post(`${baseURL}/api/payments/webhook`, { data: JSON.stringify(body), headers: { "x-signature": "00".repeat(32) } });
    expect(bad.status()).toBe(400);
    const none = await request.post(`${baseURL}/api/payments/webhook`, { data: JSON.stringify(body) });
    expect(none.status()).toBe(400);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible();

    // Notification signée : débloque. Rejouée : aucun effet supplémentaire.
    const { raw, signature } = signedWebhook(body);
    const first = await request.post(`${baseURL}/api/payments/webhook`, { data: raw, headers: { "x-signature": signature } });
    expect(await first.json()).toMatchObject({ ok: true, alreadyConfirmed: false });
    const snapshot = () =>
      withDb(async (db) => ({
        pay: (await db.query("SELECT status, confirmed_at FROM payments WHERE report_id = $1", [id])).rows,
        rep: (await db.query("SELECT paid, paid_at FROM reports WHERE id = $1", [id])).rows,
        log: (await db.query("SELECT count(*)::int AS n, count(paid_at)::int AS paid FROM report_log WHERE key = encode(sha256($1::bytea), 'hex')", [id])).rows,
      }));
    const before = await snapshot();
    const second = await request.post(`${baseURL}/api/payments/webhook`, { data: raw, headers: { "x-signature": signature } });
    expect(await second.json()).toMatchObject({ ok: true, alreadyConfirmed: true });
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(after.pay).toHaveLength(1);
    expect(after.pay[0].status).toBe("succeeded");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Rapport morphologique" })).toBeVisible();
  });
});
