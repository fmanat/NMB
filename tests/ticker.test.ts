import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../next.config";
import { REFERENCES, REFERENCE_SOURCE, TICKER } from "@/config/site";
import { exampleReport } from "@/lib/exampleReport";
import { pool } from "@/lib/db";
import { completedAnalysisStats } from "@/lib/repo";
import { percentile, referenceFor } from "@/lib/stats";
import {
  REPORT_MEASURES,
  buildTickerItems,
  formatBuildDate,
  frInt,
  frNumber,
  liveStatsQualify,
  reportMeasureKeys,
  type LiveAnalysisStats,
  type TickerInput,
} from "@/lib/ticker";
import { createLiveStatsReader, statsTtlMs } from "@/lib/tickerStats";
import { TickerBand } from "@/components/ticker/TickerBand";

const report = exampleReport();
const base: TickerInput = { freeBeta: false, buildDate: "2026-10-02T10:00:00.000Z", live: null, report };
const ids = (i: Partial<TickerInput> = {}) => buildTickerItems({ ...base, ...i }).map((x) => x.id);
const live = (count: number, averageScore = 80): LiveAnalysisStats => ({ count, averageScore });

// ---------- Construction de la liste (fonctions pures) ----------

describe("bandeau défilant : construction de la liste", () => {
  it("le seuil est une constante nommée de la configuration, égale à 500", () => {
    expect(TICKER.analysesThreshold).toBe(500);
  });

  it("socle : référence, mesures et version sont toujours là ; ni bêta ni compteur sans leur condition", () => {
    expect(ids()).toEqual(["reference", "measures", "version"]);
  });

  describe("statut de la bêta (dérivé de isFreeBeta)", () => {
    it("présent seulement si la bêta gratuite est active, en tête", () => {
      expect(ids({ freeBeta: true })).toEqual(["beta", "reference", "measures", "version"]);
      expect(ids({ freeBeta: false })).not.toContain("beta");
    });
    it("libellé : « Bêta gratuite »", () => {
      expect(buildTickerItems({ ...base, freeBeta: true })[0]).toEqual({ id: "beta", label: "Bêta gratuite" });
    });
  });

  describe("compteur et score moyen : strictement au-delà du seuil", () => {
    it("500 analyses : absents ; 501 : présents ; 499 et 0 : absents", () => {
      for (const n of [0, 1, 499, 500]) expect(ids({ live: live(n) }), `n = ${n}`).not.toContain("analyses");
      for (const n of [501, 502, 10_000]) expect(ids({ live: live(n) }), `n = ${n}`).toEqual(["analyses", "score", "reference", "measures", "version"]);
    });
    it("le seuil suit la constante (borne calculée, pas recopiée)", () => {
      expect(liveStatsQualify(live(TICKER.analysesThreshold))).toBe(false);
      expect(liveStatsQualify(live(TICKER.analysesThreshold + 1))).toBe(true);
    });
    it("base indisponible (null) : aucun des deux éléments, le reste du bandeau est intact", () => {
      expect(ids({ live: null })).toEqual(["reference", "measures", "version"]);
    });
    it("valeurs invalides (NaN, infini) : pas d'élément", () => {
      expect(ids({ live: { count: Number.NaN, averageScore: 80 } })).not.toContain("analyses");
      expect(ids({ live: { count: 600, averageScore: Number.NaN } })).not.toContain("analyses");
      expect(ids({ live: { count: Number.POSITIVE_INFINITY, averageScore: 80 } })).not.toContain("analyses");
    });
    it("affiche le compteur et la moyenne réels, formatés à la française", () => {
      const items = buildTickerItems({ ...base, live: live(12_345, 74.26) });
      expect(items.find((i) => i.id === "analyses")).toEqual({ id: "analyses", label: "Analyses réalisées", value: "12 345" });
      expect(items.find((i) => i.id === "score")).toEqual({ id: "score", label: "Score moyen", value: "74,3", note: "sur 100" });
    });
    it("compteur et score moyen vont ensemble (jamais l'un sans l'autre)", () => {
      for (const n of [0, 500, 501, 9000]) {
        const got = ids({ live: live(n) });
        expect(got.includes("analyses")).toBe(got.includes("score"));
      }
    });
  });

  describe("médiane de référence (Veale et al., 2015)", () => {
    it("valeur lue dans les constantes du code, source citée", () => {
      const item = buildTickerItems(base).find((i) => i.id === "reference")!;
      expect(item.value).toBe(`${String(REFERENCES.erect.length.mean).replace(".", ",")} cm`);
      expect(item.note).toBe("Veale et al., BJU Int., 2015");
      expect(item.note).toBe(REFERENCE_SOURCE);
      expect(item.label).toMatch(/érection/);
    });
    it("suit la constante : une autre valeur de référence donnerait une autre valeur affichée", () => {
      expect(frNumber(referenceFor("erect", "length").mean)).toBe("13,12");
      expect(frNumber(9.5)).toBe("9,5");
    });
    it("c'est bien une médiane : le percentile du site vaut 50 en ce point", () => {
      const { mean, sd } = referenceFor("erect", "length");
      expect(percentile(mean, mean, sd)).toBeCloseTo(50, 5);
      expect(report.length.referenceMedian).toBe(referenceFor("erect", "length").mean); // le rapport l'appelle déjà « médiane de référence »
    });
  });

  describe("nombre de mesures du rapport", () => {
    it("compté depuis la structure réelle du rapport", () => {
      const keys = reportMeasureKeys(report);
      expect(keys).toEqual(["length", "girth", "curvature", "score"]);
      const item = buildTickerItems(base).find((i) => i.id === "measures")!;
      expect(item.value).toBe(String(keys.length));
      expect(item.note).toBe(`(${keys.map((k) => REPORT_MEASURES[k]).join(", ")})`);
    });
    it("une mesure absente du rapport n'est pas comptée ; aucune mesure : pas d'élément", () => {
      const partial = { ...report, curvature: undefined } as unknown as typeof report;
      expect(reportMeasureKeys(partial)).toEqual(["length", "girth", "score"]);
      expect(buildTickerItems({ ...base, report: partial }).find((i) => i.id === "measures")?.value).toBe("3");
      const empty = { formula: "A", state: "erect" } as unknown as typeof report;
      expect(ids({ report: empty })).not.toContain("measures");
    });
  });

  describe("date de la version", () => {
    it("date de construction formatée en français, fuseau de Paris", () => {
      expect(formatBuildDate("2026-10-02T10:00:00.000Z")).toBe("2 octobre 2026");
      expect(formatBuildDate("2026-10-31T23:30:00.000Z")).toBe("1 novembre 2026"); // minuit passé à Paris
      expect(buildTickerItems(base).find((i) => i.id === "version")).toEqual({ id: "version", label: "Version du", value: "2 octobre 2026" });
    });
    it("absente ou invalide : pas d'élément (jamais une fausse date)", () => {
      for (const d of [undefined, "", "pas une date"]) expect(ids({ buildDate: d })).not.toContain("version");
      expect(formatBuildDate(undefined)).toBeNull();
    });
    it("next.config.ts injecte une vraie date de construction (celle du moment où la configuration est lue)", () => {
      const iso = (nextConfig.env as Record<string, string>).BITOMETRE_BUILD_DATE;
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const delta = Math.abs(Date.now() - new Date(iso).getTime());
      expect(delta).toBeLessThan(5 * 60_000);
    });
  });

  it("formats : espaces insécables entre milliers, virgule décimale", () => {
    expect(frInt(501)).toBe("501");
    expect(frInt(1000)).toBe("1 000");
    expect(frInt(1234567)).toBe("1 234 567");
    expect(frNumber(74, 1)).toBe("74");
    expect(frNumber(74.04, 1)).toBe("74");
    expect(frNumber(74.05, 1)).toBe("74,1");
  });

  it("ordre stable : bêta, compteur, score, référence, mesures, version", () => {
    expect(ids({ freeBeta: true, live: live(777) })).toEqual(["beta", "analyses", "score", "reference", "measures", "version"]);
  });
});

// ---------- Lecture serveur : mémoire courte, jamais bloquante ----------

describe("lecture des agrégats : jamais bloquante", () => {
  const deps = (query: () => Promise<LiveAnalysisStats>, over: Partial<Parameters<typeof createLiveStatsReader>[0]> = {}) => ({
    query,
    ttlMs: 60_000,
    failureTtlMs: 30_000,
    timeoutMs: 50,
    ...over,
  });

  it("renvoie les chiffres lus", async () => {
    const read = createLiveStatsReader(deps(async () => live(777, 71.5)));
    expect(await read()).toEqual({ count: 777, averageScore: 71.5 });
  });
  it("base en erreur : null, sans exception", async () => {
    const read = createLiveStatsReader(deps(async () => Promise.reject(new Error("connexion refusée"))));
    expect(await read()).toBeNull();
  });
  it("erreur synchrone de la fonction de lecture : null", async () => {
    const read = createLiveStatsReader(deps(() => {
      throw new Error("DATABASE_URL manquant");
    }));
    expect(await read()).toBeNull();
  });
  it("base qui ne répond pas : null après le délai maximal, sans attendre la base", async () => {
    const read = createLiveStatsReader(deps(() => new Promise(() => {}), { timeoutMs: 40 }));
    const t0 = Date.now();
    expect(await read()).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it("réponse incohérente (nombre négatif, non entier, moyenne invalide) : null", async () => {
    for (const bad of [live(-1), live(1.5), live(600, Number.NaN), live(600, -3)]) {
      expect(await createLiveStatsReader(deps(async () => bad))()).toBeNull();
    }
  });
  it("mémoire courte : une seule lecture pendant la durée, puis une nouvelle", async () => {
    let t = 1_000;
    const query = vi.fn(async () => live(800));
    const read = createLiveStatsReader(deps(query, { now: () => t }));
    await read();
    await read();
    t += 59_999;
    await read();
    expect(query).toHaveBeenCalledTimes(1);
    t += 2;
    await read();
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("un échec est mémorisé moins longtemps, et la base est relue ensuite", async () => {
    let t = 0;
    let ok = false;
    const query = vi.fn(async () => (ok ? live(900) : Promise.reject(new Error("panne"))));
    const read = createLiveStatsReader(deps(query, { now: () => t }));
    expect(await read()).toBeNull();
    expect(await read()).toBeNull();
    expect(query).toHaveBeenCalledTimes(1); // pas de martèlement d'une base en panne
    ok = true;
    t += 30_001;
    expect(await read()).toEqual({ count: 900, averageScore: 80 });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("requêtes simultanées : une seule lecture partagée", async () => {
    const query = vi.fn(() => new Promise<LiveAnalysisStats>((r) => setTimeout(() => r(live(700)), 10)));
    const read = createLiveStatsReader(deps(query, { ttlMs: 0, failureTtlMs: 0 }));
    const out = await Promise.all([read(), read(), read()]);
    expect(out.every((o) => o?.count === 700)).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("durée de mémorisation : défaut de la configuration, réglable (0 accepté), valeurs invalides ignorées", () => {
    expect(statsTtlMs({})).toBe(TICKER.statsCacheMs);
    expect(statsTtlMs({ TICKER_STATS_TTL_MS: "0" })).toBe(0);
    expect(statsTtlMs({ TICKER_STATS_TTL_MS: "250" })).toBe(250);
    for (const v of ["", "abc", "-5"]) expect(statsTtlMs({ TICKER_STATS_TTL_MS: v })).toBe(TICKER.statsCacheMs);
  });
});

// ---------- Base de test : seuil aux bornes sur de vraies lignes ----------

// Insère n lignes du journal anonyme directement en SQL (script de test : jamais de données de production).
async function insert(n: number, over: { formula?: string; freeBeta?: boolean; paid?: boolean; score?: number } = {}) {
  const { formula = "A", freeBeta = true, paid = false, score = 80 } = over;
  await pool().query(
    `INSERT INTO report_log (key, formula, score, created_at, paid_at, free_beta)
     SELECT md5(g::text || $6) || md5((g + 100000)::text || $6), $2, $3, now(), CASE WHEN $4 THEN now() END, $5 FROM generate_series(1, $1) g`,
    [n, formula, score, paid, freeBeta, `${formula}${freeBeta}${paid}${score}`],
  );
}
const clean = () => pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
beforeEach(clean);
afterAll(async () => {
  await clean();
  await pool().end();
});

describe("analyses réalisées en base de test", () => {
  const itemsFromDb = async () => buildTickerItems({ ...base, live: await completedAnalysisStats() });

  it("base vide : zéro, aucun élément de compteur", async () => {
    expect(await completedAnalysisStats()).toEqual({ count: 0, averageScore: 0 });
    expect((await itemsFromDb()).map((i) => i.id)).toEqual(["reference", "measures", "version"]);
  });

  it("500 analyses : pas de compteur ; 501 : compteur et score moyen réels", async () => {
    await insert(TICKER.analysesThreshold);
    expect((await completedAnalysisStats()).count).toBe(500);
    expect((await itemsFromDb()).map((i) => i.id)).not.toContain("analyses");
    await insert(1, { formula: "B", score: 90 }); // une analyse de plus : 501
    const s = await completedAnalysisStats();
    expect(s.count).toBe(501);
    expect(s.averageScore).toBeCloseTo((500 * 80 + 90) / 501, 6);
    const items = await itemsFromDb();
    expect(items.find((i) => i.id === "analyses")?.value).toBe("501");
    expect(items.find((i) => i.id === "score")?.value).toBe("80"); // (500 × 80 + 90) / 501 = 80,02
  });

  it("seuls les rapports débloqués comptent : bêta ou payé ; un rapport non débloqué ne compte jamais", async () => {
    await insert(300, { freeBeta: true });
    await insert(300, { freeBeta: false, paid: true, formula: "C" });
    await insert(5000, { freeBeta: false, paid: false }); // créés mais jamais débloqués
    expect((await completedAnalysisStats()).count).toBe(600);
  });

  it("aucune donnée personnelle : le résultat n'a que deux champs numériques", async () => {
    await insert(3);
    expect(Object.keys(await completedAnalysisStats()).sort()).toEqual(["averageScore", "count"]);
  });
});

// ---------- Rendu ----------

describe("rendu du bandeau (HTML serveur)", () => {
  const items = buildTickerItems({ ...base, freeBeta: true, live: live(1234, 73.4) });
  const html = renderToStaticMarkup(createElement(TickerBand, { items }));
  const doc = { count: (re: RegExp) => (html.match(re) ?? []).length };

  it("une seule liste réelle, non masquée, sans doublon, dans une région nommée", () => {
    expect(html).toMatch(/<section aria-label="Informations du site"/);
    expect(doc.count(/data-ticker="list"/g)).toBe(1);
    expect(doc.count(/data-ticker-item=/g)).toBe(items.length);
    expect(html).not.toMatch(/data-ticker="list"[^>]*aria-hidden/);
  });
  it("le défilement est entièrement aria-hidden et contient exactement deux copies", () => {
    const marquee = html.slice(html.indexOf('data-ticker="marquee"'));
    expect(marquee.slice(0, marquee.indexOf(">") + 1)).toContain('aria-hidden="true"');
    expect(doc.count(/class="ticker-copy"/g)).toBe(2);
    expect(doc.count(/<span class="ticker-item">/g)).toBe(2 * items.length);
  });
  it("la liste lisible est masquée visuellement sauf en mouvement réduit (règles de globals.css)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.ticker-list \{[^}]*position: absolute;[^}]*width: 1px;[^}]*height: 1px;[^}]*overflow: hidden;/);
    const reduced = css.slice(css.indexOf("Mouvement réduit : plus de défilement"));
    expect(reduced).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.ticker-viewport,\s*\.ticker-pause \{ display: none; \}/);
    expect(reduced).toMatch(/\.ticker-track \{ animation: none; \}/);
    expect(reduced).toMatch(/\.ticker-list \{[^}]*position: static;[^}]*overflow: visible;/);
  });
  it("une case « Pause » accessible (étiquette réelle, sans JavaScript)", () => {
    expect(html).toMatch(/<label class="ticker-pause"><input type="checkbox" class="ticker-pause-input"\/><span>Pause<\/span><\/label>/);
  });
  it("contient les vraies valeurs et aucun lien, script, image ni appel réseau", () => {
    for (const t of ["Bêta gratuite", "1 234", "73,4", "13,12 cm", "Veale et al., BJU Int., 2015", "2 octobre 2026"]) expect(html).toContain(t);
    expect(html).not.toMatch(/<(a|script|img|iframe|form)\b|href=|src=|fetch\(/);
  });
  it("liste vide : rien n'est rendu", () => {
    expect(renderToStaticMarkup(createElement(TickerBand, { items: [] }))).toBe("");
  });
});

// ---------- Accueil : placement, rafraîchissement, aucun appel réseau côté client ----------

describe("accueil et bandeau : choix de rendu", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  it("l'accueil est régénéré toutes les quelques minutes (valeur littérale lue par Next.js)", () => {
    const m = page.match(/^export const revalidate = (\d+);/m);
    expect(m).not.toBeNull();
    const seconds = Number(m![1]);
    expect(seconds).toBeGreaterThanOrEqual(60);
    expect(seconds).toBeLessThanOrEqual(900);
  });
  it("le bandeau est tout en haut de l'accueil seulement : emplacement « bandeau » de la mise en page, avant le menu, vide ailleurs", () => {
    const slot = readFileSync("src/app/@bandeau/page.tsx", "utf8");
    expect(slot).toContain("<InfoTicker />");
    expect(slot.match(/^export const revalidate = (\d+);/m)?.[1]).toBe(page.match(/^export const revalidate = (\d+);/m)?.[1]);
    expect(page).not.toContain("<InfoTicker");
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const at = layout.indexOf("{bandeau}");
    expect(at).toBeGreaterThan(layout.indexOf('className="skip-link"')); // le lien d'évitement reste le premier élément
    expect(at).toBeLessThan(layout.indexOf("<Header />"));
    for (const f of ["src/app/@bandeau/default.tsx", "src/app/@bandeau/[...autres]/page.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/return null;/);
    }
  });
  it("aucun composant du bandeau n'est client ni ne fait d'appel réseau ; l'ancien bandeau d'en-tête a disparu", () => {
    for (const f of ["src/components/ticker/TickerBand.tsx", "src/components/ticker/InfoTicker.tsx", "src/lib/ticker.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/["']use client["']/);
      expect(src, f).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|useEffect/);
    }
    expect(readFileSync("src/components/navigation/Header.tsx", "utf8")).not.toMatch(/Ticker/);
  });
});
