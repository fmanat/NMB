import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";
import { layoutProblems } from "./layout";

// Animations d'apparition (anneau, barres, courbes) : valeur finale exacte, une seule lecture, mouvement réduit, sans JavaScript, 320/375/390 px.

const example = (page: Page) => page.locator("#exemple");
const ringRoot = (page: Page) => example(page).locator("[data-reveal-on-view]").filter({ has: page.locator("circle.anim-ring") }).first();

/** Animations CSS en cours sous l'élément (hors transitions). */
const running = (page: Page, selector: string) =>
  page.evaluate(
    (sel) => document.querySelectorAll(sel).length && [...document.querySelectorAll(sel)].flatMap((e) => e.getAnimations({ subtree: true })).filter((a) => a instanceof CSSAnimation && a.playState === "running").length,
    selector,
  );

async function finalValues(page: Page) {
  return page.evaluate(() => {
    const ring = document.querySelector<SVGCircleElement>("#exemple circle.anim-ring")!;
    const cs = getComputedStyle(ring);
    const r = 78;
    const [dash] = ring.getAttribute("stroke-dasharray")!.split(" ").map(Number);
    const bars = [...document.querySelectorAll<HTMLElement>("#exemple .anim-bar")].map((b) => ({ w: b.style.width, t: getComputedStyle(b).transform }));
    const lines = [...document.querySelectorAll<SVGElement>("#exemple .anim-line")].map((l) => getComputedStyle(l).strokeDashoffset);
    return { offset: cs.strokeDashoffset, dash, circ: 2 * Math.PI * r, bars, lines, label: document.querySelector("#exemple [role=img][aria-label^='Score global']")!.getAttribute("aria-label") };
  });
}

test.describe("Animations d'apparition", () => {
  test("l'animation joue à l'apparition puis la valeur finale est exacte (état terminé)", async ({ page }) => {
    await page.goto("/");
    const root = ringRoot(page);
    await expect(root).toHaveAttribute("data-reveal", "pending");
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute("data-animated", "done", { timeout: 5000 });
    // Chaque élément animé de l'exemple joue à son tour quand il entre à l'écran.
    const n = await example(page).locator("[data-reveal-on-view]").count();
    for (let i = 0; i < n; i++) {
      const el = example(page).locator("[data-reveal-on-view]").nth(i);
      await el.scrollIntoViewIfNeeded();
      await expect(el).toHaveAttribute("data-animated", "done", { timeout: 5000 });
    }
    const v = await finalValues(page);
    expect(v.offset).toBe("0px");
    expect(v.dash).toBeGreaterThan(0);
    expect(v.dash).toBeLessThanOrEqual(v.circ);
    for (const b of v.bars) expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(b.t);
    for (const l of v.lines) expect(l).toBe("0px");
    await expect(root).toHaveAttribute("aria-label", v.label!);
    await expect(root).toContainText(/^\d+\s*\/ 100$/);
  });

  test("une seule exécution : revenir sur l'élément ne relance rien", async ({ page }) => {
    await page.goto("/");
    const root = ringRoot(page);
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute("data-animated", "done", { timeout: 5000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await root.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    expect(await running(page, "#exemple [data-reveal-on-view]")).toBe(0);
    await expect(root).toHaveAttribute("data-reveal", "run");
  });

  test("mouvement réduit : valeur finale immédiate, aucune animation CSS", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const root = ringRoot(page);
    await root.scrollIntoViewIfNeeded();
    await expect(root).not.toHaveAttribute("data-reveal", /.+/);
    const all = await page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation && /^bm-/.test((a as CSSAnimation).animationName)).length);
    expect(all).toBe(0);
    const v = await finalValues(page);
    expect(v.offset).toBe("0px");
    for (const l of v.lines) expect(l).toBe("0px");
    const op = await page.evaluate(() => [...document.querySelectorAll("#exemple .anim-marker, #exemple .anim-fade")].map((e) => getComputedStyle(e).opacity));
    expect(op.length).toBeGreaterThan(0);
    for (const o of op) expect(o).toBe("1");
  });

  test("sans JavaScript : valeurs finales présentes", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await ctx.newPage();
    await page.goto("/");
    const v = await finalValues(page);
    expect(v.offset).toBe("0px");
    expect(v.dash).toBeGreaterThan(0);
    for (const b of v.bars) expect(b.w).toMatch(/%$/);
    expect(await page.evaluate(() => document.querySelectorAll("[data-reveal]").length)).toBe(0);
    const op = await page.evaluate(() => [...document.querySelectorAll("#exemple .anim-marker, #exemple .anim-fade")].map((e) => getComputedStyle(e).opacity));
    for (const o of op) expect(o).toBe("1");
    await ctx.close();
  });

  test("simulation « Essayez » : bouger un curseur ne rejoue pas l'animation d'apparition", async ({ page }) => {
    await page.goto("/");
    const s = page.locator("#essayez");
    await s.scrollIntoViewIfNeeded();
    const slider = s.getByRole("slider", { name: "Longueur (cm)" });
    await expect(slider).toBeVisible();
    await page.waitForFunction(() => ![...document.querySelectorAll("#essayez *")].flatMap((e) => e.getAnimations()).some((a) => a instanceof CSSAnimation && a.playState === "running"), null, { timeout: 5000 });
    await slider.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    const n = await page.evaluate(() => [...document.querySelectorAll("#essayez *")].flatMap((e) => e.getAnimations()).filter((a) => a instanceof CSSAnimation).length);
    expect(n).toBe(0);
    await expect(s.getByRole("img", { name: /^Percentile de longueur : / })).toBeVisible();
  });

  for (const w of [320, 375, 390]) {
    test(`${w} px : pas de débordement ni pendant ni après l'animation, axe-core`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto("/");
      const root = ringRoot(page);
      await root.scrollIntoViewIfNeeded();
      expect(await layoutProblems(page)).toEqual([]);
      await expect(root).toHaveAttribute("data-animated", "done", { timeout: 5000 });
      expect(await layoutProblems(page)).toEqual([]);
      const res = await new AxeBuilder({ page }).include("#exemple").analyze();
      expect(res.violations).toEqual([]);
    });
  }
});
