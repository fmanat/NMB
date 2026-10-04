import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { REFERENCES, REFERENCE_SOURCE, TICKER } from "../src/config/site";
import { frInt, frNumber } from "../src/lib/ticker";
import { expect, test, withDb } from "./helpers";
import { layoutProblems } from "./layout";

// Bandeau défilant d'informations vraies de l'accueil. Ces tests sont partagés entre la version payante (bandeau.spec.ts, sans élément
// « Bêta gratuite ») et la bêta gratuite (bandeau-beta.spec.ts, avec). Les chiffres attendus du compteur viennent d'une requête SQL
// indépendante de l'application, jamais d'une valeur recopiée.

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const PREFIX = "e2e-bandeau-";

const region = (page: Page) => page.getByRole("region", { name: "Informations du site" });
const list = (page: Page) => page.locator('[data-ticker="list"]');
const marquee = (page: Page) => page.locator('[data-ticker="marquee"]');
const track = (page: Page) => page.locator(".ticker-track");
const item = (page: Page, id: string) => page.locator(`[data-ticker-item="${id}"]`);
const itemIds = (page: Page) => list(page).locator("[data-ticker-item]").evaluateAll((els) => els.map((e) => e.getAttribute("data-ticker-item")));

/** Nombre d'analyses réalisées (débloquées) et leur score moyen, comptés directement en base. */
async function dbStats() {
  return withDb(async (db) => {
    const r = (await db.query("SELECT count(*)::int AS n, COALESCE(avg(score), 0)::float AS avg FROM report_log WHERE free_beta OR paid_at IS NOT NULL")).rows[0];
    return { count: r.n as number, avg: r.avg as number };
  });
}
/** Complète la base jusqu'à n analyses réalisées (lignes de test à clé préfixée, retirées ensuite). */
async function seedTo(n: number) {
  const { count } = await dbStats();
  expect(count, "base de test déjà au-delà de la cible").toBeLessThanOrEqual(n);
  if (n === count) return;
  await withDb((db) =>
    db.query(
      `INSERT INTO report_log (key, formula, score, created_at, free_beta)
       SELECT $1 || md5(g::text) || md5(clock_timestamp()::text || g::text), 'A', 60 + (g % 30), now(), true FROM generate_series(1, $2::int) g`,
      [PREFIX, n - count],
    ),
  );
}
const unseed = () => withDb((db) => db.query("DELETE FROM report_log WHERE key LIKE $1", [PREFIX + "%"]));

const parisDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(d);

export function bandeauTests(beta: boolean) {
  const fixed = beta ? ["beta", "reference", "measures", "version"] : ["reference", "measures", "version"];
  const withLive = beta ? ["beta", "analyses", "score", "reference", "measures", "version"] : ["analyses", "score", "reference", "measures", "version"];

  test.describe(`Bandeau défilant (${beta ? "bêta gratuite" : "version payante"}) : contenu`, () => {
    test.afterEach(unseed);

    test("sous le seuil : éléments vrais, sans compteur ni score moyen", async ({ page }) => {
      await seedTo(TICKER.analysesThreshold);
      await page.goto("/");
      expect(await itemIds(page)).toEqual(fixed);
      await expect(item(page, "analyses")).toHaveCount(0);
      const l = list(page);
      if (beta) await expect(item(page, "beta")).toHaveText("Bêta gratuite");
      else await expect(l).not.toContainText("Bêta gratuite");
      await expect(item(page, "reference")).toHaveText(`Longueur médiane de référence, en érection ${frNumber(REFERENCES.erect.length.mean)} cm ${REFERENCE_SOURCE}`);
      await expect(item(page, "version")).toHaveText(/^Version du \d{1,2} \p{L}+ \d{4}$/u);
    });

    test("la date de version est celle du jour du démarrage du serveur de test (date de construction réelle)", async ({ page }) => {
      await page.goto("/");
      const text = (await item(page, "version").textContent())!.replace("Version du ", "");
      const now = new Date();
      expect([parisDate(now), parisDate(new Date(now.getTime() - 24 * 3600_000))]).toContain(text);
    });

    test("le nombre de mesures est celui des indicateurs du résultat d'exemple de l'accueil (longueur, circonférence, courbure, score)", async ({ page }) => {
      await page.goto("/");
      // La section « Ce que mesure le rapport » n'existe plus : les indicateurs sont les tuiles du résultat d'exemple du premier écran.
      const labels = (await page.locator("[data-result-hero]").first().locator("dl dt").allTextContents()).map((t) => t.trim().toLowerCase());
      expect(labels.length).toBeGreaterThan(0);
      await expect(item(page, "measures")).toContainText(`Indicateurs dans chaque rapport ${labels.length} (${labels.join(", ")})`);
    });

    test("aux bornes : 500 analyses = pas de compteur ; 501 = compteur et score moyen réels", async ({ page }) => {
      await seedTo(TICKER.analysesThreshold);
      await page.goto("/");
      expect(await itemIds(page)).toEqual(fixed);
      await seedTo(TICKER.analysesThreshold + 1);
      await page.goto("/");
      expect(await itemIds(page)).toEqual(withLive);
      const s = await dbStats();
      expect(s.count).toBe(TICKER.analysesThreshold + 1);
      await expect(item(page, "analyses")).toHaveText(`Analyses réalisées ${frInt(s.count)}`);
      await expect(item(page, "score")).toHaveText(`Score moyen ${frNumber(s.avg, 1)} sur 100`);
    });

    test("le compteur grandit avec la base (sans rien recopier)", async ({ page }) => {
      await seedTo(TICKER.analysesThreshold + 40);
      await page.goto("/");
      await expect(item(page, "analyses")).toHaveText(`Analyses réalisées ${frInt(TICKER.analysesThreshold + 40)}`);
      await seedTo(TICKER.analysesThreshold + 75);
      await page.goto("/");
      await expect(item(page, "analyses")).toHaveText(`Analyses réalisées ${frInt(TICKER.analysesThreshold + 75)}`);
    });

    test("rendu côté serveur : tout est dans le HTML initial, aucun appel réseau du bandeau", async ({ page }) => {
      await seedTo(TICKER.analysesThreshold + 1);
      const html = await (await page.request.get("/")).text();
      for (const t of ["Informations du site", "Longueur médiane de référence", `${frNumber(REFERENCES.erect.length.mean)} cm`, REFERENCE_SOURCE, "Version du", "Analyses réalisées"]) {
        expect(html, t).toContain(t);
      }
      if (beta) expect(html).toContain("Bêta gratuite");
      const urls: string[] = [];
      page.on("request", (r) => urls.push(new URL(r.url()).pathname));
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      expect(urls.filter((u) => /stats|ticker|bandeau/i.test(u))).toEqual([]);
    });

    test("lecteurs d'écran : une seule liste, sans doublon ; le défilement est masqué", async ({ page }) => {
      await page.goto("/");
      const n = (await itemIds(page)).length;
      await expect(region(page).getByRole("listitem")).toHaveCount(n); // les copies du défilement (aria-hidden) ne comptent pas
      await expect(marquee(page)).toHaveAttribute("aria-hidden", "true");
      expect(await marquee(page).locator(".ticker-copy").count()).toBe(2);
      expect(await marquee(page).locator(".ticker-item").count()).toBe(2 * n);
      // En mouvement normal, la liste réelle est réduite à 1 px (lecture vocale seulement) ; elle ne se voit pas en double.
      const box = (await list(page).boundingBox())!;
      expect(box.width).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.querySelectorAll('[data-ticker="list"]').length)).toBe(1);
    });
  });

  test.describe(`Bandeau défilant (${beta ? "bêta gratuite" : "version payante"}) : mouvement`, () => {
    const transformX = (page: Page) => track(page).evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
    const playState = (page: Page) => track(page).evaluate((el) => getComputedStyle(el).animationPlayState);

    test("défile seul, sobrement : mouvement continu vers la gauche, boucle sur la moitié de la piste", async ({ page }) => {
      await page.goto("/");
      await expect(marquee(page)).toBeVisible();
      expect(await track(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("bm-ticker");
      expect(await track(page).evaluate((el) => getComputedStyle(el).animationIterationCount)).toBe("infinite");
      const a = await transformX(page);
      await page.waitForTimeout(800);
      const b = await transformX(page);
      expect(b).toBeLessThan(a);
      // Deux copies de même largeur : la boucle se fait sans saut.
      const widths = await marquee(page).locator(".ticker-copy").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
      expect(Math.abs(widths[0] - widths[1])).toBeLessThan(1);
    });

    test("pause au survol, au focus clavier et par la case « Pause » ; reprise ensuite", async ({ page }) => {
      await page.goto("/");
      await expect(marquee(page)).toBeVisible();
      expect(await playState(page)).toBe("running");
      // Survol
      await region(page).hover();
      await expect.poll(() => playState(page)).toBe("paused");
      await page.mouse.move(5, 600);
      await expect.poll(() => playState(page)).toBe("running");
      // Focus clavier (la case est atteignable au clavier)
      const box = page.getByRole("checkbox", { name: "Pause" });
      await box.focus();
      await expect.poll(() => playState(page)).toBe("paused");
      await box.blur();
      await expect.poll(() => playState(page)).toBe("running");
      // Case cochée : pause maintenue même sans survol ni focus
      await box.check();
      await page.mouse.move(5, 600);
      await page.locator("h1").click({ position: { x: 2, y: 2 }, force: true });
      await expect.poll(() => playState(page)).toBe("paused");
      const x1 = await transformX(page);
      await page.waitForTimeout(500);
      expect(await transformX(page)).toBe(x1);
      await box.uncheck();
      await page.mouse.move(5, 600);
      await page.locator("h1").click({ position: { x: 2, y: 2 }, force: true });
      await expect.poll(() => playState(page)).toBe("running");
    });

    test.describe("mouvement réduit", () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
      });

      test("liste statique, lisible, sans défilement ni copie ni case Pause", async ({ page }) => {
        await page.goto("/");
        await expect(marquee(page)).toBeHidden();
        await expect(page.getByRole("checkbox", { name: "Pause" })).toBeHidden();
        expect(await track(page).count()).toBe(1); // présente dans le DOM mais cachée
        expect(await marquee(page).evaluate((el) => getComputedStyle(el).display)).toBe("none");
        expect(await track(page).evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
        expect(await itemIds(page)).toEqual(fixed);
        for (const id of fixed) await expect(item(page, id)).toBeVisible();
        const b = (await list(page).boundingBox())!;
        expect(b.width).toBeGreaterThan(200);
        expect(b.height).toBeGreaterThan(15);
        await page.waitForTimeout(700);
        expect(await list(page).boundingBox()).toEqual(b); // immobile
        // Chaque élément n'apparaît qu'une fois à l'écran.
        const visibleTexts = await page.locator(".ticker-item:visible").allTextContents();
        expect(visibleTexts.length).toBe(fixed.length);
        // Lecture vocale : la même liste, une seule fois.
        await expect(region(page).getByRole("listitem")).toHaveCount(fixed.length);
      });

      test("avec le compteur : liste complète, toujours statique", async ({ page }) => {
        await seedTo(TICKER.analysesThreshold + 1);
        try {
          await page.goto("/");
          expect(await itemIds(page)).toEqual(withLive);
          for (const id of withLive) await expect(item(page, id)).toBeVisible();
        } finally {
          await unseed();
        }
      });
    });
  });

  test.describe(`Bandeau défilant (${beta ? "bêta gratuite" : "version payante"}) : mise en page et accessibilité`, () => {
    test.afterEach(unseed);

    for (const [w, h] of [[320, 700], [375, 700], [390, 844], [1280, 800]] as const) {
      for (const reduced of [false, true]) {
        test(`${w} px${reduced ? ", mouvement réduit" : ""} : ni débordement, ni recouvrement, axe-core sans violation`, async ({ page }) => {
          await seedTo(TICKER.analysesThreshold + 1); // liste la plus longue
          await page.setViewportSize({ width: w, height: h });
          if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
          await page.goto("/");
          await page.waitForLoadState("networkidle");
          await expect(region(page)).toBeVisible();

          // Détecteur de la page entière (le défilement, aria-hidden, y est ignoré ; la liste statique, elle, est contrôlée en mouvement réduit).
          expect(await layoutProblems(page)).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);

          // Le bandeau est tout en haut de la page, dans l'écran, au-dessus du menu (barre fine : au plus 32 px plus la bordure de 1 px quand il défile).
          const band = (await region(page).boundingBox())!;
          expect(band.x).toBeGreaterThanOrEqual(0);
          expect(band.x + band.width).toBeLessThanOrEqual(w + 0.5);
          expect(band.y).toBeLessThanOrEqual(1);
          const header = (await page.locator("header.site-header").boundingBox())!;
          expect(band.y + band.height).toBeLessThanOrEqual(header.y + 1);
          if (!reduced) expect(band.height).toBeLessThanOrEqual(33);

          if (!reduced) {
            // Défilement figé à son départ : les éléments visibles ne se recouvrent pas (le détecteur ignore ce qui est aria-hidden).
            await page.addStyleTag({ content: ".ticker-track{animation:none !important}" });
            const overlaps = await page.evaluate(() => {
              const vw = window.innerWidth;
              const rects = Array.from(document.querySelectorAll('[data-ticker="marquee"] .ticker-item'))
                .map((e) => e.getBoundingClientRect())
                .filter((r) => r.right > 0 && r.left < vw);
              const out: string[] = [];
              for (let i = 0; i < rects.length; i++) {
                for (let j = i + 1; j < rects.length; j++) {
                  const ix = Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left);
                  if (ix > 1) out.push(`éléments ${i} et ${j} se recouvrent de ${Math.round(ix)}px`);
                }
              }
              return { out, n: rects.length };
            });
            expect(overlaps.n).toBeGreaterThan(0);
            expect(overlaps.out).toEqual([]);
            // Un élément ne passe jamais sous la case Pause (le défilement est rogné avant).
            const v = (await marquee(page).boundingBox())!;
            const p = (await page.getByRole("checkbox", { name: "Pause" }).boundingBox())!;
            expect(v.x + v.width).toBeLessThanOrEqual(p.x + 1);
          }

          const res = await new AxeBuilder({ page }).include('[aria-label="Informations du site"]').withTags(TAGS).analyze();
          expect(res.violations.map((x) => `${x.id} : ${x.help} (${x.nodes[0]?.target.join(" ")})`)).toEqual([]);
        });
      }
    }

    test("axe-core sur l'accueil entière avec le bandeau complet", async ({ page }) => {
      await seedTo(TICKER.analysesThreshold + 1);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(res.violations.map((x) => `${x.id} : ${x.help} (${x.nodes[0]?.target.join(" ")})`)).toEqual([]);
    });

    test("le premier écran à 390 px ne change pas : bouton principal entièrement visible", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      const cta = (await page.locator("main").getByRole("button", { name: "Découvrir mon percentile" }).first().boundingBox())!;
      expect(cta.y + cta.height).toBeLessThanOrEqual(844);
    });
  });

  test.describe(`Bandeau défilant (${beta ? "bêta gratuite" : "version payante"}) : accueil seulement`, () => {
    test("absent des autres pages, au chargement comme après un clic dans le menu ; une adresse inconnue reste une page introuvable", async ({ page, request }) => {
      await page.goto("/methode");
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(region(page)).toHaveCount(0);
      // Navigation interne depuis l'accueil (sans rechargement) : le bandeau disparaît.
      await page.goto("/");
      await expect(region(page)).toBeVisible();
      await page.locator("header.site-header").getByRole("link", { name: "Méthode" }).first().click();
      await expect(page).toHaveURL(/\/methode$/);
      await expect(region(page)).toHaveCount(0);
      // Retour à l'accueil par le logo : il revient.
      await page.locator("header.site-header").getByRole("link", { name: /accueil/ }).first().click();
      await expect(page).toHaveURL(/\/$/);
      await expect(region(page)).toBeVisible();
      // L'emplacement attrape-tout du bandeau ne transforme pas une adresse inconnue en page vide.
      expect((await request.get("/adresse-qui-n-existe-pas/vraiment")).status()).toBe(404);
      expect((await request.get("/adresse-inconnue")).status()).toBe(404);
    });
  });
}
