import { OUT_OF_RANGE_MESSAGE } from "../src/lib/reportCore";
import { alertOf, createReportA, expect, fillQuestionnaire, payReport, signedWebhook, test, withDb } from "./helpers";

test.describe("Formule A (questionnaire)", () => {
  test("parcours complet : calcul, aperçu verrouillé, paiement simulé, rapport, suppression", async ({ page, request, baseURL }) => {
    const id = await createReportA(page, { length: "14,2", girth: "12,1" });
    expect(id.length).toBeGreaterThanOrEqual(32);

    // Aperçu verrouillé : rien de ce qui est payant n'est présent dans le HTML reçu par le navigateur.
    await expect(page.getByRole("heading", { name: "Votre rapport est prêt" })).toBeVisible();
    // Liste de ce que l'on débloque (plus de cases « 00 » floutées) ; ni résultat en grand, ni boutons de partage tant que c'est verrouillé.
    await expect(page.locator("[data-locked-contents] li")).toHaveCount(5);
    await expect(page.locator("[data-result-hero]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Partager mon résultat" })).toHaveCount(0);
    const html = await (await request.get(`${baseURL}/r/${id}`)).text();
    for (const secret of ["14,2", "12,1", "Rapport morphologique", "Votre résultat est prêt", "Commentaire simulé", "Dossier "]) {
      expect(html, `le HTML du rapport verrouillé ne doit pas contenir « ${secret} »`).not.toContain(secret);
    }
    // Image de partage neutre sur la page privée.
    expect(html).toContain("/og/neutre");
    expect(html).toMatch(/noindex/);

    await payReport(page);
    // Résultat débloqué : le percentile en grand, puis les actions de partage et de défi (liens), sans offre photo (formule photo absente ici).
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Votre résultat est prêt.");
    await expect(page.locator("[data-result-hero]")).toBeVisible();
    await expect(page.getByRole("link", { name: "Partager mon résultat" }).first()).toHaveAttribute("href", `/r/${id}/partager`);
    await expect(page.getByRole("link", { name: "Défier un ami" }).first()).toHaveAttribute("href", `/r/${id}/defi`);
    await expect(page.locator("[data-photo-offer]")).toHaveCount(0);
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

  test("refus : case 18 ans absente (serveur) ; valeurs hors plafond, hors plage, absurdes ou vides (écran des dimensions)", async ({ page }) => {
    await fillQuestionnaire(page, { adult: false });
    await expect(alertOf(page)).toContainText("18 ans");
    await expect(page).toHaveURL(/\/analyse\/questionnaire/);

    // Les dimensions sont contrôlées dès l'écran 2 (mêmes règles que le serveur) : on n'avance pas et l'erreur s'affiche sous le champ.
    const stuckOnDimensions = async (o: { length: string; girth: string }, message: string | RegExp) => {
      await page.goto("/analyse/questionnaire");
      await page.getByRole("radio", { name: "Au repos" }).check();
      await page.getByLabel("Longueur (cm)", { exact: true }).fill(o.length);
      await page.getByLabel("Circonférence (cm)", { exact: true }).fill(o.girth);
      await page.getByRole("button", { name: "Continuer" }).click();
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByLabel("Longueur (cm)", { exact: true })).toBeVisible(); // toujours sur l'écran des dimensions
      await expect(page.getByLabel("J'ai 18 ans ou plus.")).toBeHidden();
      await expect(page).toHaveURL(/\/analyse\/questionnaire/);
    };
    await stuckOnDimensions({ length: "40", girth: "12" }, /Vérifiez la longueur/);
    await stuckOnDimensions({ length: "25", girth: "12" }, OUT_OF_RANGE_MESSAGE);
    await stuckOnDimensions({ length: "13", girth: "abc" }, /Vérifiez la circonférence/);
    await stuckOnDimensions({ length: "", girth: "12" }, "Indiquez la longueur en centimètres.");
  });

  test("l'état n'est pas présélectionné : une seule question par écran, le premier écran est celui de l'état", async ({ page }) => {
    await page.goto("/analyse/questionnaire");
    await expect(page.getByRole("radio", { name: "En érection" })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Au repos" })).not.toBeChecked();
    await expect(page.getByLabel("Longueur (cm)", { exact: true })).toBeHidden();
  });

  test.describe("sans JavaScript : le formulaire classique, validé par le serveur", () => {
    test.use({ javaScriptEnabled: false });
    test("tous les écrans sont visibles ; valeurs absurdes refusées par le serveur, valeurs valides : rapport", async ({ page }) => {
      const submit = async (length: string, girth: string) => {
        await page.goto("/analyse/questionnaire");
        await page.getByRole("radio", { name: "Au repos" }).check();
        await page.getByLabel("Longueur (cm)", { exact: true }).fill(length);
        await page.getByLabel("Circonférence (cm)", { exact: true }).fill(girth);
        await page.getByLabel("J'ai 18 ans ou plus.").check();
        await page.getByRole("button", { name: "Révéler mon percentile" }).click();
      };
      await submit("40", "12");
      await expect(alertOf(page)).toBeVisible();
      await expect(page).toHaveURL(/\/analyse\/questionnaire/);
      await submit("13", "abc");
      await expect(alertOf(page)).toBeVisible();
      await submit("14,2", "12,1");
      await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
    });
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
    await expect(page.getByRole("heading", { name: "Votre résultat est prêt." })).toBeVisible();
  });
});
