import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./helpers";
import { layoutProblems } from "./layout";

// Bandeau « scanner » de l'accueil : repli statique (sans JavaScript, moteur indisponible), état animé, mouvement réduit,
// interaction au pointeur, mise en page petits écrans et accessibilité (fond sombre) dans les deux états.

const band = (page: Page) => page.getByLabel("Scanner : aperçu d'un rapport d'exemple");
const canvas = (page: Page) => band(page).locator("canvas");
// Le bandeau est plus bas dans l'accueil (section « La science derrière le chiffre ») : on l'amène à l'écran, où le moteur se met à tourner.
const live = async (page: Page) => {
  await band(page).scrollIntoViewIfNeeded();
  await expect(band(page)).toHaveAttribute("data-scanner", "live");
};

/** Contenu du canevas (image PNG encodée) : sert à savoir si le dessin change. */
const snapshot = (page: Page) => canvas(page).evaluate((c: HTMLCanvasElement) => c.toDataURL());
/** Étendue (largeur, hauteur en pixels du canevas) des pixels « allumés » : sert à reconnaître la forme dessinée. */
const extent = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let x1 = -1;
    let y0 = c.height;
    let y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 2] > 70) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
  });
/** Nombre de pixels « allumés » du canevas (points, anneaux, plan) : le fond du bandeau est un bleu très sombre (canal bleu d'environ 31). */
const inked = (page: Page) =>
  canvas(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i - 1] > 70) n++;
    return n;
  });


/** État exposé par le moteur (lecture seule) : vue, position du plan de balayage et sa boîte à l'écran (pixels CSS du canevas). */
type State = { yaw: number; pitch: number; planeT: number; unit: number; width: number; height: number; plane: { x0: number; y0: number; x1: number; y1: number } };
const state = (page: Page) => canvas(page).evaluate((c) => (c as unknown as { __scannerState: () => State }).__scannerState());
/** Échantillonne l'état à chaque image pendant `ms` millisecondes. */
const sampleStates = (page: Page, ms: number) =>
  canvas(page).evaluate(
    (c, ms) =>
      new Promise<State[]>((resolve) => {
        const out: State[] = [];
        const t0 = performance.now();
        const tick = () => {
          out.push((c as unknown as { __scannerState: () => State }).__scannerState());
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else resolve(out);
        };
        tick();
      }),
    ms,
  );
/** Pixels « allumés » (canal bleu au-dessus du fond) dans la bande de `edge` pixels CSS le long du bord du canevas. */
const inkOnEdge = (page: Page, edge = 2) =>
  canvas(page).evaluate((c: HTMLCanvasElement, edge) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    const k = Math.max(1, Math.round(edge * (c.width / c.getBoundingClientRect().width)));
    let n = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        if (x >= k && x < c.width - k && y >= k && y < c.height - k) continue;
        if (d[(y * c.width + x) * 4 + 2] > 70) n++;
      }
    return n;
  }, edge);
const planeInside = (st: State) => st.plane.x0 >= 0 && st.plane.y0 >= 0 && st.plane.x1 <= st.width && st.plane.y1 <= st.height;

async function expectExampleValues(page: Page) {
  const b = band(page);
  await expect(b.getByText("Exemple · valeurs fictives")).toBeVisible();
  await expect(b.getByText("13,8 cm")).toBeVisible();
  await expect(b.getByText("11,9 cm")).toBeVisible();
  await expect(b.getByText(/^\d+ \/ 100$/)).toBeVisible();
  await expect(b.getByText(/^\d+e percentile$/)).toHaveCount(2); // rang en partie entière, comme « Au-dessus de X % »
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

  test("le repli du serveur est exactement le cylindre abstrait d'avant (jamais la silhouette), avec ou sans moteur", async ({ page, request }) => {
    const golden = readFileSync("tests/fixtures/scanner-fallback.svg", "utf8").trimEnd();
    const html = await (await request.get("/")).text();
    expect(html.match(/<svg viewBox="0 0 400 240"[\s\S]*?<\/svg>/)?.[0]).toBe(golden);
    // Après chargement du moteur, le SVG du repli est toujours là, inchangé (il s'efface seulement par transparence).
    await page.goto("/");
    await live(page);
    expect(await band(page).locator("svg").evaluate((el) => el.outerHTML.length)).toBeGreaterThan(5000);
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
    // Le moteur dessine la silhouette allongée (plus haute que large), pas le cylindre trapu du repli.
    const shape = await extent(page);
    expect(shape.h).toBeGreaterThan(shape.w * 1.25);

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
    await page.getByRole("button", { name: "Découvrir mon percentile" }).first().click();
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


test.describe("Bandeau scanner : plan de balayage dans le cadre", () => {
  test("le plan balaie la forme de bas en haut et retour, sans jamais sortir du cadre, ni pendant un glissement extrême", async ({ page }) => {
    await page.goto("/");
    await live(page);
    // Un balayage complet (période 6,4 s) : le plan va d'une extrémité à l'autre, sa boîte reste dans le cadre à chaque image.
    const states = await sampleStates(page, 7000);
    const ts = states.map((s) => s.planeT);
    expect(Math.min(...ts)).toBeLessThan(0.1);
    expect(Math.max(...ts)).toBeGreaterThan(0.9);
    for (const st of states) expect(planeInside(st), JSON.stringify(st)).toBe(true);
    // Le plan est un disque vu en coupe oblique, pas un trait : sa hauteur à l'écran est au moins 15 % de sa largeur.
    for (const st of states) expect((st.plane.y1 - st.plane.y0) / (st.plane.x1 - st.plane.x0)).toBeGreaterThan(0.15);
    expect(await inkOnEdge(page)).toBe(0); // aucun pixel dessiné contre le bord du canevas

    // Glissement extrême à la souris (azimut et inclinaison, vers le haut puis vers le bas) : toujours dans le cadre.
    const box = (await canvas(page).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const seen: State[] = [];
    for (const [dx, dy] of [[60, 400], [-120, -800], [60, 500], [-40, 300], [90, -300]]) {
      await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
      seen.push(await state(page));
      expect(await inkOnEdge(page)).toBe(0);
    }
    await page.mouse.up();
    expect(new Set(seen.map((s) => s.pitch.toFixed(2))).size).toBeGreaterThan(1); // l'inclinaison a bien changé (butées comprises)
    for (const st of [...seen, ...(await sampleStates(page, 600))]) expect(planeInside(st), JSON.stringify(st)).toBe(true);
  });

  test("mouvement réduit : le plan est figé à une position dans le cadre, y compris pendant un glissement", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await live(page);
    const a = await state(page);
    expect(a.planeT).toBeGreaterThan(0.1);
    expect(a.planeT).toBeLessThan(0.9);
    expect(planeInside(a)).toBe(true);
    await page.waitForTimeout(900);
    expect((await state(page)).planeT).toBe(a.planeT);
    const box = (await canvas(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 500, { steps: 8 });
    const during = await state(page);
    await page.mouse.up();
    expect(during.planeT).toBe(a.planeT);
    expect(planeInside(during)).toBe(true);
    expect(await inkOnEdge(page)).toBe(0);
  });
});

test.describe("Bandeau scanner : vue proche du profil, la même sur mobile et sur ordinateur", () => {
  const initialView = async (page: Page, width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" }); // image fixe : la vue de départ n'est pas modifiée par la rotation automatique
    await page.goto("/");
    await live(page);
    return state(page);
  };

  test("même azimut et même inclinaison par défaut à 390 px et à 1 280 px (proche du profil : 60 à 70° de la vue de face)", async ({ page }) => {
    const mobile = await initialView(page, 390, 844);
    const desktop = await initialView(page, 1280, 800);
    expect(mobile.yaw).toBe(desktop.yaw);
    expect(mobile.pitch).toBe(desktop.pitch);
    expect((desktop.yaw * 180) / Math.PI).toBeGreaterThanOrEqual(60); // proche du profil…
    expect((desktop.yaw * 180) / Math.PI).toBeLessThanOrEqual(70); // …sans y être tout à fait
    expect(desktop.pitch).toBeGreaterThan(0.25);
  });

  test("en marche aussi, l'inclinaison est la même sur mobile et sur ordinateur", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await live(page);
    const mobile = await state(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(300);
    const desktop = await state(page);
    expect(mobile.pitch).toBe(desktop.pitch);
  });

  test("mobile 390 px : la forme est agrandie d'environ 30 % et reste dans la colonne centrale, entre les valeurs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await live(page);
    const before = Math.min(184 / 3.5, (390 - 190) / 2.8); // unité du moteur avant la retouche (bandeau de 184 px)
    const samples = await sampleStates(page, 3500);
    for (const st of samples) {
      expect(st.unit / before).toBeGreaterThan(1.25);
      expect(st.unit / before).toBeLessThan(1.4);
      expect(planeInside(st)).toBe(true);
      // Colonne centrale : 100 px réservés aux valeurs de chaque côté.
      expect(st.plane.x0).toBeGreaterThanOrEqual(100 - 1e-6);
      expect(st.plane.x1).toBeLessThanOrEqual(390 - 100 + 1e-6);
    }
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
