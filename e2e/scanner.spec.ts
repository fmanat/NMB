import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";
import { layoutProblems } from "./layout";

// Bandeau « scanner » de l'accueil : repli statique (sans JavaScript, moteur indisponible), état animé, mouvement réduit,
// interaction au pointeur, mise en page petits écrans et accessibilité (fond sombre) dans les deux états.

const band = (page: Page) => page.getByLabel("Scanner : aperçu d'un rapport d'exemple");
const canvas = (page: Page) => band(page).locator("canvas");
const live = (page: Page) => expect(band(page)).toHaveAttribute("data-scanner", "live");

/** Contenu du canevas (image PNG encodée) : sert à savoir si le dessin change. */
const snapshot = (page: Page) => canvas(page).evaluate((c: HTMLCanvasElement) => c.toDataURL());
/** Nombre de pixels « allumés » du canevas (points, anneaux, plan) : le fond du bandeau est un bleu très sombre (canal bleu d'environ 31). */
const inked = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i - 1] > 70) n++;
    return n;
  });

async function expectExampleValues(page: Page) {
  const b = band(page);
  await expect(b.getByText("Exemple · valeurs fictives")).toBeVisible();
  await expect(b.getByText("13,8 cm")).toBeVisible();
  await expect(b.getByText("11,9 cm")).toBeVisible();
  await expect(b.getByText(/^\d+ \/ 100$/)).toBeVisible();
  await expect(b.getByText(/^Percentile \d+$/)).toHaveCount(2);
  await expect(b.getByText(/^15°$/)).toBeVisible();
}

test.describe("Bandeau scanner : repli statique", () => {
  test.describe("sans JavaScript", () => {
    test.use({ javaScriptEnabled: false });
    test("l'image fixe et les valeurs de l'exemple sont là, sans canevas visible", async ({ page }) => {
      await page.goto("/");
      await expectExampleValues(page);
      await expect(band(page)).toHaveAttribute("data-scanner", "static");
      await expect(band(page).locator("svg")).toBeVisible(); // le repli SVG (aria-hidden)
      await expect(canvas(page)).toHaveCSS("opacity", "0");
      await expect(band(page).getByText("Faites glisser pour tourner")).toBeHidden(); // indication d'interaction : seulement si le moteur tourne
    });
  });

  test("moteur indisponible : le repli reste affiché, aucune erreur de page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // Refuse le fichier du moteur (reconnu à son contenu : capture du pointeur) ; tout le reste passe.
    await page.route("**/_next/static/**/*.js*", async (route) => {
      const res = await route.fetch();
      const body = await res.text();
      if (body.includes("setPointerCapture")) return route.abort();
      return route.fulfill({ response: res, body });
    });
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(2500);
    await expect(band(page)).toHaveAttribute("data-scanner", "static");
    await expectExampleValues(page);
    await expect(canvas(page)).toHaveCSS("opacity", "0");
    expect(errors).toEqual([]);
  });

  test("chargement différé : au moment de l'événement « load », le bandeau est encore le repli statique ; le moteur arrive ensuite", async ({ page }) => {
    // (La séquence exacte des requêtes est mesurée sur le site compilé, voir docs/SESSION-NUIT-4.md ; le serveur de développement
    //  précharge des fichiers que le site compilé ne charge pas.)
    await page.addInitScript(() => {
      window.addEventListener("load", () => {
        const el = document.querySelector("[data-scanner]");
        (window as unknown as { __scannerAtLoad: string | null }).__scannerAtLoad = el?.getAttribute("data-scanner") ?? null;
      });
    });
    await page.goto("/");
    expect(await page.evaluate(() => (window as unknown as { __scannerAtLoad: string | null }).__scannerAtLoad)).toBe("static");
    await live(page);
  });
});

test.describe("Bandeau scanner : animé", () => {
  test("le canevas est décoratif, dessine des points, tourne seul, et se laisse faire tourner à la souris", async ({ page }) => {
    await page.goto("/");
    await live(page);
    await expect(canvas(page)).toHaveAttribute("aria-hidden", "true");
    await expect(band(page).getByText("Faites glisser pour tourner")).toBeVisible();
    expect(await inked(page)).toBeGreaterThan(500);
    await expectExampleValues(page);

    // Rotation et balayage automatiques : l'image change d'elle-même.
    const a = await snapshot(page);
    await page.waitForTimeout(700);
    expect(await snapshot(page)).not.toBe(a);

    // Glissement à la souris : le dessin répond (le bandeau n'empêche pas la page de défiler : touch-action pan-y).
    await expect(canvas(page)).toHaveCSS("touch-action", "pan-y");
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 8 });
    await page.mouse.up();
    expect(await inked(page)).toBeGreaterThan(500);
  });

  test("le bandeau ne gêne pas les boutons : le bouton principal garde son nom et ouvre la fenêtre d'âge", async ({ page }) => {
    await page.goto("/");
    await live(page);
    await page.getByRole("button", { name: "Démarrer mon analyse" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Bandeau scanner : mouvement réduit", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("image fixe : aucun mouvement spontané ; la souris fait tourner sans lancer d'animation", async ({ page }) => {
    await page.goto("/");
    await live(page);
    expect(await inked(page)).toBeGreaterThan(500);
    const a = await snapshot(page);
    await page.waitForTimeout(1200); // plus d'une période de balayage partielle : rien ne doit bouger
    expect(await snapshot(page)).toBe(a);

    const box = (await canvas(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 25, { steps: 8 });
    await page.mouse.up();
    const b = await snapshot(page);
    expect(b).not.toBe(a); // le glissement a fait tourner l'objet…
    await page.waitForTimeout(800);
    expect(await snapshot(page)).toBe(b); // …sans inertie ni animation continue après le relâchement
  });

  test("aucune animation CSS ni transition sur le bandeau", async ({ page }) => {
    await page.goto("/");
    await live(page);
    const moving = await band(page).evaluate((root) => {
      const out: string[] = [];
      for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
        const cs = getComputedStyle(el);
        if (cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.01) out.push(el.tagName);
        if (cs.transitionProperty !== "none" && cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0.01)) out.push(el.tagName);
      }
      return out;
    });
    expect(moving).toEqual([]);
  });
});

for (const width of [320, 375, 390] as const) {
  test.describe(`Bandeau scanner : ${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });
    test("ni débordement, ni recouvrement, ni texte coupé (repli puis animé) et pas de violation axe (fond sombre)", async ({ page }) => {
      await page.goto("/");
      await expect(band(page)).toBeVisible();
      const report: string[] = [];
      for (const p of await layoutProblems(page)) report.push(`repli : ${p}`);
      await live(page);
      for (const p of await layoutProblems(page)) report.push(`animé : ${p}`);
      expect(report).toEqual([]);
      const res = await new AxeBuilder({ page })
        .include('[aria-label="Scanner : aperçu d\'un rapport d\'exemple"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      expect(res.violations.map((v) => `${v.id} : ${v.help}`)).toEqual([]);
    });
  });
}

test.describe("Bandeau scanner : accessibilité de la page d'accueil entière", () => {
  test("axe-core sur l'accueil une fois le bandeau animé (ordinateur)", async ({ page }) => {
    await page.goto("/");
    await live(page);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    expect(res.violations.map((v) => `${v.id} : ${v.help} (${v.nodes[0]?.target.join(" ")})`)).toEqual([]);
  });
});
