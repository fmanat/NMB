import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { E2E, expect, fakeIp, reportIdFrom, test } from "./helpers";

// Accessibilité (clavier, focus visible, lecteurs d'écran, mouvement réduit) sur la copie du site en mode bêta gratuite (port 3204).
// Contrôle automatique avec axe-core (règles WCAG 2.0, 2.1 et 2.2 niveaux A et AA, plus les bonnes pratiques) : il ne remplace pas un
// essai avec un vrai lecteur d'écran, que ce test ne peut pas faire.

async function betaReport(page: Page): Promise<string> {
  await page.goto("/analyse/questionnaire");
  await page.getByLabel("Longueur (cm)").fill("14,2");
  await page.getByLabel("Circonférence (cm)").fill("12,1");
  await page.getByLabel("J'ai 18 ans ou plus.").check();
  await page.getByLabel(/Je consens au traitement des valeurs que je saisis/).check();
  await page.getByRole("button", { name: "Calculer mon rapport" }).click();
  await page.waitForURL(/\/r\/[A-Za-z0-9_-]+/);
  return reportIdFrom(page.url());
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function scan(page: Page, label: string) {
  await page.waitForLoadState("networkidle"); // page entièrement chargée et hydratée (le serveur de développement compile à la demande)
  await expect(page).toHaveTitle(/.+/); // Next.js diffuse le titre de la page en flux : il peut arriver un instant après le contenu
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const lines = res.violations.map((v) => `${v.id} (${v.impact}) : ${v.help} — ${v.nodes.length} élément(s), ex. ${v.nodes[0]?.target.join(" ")}`);
  expect(lines, `${label} : violations axe`).toEqual([]);
}

test.describe("Accessibilité : contrôle automatique axe-core", () => {
  test("pages publiques", async ({ page }) => {
    for (const path of ["/", "/analyse/questionnaire", "/methode", "/conditions", "/confidentialite", "/mentions-legales", "/contact", "/admin/connexion"]) {
      await page.goto(path);
      await scan(page, path);
    }
  });

  test("rapport, carte, partage, défi", async ({ page, browser, baseURL }) => {
    const id = await betaReport(page);
    await scan(page, "rapport");
    await page.goto(`/r/${id}/partager`);
    await scan(page, "partager");
    await page.getByRole("button", { name: "Créer la carte" }).click();
    await expect(page).toHaveURL(/\/c\//);
    await scan(page, "carte");
    await page.goto(`/r/${id}/defi`);
    await scan(page, "défi (création)");
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    await expect(page.getByText("En attente : personne n'a encore relevé le défi.")).toBeVisible();
    await scan(page, "défi (lien créé)");
    const path = new URL(await page.locator("input[readonly]").inputValue()).pathname;
    const friend = await browser.newContext({ baseURL, httpCredentials: { username: E2E.betaUser, password: E2E.betaPassword }, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
    const fp = await friend.newPage();
    await fp.goto(path);
    await scan(fp, "invitation au défi");
    await friend.close();
  });

  test("états d'erreur (formulaire invalide, fenêtre d'âge)", async ({ page }) => {
    await page.goto("/analyse/questionnaire");
    await page.getByLabel("Longueur (cm)").fill("14,2");
    await page.getByLabel("Circonférence (cm)").fill("12,1");
    await page.getByRole("button", { name: "Calculer mon rapport" }).click();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible();
    await scan(page, "formulaire avec erreur");
    await page.goto("/");
    await page.getByRole("button", { name: "Lancer l'analyse" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Année de naissance").fill("2030");
    await page.getByLabel(/J'ai 18 ans ou plus/).check();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await scan(page, "fenêtre d'âge avec erreur");
  });
});

test.describe("Accessibilité : clavier et focus", () => {
  test("lien d'évitement : premier élément atteint par Tab, mène au contenu principal", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Aller au contenu" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible(); // visible quand il a le focus
    await page.keyboard.press("Enter");
    const inMain = await page.evaluate(() => document.activeElement?.id === "contenu" || !!document.activeElement?.closest("main"));
    expect(inMain).toBe(true);
  });

  test("la fenêtre d'âge se manipule entièrement au clavier : ouverture, focus piégé, Échap, retour du focus", async ({ page }) => {
    await page.goto("/");
    const open = page.getByRole("button", { name: "Lancer l'analyse" });
    await open.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/Contrôle d'accès/);
    // Fenêtre modale native : le reste de la page est inerte. Pendant 12 pressions de Tab, le focus ne se pose jamais sur un élément de la
    // page située derrière (il reste dans la fenêtre, ou sort vers le navigateur : document.body).
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest("dialog"))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("focus toujours visible : chaque élément atteint au clavier a un contour d'au moins 2 px, sur les pages principales", async ({ page }) => {
    const bad: string[] = [];
    for (const path of ["/", "/analyse/questionnaire", "/conditions", "/admin/connexion"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const seen = new Set<string>();
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null; // bouton de développement de Next.js, absent en production
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            key: `${el.tagName}|${el.textContent?.trim().slice(0, 30)}|${el.getAttribute("name") ?? ""}|${el.getAttribute("href") ?? ""}`,
            style: cs.outlineStyle,
            width: parseFloat(cs.outlineWidth),
            color: cs.outlineColor,
            shadow: cs.boxShadow,
            visible: r.width > 0 && r.height > 0,
          };
        });
        if (!info) continue;
        if (seen.has(info.key)) break; // un tour complet
        seen.add(info.key);
        const ok = info.style !== "none" && info.width >= 2;
        if (!ok) bad.push(`${path} : ${info.key} (contour ${info.style} ${info.width}px)`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("tous les contrôles ont un nom accessible et le champ du lien de défi est étiqueté", async ({ page }) => {
    const id = await betaReport(page);
    await page.goto(`/r/${id}/defi`);
    await page.getByRole("button", { name: "Créer mon lien de défi" }).click();
    await expect(page.getByRole("textbox", { name: /lien/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copier/ })).toBeVisible();
  });
});

test.describe("Accessibilité : structure pour lecteurs d'écran", () => {
  for (const path of ["/", "/analyse/questionnaire", "/methode", "/conditions", "/confidentialite", "/mentions-legales", "/contact"]) {
    test(`${path} : langue, un seul titre de niveau 1, repères (en-tête, contenu, pied de page), navigations nommées, titre de page`, async ({ page }) => {
      await page.goto(path);
      expect(await page.locator("html").getAttribute("lang")).toBe("fr");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      const navs = page.getByRole("navigation");
      const n = await navs.count();
      expect(n).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < n; i++) expect(await navs.nth(i).getAttribute("aria-label"), `navigation n° ${i + 1}`).toBeTruthy();
      expect((await page.title()).length).toBeGreaterThan(3);
      // Pas de saut de niveau de titre (h1 → h3 sans h2).
      const levels = await page.$$eval("h1,h2,h3,h4", (hs) => hs.map((h) => Number(h.tagName[1])));
      for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `titres ${levels.join(",")}`).toBeLessThanOrEqual(1);
    });
  }

  test("le rapport : tableaux avec en-têtes de colonne, graphiques nommés, décor masqué aux lecteurs d'écran", async ({ page }) => {
    await betaReport(page);
    const heads = page.locator("table thead th");
    expect(await heads.count()).toBeGreaterThanOrEqual(5);
    for (const th of await heads.all()) expect(await th.getAttribute("scope")).toBe("col");
    for (const svg of await page.locator("figure svg").all()) expect(await svg.getAttribute("aria-label")).toMatch(/percentile/);
    // Les jauges décoratives de l'accueil ne sont pas des images à lire.
    await page.goto("/");
    expect(await page.locator('svg[role="img"]').count()).toBe(0);
  });
});

test.describe("Accessibilité : mouvement réduit", () => {
  test("prefers-reduced-motion : aucune animation ni transition, défilement instantané", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/analyse/questionnaire"]) {
      await page.goto(path);
      const moving = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const cs = getComputedStyle(el);
          const anim = cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.01;
          const trans = cs.transitionProperty !== "none" && cs.transitionProperty !== "" && cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0.01);
          if (anim || trans) out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className?.toString().slice(0, 40)}`);
        }
        return out;
      });
      expect(moving, path).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).not.toBe("smooth");
    }
  });
});
