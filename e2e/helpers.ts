import { createHmac, randomInt } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import pg from "pg";
import sharp from "sharp";
import { E2E } from "../playwright.config";

export { E2E, expect };

// Adresse IP fictive différente à chaque test : la limite de 5 analyses par 24 h ne doit pas fausser les tests.
export const fakeIp = () => `10.${randomInt(1, 250)}.${randomInt(1, 250)}.${randomInt(1, 250)}`;

export const test = base.extend<{ ip: string }>({
  // « provide » et non « use » : le nom « use » déclenche à tort la règle des hooks React.
  ip: async ({}, provide) => provide(fakeIp()),
  extraHTTPHeaders: async ({ ip }, provide) => provide({ "x-forwarded-for": ip }),
});

/** Image NEUTRE générée à la volée (dégradé, aucune personne) : jamais d'image réelle ni explicite dans le dépôt. */
export async function neutralImage(width = 1200, height = 800, withExif = false): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[i] = (x * 255) / width;
      raw[i + 1] = (y * 255) / height;
      raw[i + 2] = 160;
    }
  }
  let img = sharp(raw, { raw: { width, height, channels: 3 } });
  if (withExif) img = img.withExif({ IFD0: { Copyright: "METADONNEE-DE-TEST" } });
  return img.jpeg({ quality: 85 }).toBuffer();
}

export async function withDb<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: E2E.dbUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Notification de paiement signée comme le ferait le prestataire simulé. */
export function signedWebhook(body: object): { raw: string; signature: string } {
  const raw = JSON.stringify(body);
  return { raw, signature: createHmac("sha256", E2E.paymentSecret).update(raw).digest("hex") };
}

export function reportIdFrom(url: string): string {
  const m = url.match(/\/r\/([A-Za-z0-9_-]+)/);
  if (!m) throw new Error("Pas d'identifiant de rapport dans " + url);
  return m[1];
}

export async function fillQuestionnaire(page: Page, o: { length?: string; girth?: string; adult?: boolean } = {}) {
  await page.goto("/analyse/questionnaire");
  await page.getByLabel("Longueur (cm)").fill(o.length ?? "14,2");
  await page.getByLabel("Circonférence (cm)").fill(o.girth ?? "12,1");
  if (o.adult !== false) await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByRole("button", { name: "Calculer mon rapport" }).click();
}

/** Remplit le questionnaire valide, attend la page du rapport et renvoie son identifiant. */
export async function createReportA(page: Page, o: { length?: string; girth?: string } = {}): Promise<string> {
  await fillQuestionnaire(page, o);
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
  return reportIdFrom(page.url());
}

/** Clique « Débloquer », coche la renonciation, paie (simulation) et attend le rapport débloqué. */
export async function payReport(page: Page) {
  await page.getByRole("link", { name: /Débloquer pour/ }).click();
  await page.getByLabel(/Je demande l'accès immédiat/).check();
  await page.getByRole("button", { name: /^Payer/ }).click();
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  // Questionnaire : « Rapport morphologique » ; photo (photo-report/2) : « Rapport d'analyse morphométrique n° … ».
  await expect(page.getByRole("heading", { name: /Rapport morphologique|Rapport d'analyse morphométrique/ })).toBeVisible();
}

/** Parcours photo : vérification d'âge simulée, cases, captcha simulé, envoi d'une image neutre. */
export async function sendPhoto(page: Page, o: { formula: "B" | "C"; image: Buffer; consents?: boolean; declared?: { length: string; girth: string }; simulatedCaptcha?: boolean }) {
  await page.goto(`/analyse/photo?f=${o.formula}`);
  await expect(page).toHaveURL(/\/verification-age/);
  await page.getByRole("button", { name: "Vérifier mon âge" }).click();
  await page.getByRole("button", { name: "Simuler une vérification réussie" }).click();
  await expect(page).toHaveURL(new RegExp(String.raw`/analyse/photo\?f=${o.formula}`));
  if (o.declared) {
    await page.getByLabel("Longueur déclarée (cm)").fill(o.declared.length);
    await page.getByLabel("Circonférence déclarée (cm)").fill(o.declared.girth);
  }
  await page.locator('input[type="file"]').setInputFiles({ name: "neutre.jpg", mimeType: "image/jpeg", buffer: o.image });
  await page.getByLabel(/J'ai 18 ans ou plus, cette photo est de moi/).check();
  if (o.simulatedCaptcha !== false) await page.getByLabel(/Je ne suis pas un robot/).check();
  await page.getByRole("button", { name: "Lancer l'analyse" }).click();
}

/** Message d'alerte du formulaire (sans l'annonceur de route de Next.js, qui a aussi role="alert"). */
export const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
