import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { EXAMPLE_INPUT } from "../src/lib/exampleReport";
import { aboveText, f1 } from "../src/lib/format";
import { OUT_OF_RANGE_MESSAGE, buildQuestionnaireReport } from "../src/lib/reportCore";
import { LIMITS } from "../src/config/site";
import { expect, test } from "./helpers";
import { layoutProblems } from "./layout";

// Section « Essayez » de l'accueil : curseurs, mise à jour en direct des percentiles, courbes et repères (mêmes calculs que le rapport),
// aucun réseau ni stockage, chargement différé, mouvement réduit, petits écrans et accessibilité.

const section = (page: Page) => page.locator("#essayez");
const lengthSlider = (page: Page) => section(page).getByRole("slider", { name: "Longueur (cm)" });
const girthSlider = (page: Page) => section(page).getByRole("slider", { name: "Circonférence (cm)" });

/** Fait apparaître la simulation (chargement différé : elle n'est demandée qu'à l'approche de l'écran). */
async function openTryIt(page: Page) {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(lengthSlider(page)).toBeVisible();
}

/** Rapport attendu, calculé par les fonctions du site (pas par la page). */
const real = (state: "rest" | "erect", length: number, girth: number) =>
  buildQuestionnaireReport({ state, length, girth, curvature: EXAMPLE_INPUT.curvature, direction: EXAMPLE_INPUT.direction });

/** La page affiche exactement ce que le rapport réel calcule pour ces valeurs. */
async function expectMatchesReport(page: Page, state: "rest" | "erect", length: number, girth: number) {
  const r = real(state, length, girth);
  const s = section(page);
  const st = state === "rest" ? "au repos" : "en érection";
  await expect(s.getByText(aboveText(r.length.percentile), { exact: true }).first()).toBeVisible();
  await expect(s.getByText(aboveText(r.girth.percentile), { exact: true }).first()).toBeVisible();
  await expect(s.getByRole("img", { name: `Percentile de longueur : ${f1(r.length.percentile)} sur 100` })).toBeVisible();
  await expect(s.getByRole("img", { name: `Percentile de circonférence : ${f1(r.girth.percentile)} sur 100` })).toBeVisible();
  await expect(s.getByRole("img", { name: new RegExp(`^Longueur : ${f1(length)} cm, percentile ${f1(r.length.percentile)}\\.`) })).toBeVisible();
  await expect(s.getByRole("img", { name: new RegExp(`^Circonférence : ${f1(girth)} cm, percentile ${f1(r.girth.percentile)}\\.`) })).toBeVisible();
  await expect(s.getByRole("heading", { name: `Longueur ${st}` })).toBeVisible();
  await expect(s.getByRole("heading", { name: `Circonférence ${st}` })).toBeVisible();
  for (const o of [...r.everyday, ...r.landmarks]) {
    const card = s.locator("li").filter({ hasText: o.label });
    await expect(card).toContainText(`${o.times.toLocaleString("fr-FR")}`);
    await expect(card).toContainText("× vous");
  }
}

test.describe("Essayez : contenu et mention", () => {
  test("mention de simulation locale, lien vers le vrai questionnaire, valeurs de l'exemple au départ", async ({ page }) => {
    await openTryIt(page);
    const s = section(page);
    await expect(s.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(s.getByText("Simulation locale : rien n'est enregistré ni envoyé.")).toBeVisible();
    await expect(s.getByRole("button", { name: "Remplir le vrai questionnaire" })).toBeVisible();
    await expect(s.getByText("Exemple · valeurs fictives")).toBeVisible();
    // Valeurs de départ = rapport d'exemple (13,8 cm, 11,9 cm, en érection).
    await expect(lengthSlider(page)).toHaveValue("13.8");
    await expect(girthSlider(page)).toHaveValue("11.9");
    await expect(s.getByRole("radio", { name: "En érection" })).toBeChecked();
    await expectMatchesReport(page, "erect", 13.8, 11.9);
  });

  test("les curseurs ont un libellé, la valeur lue (aria-valuetext) et les bornes du questionnaire", async ({ page }) => {
    await openTryIt(page);
    await expect(lengthSlider(page)).toHaveAttribute("min", String(LIMITS.length.min));
    await expect(lengthSlider(page)).toHaveAttribute("max", String(LIMITS.length.max));
    await expect(girthSlider(page)).toHaveAttribute("min", String(LIMITS.girth.min));
    await expect(girthSlider(page)).toHaveAttribute("max", String(LIMITS.girth.max));
    await expect(lengthSlider(page)).toHaveAttribute("aria-valuetext", "13,8 cm");
    await expect(lengthSlider(page)).toHaveAttribute("step", "0.1");
  });
});

test.describe("Essayez : mise à jour en direct", () => {
  test("au clavier, le curseur de longueur met à jour percentiles, courbe et repères comme le rapport réel", async ({ page }) => {
    await openTryIt(page);
    const before = real("erect", 13.8, 11.9);
    await lengthSlider(page).focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await expect(lengthSlider(page)).toHaveValue("14.3");
    await expect(lengthSlider(page)).toHaveAttribute("aria-valuetext", "14,3 cm");
    await expectMatchesReport(page, "erect", 14.3, 11.9);
    expect(real("erect", 14.3, 11.9).length.percentile).toBeGreaterThan(before.length.percentile);
    // Le curseur de circonférence, à son tour (flèche gauche).
    await girthSlider(page).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowLeft");
    await expect(girthSlider(page)).toHaveValue("11.5");
    await expectMatchesReport(page, "erect", 14.3, 11.5);
    // Plus d'« exemple fictif » : ce sont les valeurs de la simulation.
    await expect(section(page).getByText("Exemple · valeurs fictives")).toHaveCount(0);
    // Retour à l'exemple.
    await section(page).getByRole("button", { name: "Revenir à l'exemple" }).click();
    await expect(lengthSlider(page)).toHaveValue("13.8");
    await expectMatchesReport(page, "erect", 13.8, 11.9);
    await expect(section(page).getByText("Exemple · valeurs fictives")).toBeVisible();
  });

  test("le choix repos / érection change les références (médianes et courbes)", async ({ page }) => {
    await openTryIt(page);
    await section(page).getByRole("radio", { name: "Au repos" }).check();
    await expectMatchesReport(page, "rest", 13.8, 11.9);
    await expect(section(page).getByText(/médiane de référence 9,2 cm/).first()).toBeVisible();
    await section(page).getByRole("radio", { name: "En érection" }).check();
    await expectMatchesReport(page, "erect", 13.8, 11.9);
    await expect(section(page).getByText(/médiane de référence 13,1 cm/).first()).toBeVisible();
  });

  test("plusieurs couples de valeurs : la page et le rapport réel donnent les mêmes chiffres", async ({ page }) => {
    await openTryIt(page);
    for (const [length, girth] of [[12.5, 10.4], [15.1, 12.8], [11, 11.2]] as const) {
      await lengthSlider(page).fill(String(length));
      await girthSlider(page).fill(String(girth));
      await expectMatchesReport(page, "erect", length, girth);
    }
  });

  test("aux extrémités des curseurs : valeur hors plage refusée avec le message du questionnaire, puis retour", async ({ page }) => {
    await openTryIt(page);
    await lengthSlider(page).focus();
    await page.keyboard.press("End");
    await expect(lengthSlider(page)).toHaveValue(String(LIMITS.length.max));
    await expect(section(page).getByTestId("try-out-of-range")).toHaveText(OUT_OF_RANGE_MESSAGE);
    await expect(section(page).getByTestId("try-results")).toHaveCount(0);
    await page.keyboard.press("Home");
    await expect(lengthSlider(page)).toHaveValue(String(LIMITS.length.min));
    await expect(section(page).getByTestId("try-out-of-range")).toBeVisible();
    await section(page).getByRole("button", { name: "Revenir à l'exemple" }).click();
    await expect(section(page).getByTestId("try-results")).toBeVisible();
    await expectMatchesReport(page, "erect", 13.8, 11.9);
  });
});

test.describe("Essayez : aucune donnée ne sort, rien n'est stocké", () => {
  test("aucune requête, aucun WebSocket, aucun cookie ni stockage pendant l'interaction", async ({ page, context }) => {
    await openTryIt(page);
    await page.waitForLoadState("networkidle");
    const storageBefore = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
    const cookiesBefore = (await context.cookies()).map((c) => `${c.name}=${c.value}`).sort();
    const requests: string[] = [];
    const sockets: string[] = [];
    page.on("request", (r) => requests.push(`${r.method()} ${r.url()}`));
    page.on("websocket", (w) => sockets.push(w.url()));
    await lengthSlider(page).focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
    await girthSlider(page).fill("10.2");
    await section(page).getByRole("radio", { name: "Au repos" }).check();
    await lengthSlider(page).focus();
    await page.keyboard.press("End");
    await section(page).getByRole("button", { name: "Revenir à l'exemple" }).click();
    await page.waitForTimeout(1500); // laisse passer d'éventuels envois différés (annonce vocale, etc.)
    expect(requests).toEqual([]);
    expect(sockets).toEqual([]);
    expect(await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]))).toBe(storageBefore);
    expect((await context.cookies()).map((c) => `${c.name}=${c.value}`).sort()).toEqual(cookiesBefore);
  });
});

test.describe("Essayez : chargement différé", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("la simulation n'est pas chargée au premier affichage ; elle l'est à l'approche de la section", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(section(page).getByRole("slider")).toHaveCount(0);
    expect((await section(page).boundingBox())!.y).toBeGreaterThan(700);
    // Le bouton principal du premier écran n'est pas touché.
    const cta = page.locator("main").getByRole("button", { name: "Démarrer mon analyse" }).first();
    await expect(cta).toBeVisible();
    // Le code de la simulation (reconnu à son contenu) n'a pas été demandé ; il l'est après défilement.
    const chunks: string[] = [];
    page.on("response", async (res) => {
      if (res.url().includes("/_next/static/") && res.url().endsWith(".js")) {
        const body = await res.text().catch(() => "");
        if (body.includes("try-out-of-range")) chunks.push(res.url());
      }
    });
    await section(page).scrollIntoViewIfNeeded();
    await expect(lengthSlider(page)).toBeVisible();
    expect(chunks.length).toBeGreaterThan(0);
  });
});

test.describe("Essayez : mouvement réduit", () => {
  test("prefers-reduced-motion : aucune animation ni transition dans la section", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTryIt(page);
    await lengthSlider(page).focus();
    await page.keyboard.press("ArrowRight");
    const moving = await section(page).evaluate((root) => {
      const out: string[] = [];
      for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
        const cs = getComputedStyle(el);
        if (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.01) out.push(`anim ${el.tagName}`);
        if (cs.transitionProperty !== "none" && cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0.01)) out.push(`trans ${el.tagName}`);
      }
      return out;
    });
    expect(moving).toEqual([]);
  });
});

for (const [width, height] of [[320, 700], [375, 700], [390, 844]] as const) {
  test.describe(`Essayez : ${width} px`, () => {
    test.use({ viewport: { width, height } });
    test("le bouton principal reste dans le premier écran ; ni débordement, ni recouvrement, ni texte coupé ; axe sans violation", async ({ page }) => {
      await page.goto("/");
      const cta = page.locator("main").getByRole("button", { name: "Démarrer mon analyse" }).first();
      await expect(cta).toBeVisible();
      if (width >= 375) {
        const b = (await cta.boundingBox())!;
        expect(b.y + b.height, "le bouton principal est dans le premier écran").toBeLessThanOrEqual(height);
      }
      await section(page).scrollIntoViewIfNeeded();
      await expect(lengthSlider(page)).toBeVisible();
      const report: string[] = [];
      const check = async (label: string) => {
        for (const p of await layoutProblems(page)) report.push(`${label} : ${p}`);
        const res = await new AxeBuilder({ page }).include("#essayez").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
        for (const v of res.violations) report.push(`${label} axe : ${v.id} ${v.help}`);
      };
      await check("exemple");
      await lengthSlider(page).fill("16.8");
      await girthSlider(page).fill("14.9");
      await check("valeurs hautes");
      await section(page).getByRole("radio", { name: "Au repos" }).check();
      await check("au repos");
      await lengthSlider(page).fill("30");
      await check("hors plage");
      expect(report).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });
}

test.describe("Essayez : accessibilité de l'accueil entière", () => {
  test("axe-core sur l'accueil avec la simulation chargée (ordinateur)", async ({ page }) => {
    await openTryIt(page);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    expect(res.violations.map((v) => `${v.id} : ${v.help} (${v.nodes[0]?.target.join(" ")})`)).toEqual([]);
    // Pas de saut de niveau de titre dans la section.
    const levels = await section(page).evaluate((r) => Array.from(r.querySelectorAll("h1,h2,h3,h4")).map((h) => Number(h.tagName[1])));
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `titres ${levels.join(",")}`).toBeLessThanOrEqual(1);
  });
});
