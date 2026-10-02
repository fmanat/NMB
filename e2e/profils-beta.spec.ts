import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import { PROFILES, profileById } from "../src/lib/profiles";
import { expect, fakeIp, reportIdFrom, test, withDb } from "./helpers";
import { layoutProblems } from "./layout";

// Profils morphologiques (grille 3 × 3), copie du site en bêta gratuite (port 3204) : le rapport affiche le profil attendu, la carte de partage
// ne le montre que si l'option est cochée, la page méthode liste les neuf profils ; petits écrans et axe-core.
// Valeurs au repos (état par défaut du questionnaire) : longueur de référence 9,16 cm, circonférence 9,31 cm.
// Les noms sont écrits en dur ici : un renommage accidentel doit faire échouer le test.

const CASES = [
  { length: "7,0", girth: "8,0", id: "l1c1", name: "L'Épuré" },
  { length: "7,0", girth: "9,3", id: "l1c2", name: "Le Compact" },
  { length: "7,0", girth: "11,0", id: "l1c3", name: "Le Concentré" },
  { length: "9,2", girth: "8,0", id: "l2c1", name: "L'Élancé" },
  { length: "9,2", girth: "9,3", id: "l2c2", name: "Le Centré" },
  { length: "9,2", girth: "11,0", id: "l2c3", name: "L'Ample" },
  { length: "11,0", girth: "8,0", id: "l3c1", name: "Le Longiligne" },
  { length: "11,0", girth: "9,3", id: "l3c2", name: "L'Étendu" },
  { length: "11,0", girth: "11,0", id: "l3c3", name: "Le Panoramique" },
] as const;
const ALL_NAMES = CASES.map((c) => c.name);

/** Rapport de la bêta (valeurs au repos), avec une adresse IP différente à chaque appel (limite de 5 analyses par 24 h et par adresse). */
async function betaReport(page: Page, length: string, girth: string): Promise<string> {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": fakeIp() });
  await page.goto("/analyse/questionnaire");
  await page.getByLabel("Longueur (cm)").fill(length);
  await page.getByLabel("Circonférence (cm)").fill(girth);
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel(/Je consens au traitement des valeurs que je saisis/).check();
  await page.getByRole("button", { name: "Calculer mon rapport" }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
  return reportIdFrom(page.url());
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
async function axeLines(page: Page): Promise<string[]> {
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(/.+/); // Next.js diffuse le titre en flux : il peut arriver un instant après le contenu
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return res.violations.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} élément(s), ex. ${v.nodes[0]?.target.join(" ")}`);
}

test.describe("Profils : le rapport affiche le profil attendu", () => {
  test("les neuf couples de valeurs donnent les neuf profils (nom, phrase, case de la grille)", async ({ page }) => {
    for (const c of CASES) {
      await betaReport(page, c.length, c.girth);
      const card = page.locator(`[data-profile="${c.id}"]`);
      await expect(card, `${c.length} × ${c.girth}`).toBeVisible();
      await expect(card.getByRole("heading", { level: 2, name: c.name })).toBeVisible();
      await expect(card.getByText(profileById(c.id)!.description, { exact: true })).toBeVisible();
      await expect(card.getByText("Profil morphologique", { exact: true })).toBeVisible();
      await expect(card.getByText("Exemple fictif")).toHaveCount(0); // un vrai rapport n'est pas un exemple
      // Un seul profil à la fois, et pas les huit autres.
      await expect(page.locator("[data-profile]")).toHaveCount(1);
      for (const other of ALL_NAMES.filter((n) => n !== c.name)) await expect(page.getByRole("heading", { name: other })).toHaveCount(0);
      // Le repère de la grille est décoratif : caché des lecteurs d'écran.
      await expect(card.locator("[data-profile-mark]")).toHaveAttribute("aria-hidden", "true");
      // La phrase ne contient aucun chiffre.
      expect(profileById(c.id)!.description).not.toMatch(/\d/);
    }
  });

  test("valeurs voisines de la médiane : la case centrale, avec les percentiles affichés", async ({ page }) => {
    // Repos, longueur 9,16 cm = médiane (percentile 50), circonférence 9,31 cm = médiane : case centrale.
    await betaReport(page, "9,2", "9,3");
    await expect(page.locator('[data-profile="l2c2"]')).toBeVisible();
    await expect(page.getByText("Au-dessus de 51 % de la population de référence").first()).toBeVisible();
  });
});

test.describe("Profils : accueil et carte de partage", () => {
  test("le rapport d'exemple de l'accueil montre un profil, marqué exemple", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#exemple [data-profile]");
    await expect(card).toHaveCount(1);
    await expect(card.getByRole("heading", { level: 2, name: "Le Centré" })).toBeVisible();
    await expect(card.getByText("Exemple fictif")).toBeVisible();
  });

  test("carte de partage : profil seulement si l'option est cochée (désactivée par défaut), et le choix ne fuit pas", async ({ page, browser, baseURL }) => {
    const id = await betaReport(page, "11,0", "11,0"); // Le Panoramique
    await page.goto(`/r/${id}/partager`);
    const box = page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" });
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
    await expect(page.getByText(/Désactivé par défaut/)).toBeVisible();

    const anon = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const pub = await anon.newPage();
    const create = async (withProfile: boolean) => {
      await page.goto(`/r/${id}/partager`);
      if (withProfile) await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).check();
      await page.getByRole("button", { name: "Créer la carte" }).click();
      await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]+$/);
      return page.url().split("/c/")[1];
    };

    // Deux cartes sans l'option (case non cochée, puis case cochée puis décochée) : aucune trace du profil, images identiques.
    const plainA = await create(false);
    await page.goto(`/r/${id}/partager`);
    await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).check();
    await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).uncheck();
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]+$/);
    const plainB = page.url().split("/c/")[1];
    const withProfile = await create(true);

    for (const cid of [plainA, plainB]) {
      await pub.goto(`/c/${cid}`);
      await expect(pub.getByText(/RAPPORT CLINIQUE N°/)).toBeVisible();
      const html = await pub.content();
      expect(html).not.toContain("data-card-profile");
      for (const n of ALL_NAMES) expect(html.replace(/&#x27;/g, "'"), `carte sans option : ${n}`).not.toContain(n);
      await expect(pub.getByText("Profil", { exact: true })).toHaveCount(0);
    }

    // Carte avec l'option : le nom (pas la description) apparaît sur la page publique ; jamais dans les métadonnées de partage.
    await pub.goto(`/c/${withProfile}`);
    const li = pub.locator("[data-card-profile]");
    await expect(li).toHaveCount(1);
    await expect(li).toContainText("Profil");
    await expect(li).toContainText("Le Panoramique");
    const html = (await pub.content()).replace(/&#x27;/g, "'");
    expect(html).not.toContain(profileById("l3c3")!.description.replace(/'/g, "&#x27;"));
    const meta = await pub.locator('head meta[name="description"], head meta[property="og:description"], head meta[property="og:title"], head title').evaluateAll((els) => els.map((e) => e.getAttribute("content") ?? e.textContent ?? "").join(" | "));
    for (const n of ALL_NAMES) expect(meta).not.toContain(n);

    // Images : la carte sans option est identique d'une création à l'autre ; avec l'option, l'image change (une ligne de plus), à la bonne taille.
    for (const [kind, w, h] of [["og", 1200, 630], ["story", 1080, 1920]] as const) {
      const a = Buffer.from(await (await anon.request.get(`/c/${plainA}/${kind}`)).body());
      const b = Buffer.from(await (await anon.request.get(`/c/${plainB}/${kind}`)).body());
      const c = Buffer.from(await (await anon.request.get(`/c/${withProfile}/${kind}`)).body());
      expect(a.equals(b), `${kind} : deux cartes sans option`).toBe(true);
      expect(a.equals(c), `${kind} : avec option`).toBe(false);
      const meta = await sharp(c).metadata();
      expect([meta.width, meta.height]).toEqual([w, h]);
    }

    // « Mes cartes » : seule la carte choisie mentionne le profil.
    await page.goto(`/r/${id}/partager`);
    await expect(page.getByRole("link", { name: /profil Le Panoramique/ })).toHaveCount(1);
    await anon.close();
  });

  test("cartes plus anciennes (sans le champ) et identifiants inconnus : la page publique reste lisible, sans profil", async ({ page, browser, baseURL }) => {
    const id = await betaReport(page, "9,2", "9,3");
    const old = "ancienne-carte-" + Math.random().toString(36).slice(2, 10);
    const unknown = "inconnu-carte---" + Math.random().toString(36).slice(2, 10);
    await withDb(async (c) => {
      await c.query("INSERT INTO cards (id, report_id, content) VALUES ($1, $2, $3)", [old, id, { dossier: 4321, score: 70, basis: "declared", percentiles: [], landmark: null }]);
      await c.query("INSERT INTO cards (id, report_id, content) VALUES ($1, $2, $3)", [unknown, id, { dossier: 4322, score: 71, basis: "declared", percentiles: [], landmark: null, profile: "l9c9" }]);
    });
    const anon = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const pub = await anon.newPage();
    for (const cid of [old, unknown]) {
      await pub.goto(`/c/${cid}`);
      await expect(pub.getByText(/RAPPORT CLINIQUE N°/)).toBeVisible();
      await expect(pub.locator("[data-card-profile]")).toHaveCount(0);
      expect((await anon.request.get(`/c/${cid}/og`)).status()).toBe(200);
      expect((await anon.request.get(`/c/${cid}/story`)).status()).toBe(200);
    }
    await anon.close();
    await page.goto(`/r/${id}/partager`);
    await expect(page.getByRole("link", { name: /Carte n° 4321/ })).toBeVisible();
  });
});

test.describe("Profils : page méthode", () => {
  test("écran large : tableau accessible avec les neuf profils, les seuils expliqués", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/methode");
    const section = page.locator("h2#profils");
    await expect(section).toHaveText("Profils morphologiques");
    const table = page.locator("[data-profile-table] table");
    await expect(table).toBeVisible();
    await expect(table.locator("caption")).toHaveCount(1);
    await expect(table.getByRole("columnheader")).toHaveCount(4); // coin masqué + trois colonnes de circonférence
    await expect(table.getByRole("rowheader")).toHaveCount(3);
    await expect(table.locator("[data-profile-item]")).toHaveCount(9);
    for (const p of PROFILES) {
      const cell = table.locator(`[data-profile-item="${p.id}"]`);
      await expect(cell).toBeVisible();
      await expect(cell).toContainText(p.name);
      await expect(cell).toContainText(p.description);
    }
    // Les noms attendus (en dur) figurent tous dans la page.
    for (const n of ALL_NAMES) await expect(table.getByText(n, { exact: true })).toHaveCount(1);
    // Les seuils sont expliqués.
    const text = page.getByText(/Le seuil bas est 33 et le seuil haut est 67/);
    await expect(text).toBeVisible();
    await expect(table.getByRole("rowheader").first()).toContainText("inférieur à 33");
    await expect(page.getByText(/aucune case n.est meilleure ou moins bonne/)).toBeVisible();
    // La liste mobile n'est pas affichée en même temps.
    await expect(page.locator("[data-profile-list]")).toBeHidden();
  });

  test("mobile : liste des neuf profils (le tableau est remplacé)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/methode");
    await expect(page.locator("[data-profile-table]")).toBeHidden();
    const list = page.locator("[data-profile-list]");
    await expect(list.locator("[data-profile-item]")).toHaveCount(9);
    for (const p of PROFILES) await expect(list.locator(`[data-profile-item="${p.id}"]`)).toContainText(p.name);
    await expect(list.getByRole("heading", { level: 3 })).toHaveCount(3);
  });
});

for (const width of [320, 375, 390] as const) {
  test.describe(`Profils : ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("méthode, rapport, partage, carte avec profil : ni débordement, ni recouvrement ; axe-core sans violation", async ({ page }) => {
      const problems: string[] = [];
      const violations: string[] = [];
      const check = async (label: string) => {
        await page.waitForLoadState("networkidle");
        for (const p of await layoutProblems(page)) problems.push(`${label} : ${p}`);
        for (const l of await axeLines(page)) violations.push(`${label} : ${l}`);
      };
      await page.goto("/methode");
      await check("méthode");
      await page.goto("/");
      await check("accueil");
      for (const c of [CASES[8], CASES[0]]) {
        const id = await betaReport(page, c.length, c.girth);
        await check(`rapport ${c.name}`);
        await page.goto(`/r/${id}/partager`);
        await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).check();
        await check("partager (case cochée)");
        await page.getByRole("button", { name: "Créer la carte" }).click();
        await expect(page).toHaveURL(/\/c\//);
        await expect(page.locator("[data-card-profile]")).toContainText(c.name);
        await check(`carte avec profil ${c.name}`);
        await page.goto(`/r/${id}/partager`);
        await check("partager (avec carte)");
      }
      expect(problems).toEqual([]);
      expect(violations).toEqual([]);
    });
  });
}

test("axe-core sur écran large : méthode, rapport, partage, carte avec profil", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const out: string[] = [];
  await page.goto("/methode");
  for (const l of await axeLines(page)) out.push(`méthode : ${l}`);
  const id = await betaReport(page, "9,2", "9,3");
  for (const l of await axeLines(page)) out.push(`rapport : ${l}`);
  await page.goto(`/r/${id}/partager`);
  await page.getByRole("checkbox", { name: "Ajouter mon profil morphologique" }).check();
  for (const l of await axeLines(page)) out.push(`partager : ${l}`);
  await page.getByRole("button", { name: "Créer la carte" }).click();
  await expect(page).toHaveURL(/\/c\//);
  for (const l of await axeLines(page)) out.push(`carte : ${l}`);
  expect(out).toEqual([]);
});
