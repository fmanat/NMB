import { execFileSync } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { createSimulatedVision, type Scenario } from "@/lib/vision/simulation";
import type { VisionProvider } from "@/lib/vision/types";
import { usageCostMicros } from "@/lib/xaiSpend";
import {
  assertPhotosDirIgnored,
  checkSessionCap,
  compareToRuler,
  isPhotosDirGitIgnored,
  LEDGER_FILE,
  parseCli,
  parseDecimal,
  parseState,
  PhotoTestError,
  remainingInPhotosDir,
  resolvePhotoPath,
  runDeleteCli,
  runPhotoTestCli,
  secureDelete,
  type CliIO,
} from "../scripts/lib/photoTest";
import { flatImage } from "./fixtures/neutralImage";

// Tests du kit de test photo (bloc 7) : aucun réseau, aucune photo réelle. Image neutre fabriquée par du code, dossier temporaire
// qui joue le rôle du projet (racine + photos-test/ + .gitignore).

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const roots: string[] = [];

/** Faux projet : racine temporaire avec .gitignore (ignorant photos-test/) et photos-test/. */
function fakeProject(opts: { ignored?: boolean } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "bm-photo-test-")));
  roots.push(root);
  writeFileSync(join(root, ".gitignore"), opts.ignored === false ? "node_modules/\n" : "node_modules/\n/photos-test/\n");
  mkdirSync(join(root, "photos-test"));
  return root;
}
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

async function addPhoto(root: string, name = "ma-photo-secrete.jpg"): Promise<{ path: string; bytes: Buffer }> {
  const bytes = await flatImage();
  const path = join(root, "photos-test", name);
  writeFileSync(path, bytes);
  return { path, bytes };
}

function io(root: string, over: Partial<CliIO> = {}): CliIO & { lines: string[] } {
  const lines: string[] = [];
  return { root, cwd: root, out: (l) => lines.push(l), lines, env: {}, ...over };
}

const text = (lines: string[]) => lines.join("\n");

describe("photos-test/ est ignoré par git (contrôle qui échoue sinon)", () => {
  it("le dépôt ignore le dossier photos-test/ et le fichier de cumul de dépense", () => {
    expect(isPhotosDirGitIgnored(REPO)).toBe(true);
    const gi = readFileSync(join(REPO, ".gitignore"), "utf8").replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim());
    expect(gi).toContain("/photos-test/");
    expect(gi).toContain("/.photo-test-depenses.json");
    // git lui-même confirme qu'un fichier posé dedans serait ignoré (code 0 : ignoré).
    expect(() => execFileSync("git", ["check-ignore", "-q", "--", "photos-test/une-photo.jpg"], { cwd: REPO })).not.toThrow();
    expect(() => execFileSync("git", ["check-ignore", "-q", "--", LEDGER_FILE], { cwd: REPO })).not.toThrow();
  });
  it("un projet où photos-test/ n'est pas ignoré est détecté et le script refuse de démarrer", async () => {
    const root = fakeProject({ ignored: false });
    expect(isPhotosDirGitIgnored(root)).toBe(false);
    expect(() => assertPhotosDirIgnored(root)).toThrow(/n'est PAS ignoré/);
    const { bytes } = await addPhoto(root);
    const c = io(root);
    const code = await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--simulation"], c);
    expect(code).toBe(2);
    expect(text(c.lines)).toMatch(/n'est PAS ignoré/);
    expect(readFileSync(join(root, "photos-test", "ma-photo-secrete.jpg")).equals(bytes)).toBe(true); // photo intacte
  });
  it("un projet bien configuré est reconnu (repli sur .gitignore quand git ne connaît pas le dossier)", () => {
    expect(isPhotosDirGitIgnored(fakeProject())).toBe(true);
  });
});

describe("garde de chemin : refus de tout ce qui est hors de photos-test/", () => {
  it("accepte un fichier image du dossier, en chemin relatif ou absolu, et renvoie le chemin réel", async () => {
    const root = fakeProject();
    const { path } = await addPhoto(root);
    expect(resolvePhotoPath("photos-test/ma-photo-secrete.jpg", root, root)).toBe(path);
    expect(resolvePhotoPath(path, root, "/")).toBe(path);
    expect(resolvePhotoPath("./ma-photo-secrete.jpg", root, join(root, "photos-test"))).toBe(path);
  });
  it("refuse hors du dossier : remontée, chemin absolu extérieur, dossier voisin au nom proche, racine du projet", async () => {
    const root = fakeProject();
    writeFileSync(join(root, "dehors.jpg"), "x");
    mkdirSync(join(root, "photos-test-autre"));
    writeFileSync(join(root, "photos-test-autre", "a.jpg"), "x");
    for (const p of ["dehors.jpg", "photos-test/../dehors.jpg", "../dehors.jpg", join(root, "dehors.jpg"), "photos-test-autre/a.jpg", "/etc/hosts", "photos-test", "photos-test/", "."]) {
      expect(() => resolvePhotoPath(p, root, root), p).toThrow(PhotoTestError);
    }
    try {
      resolvePhotoPath("dehors.jpg", root, root);
    } catch (e) {
      expect((e as PhotoTestError).code).toBe("hors-dossier");
      expect((e as Error).message).not.toContain("dehors"); // le nom du fichier n'est jamais répété
    }
  });
  it("refuse un lien symbolique (même vers un fichier du dossier), un dossier, un fichier absent, une extension non image", async () => {
    const root = fakeProject();
    writeFileSync(join(root, "ailleurs.jpg"), "x");
    symlinkSync(join(root, "ailleurs.jpg"), join(root, "photos-test", "lien.jpg"));
    await addPhoto(root, "vraie.jpg");
    symlinkSync(join(root, "photos-test", "vraie.jpg"), join(root, "photos-test", "lien2.jpg"));
    mkdirSync(join(root, "photos-test", "sous-dossier.jpg"));
    writeFileSync(join(root, "photos-test", "notes.txt"), "x");
    const code = (p: string) => {
      try {
        resolvePhotoPath(p, root, root);
        return "ok";
      } catch (e) {
        return (e as PhotoTestError).code;
      }
    };
    expect(code("photos-test/lien.jpg")).toBe("lien");
    expect(code("photos-test/lien2.jpg")).toBe("lien");
    expect(code("photos-test/sous-dossier.jpg")).toBe("dossier");
    expect(code("photos-test/absente.jpg")).toBe("introuvable");
    expect(code("photos-test/notes.txt")).toBe("extension");
    expect(code("photos-test/vraie.jpg")).toBe("ok");
  });
  it("refuse un dossier photos-test/ qui est lui-même un lien vers l'extérieur", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "bm-photo-link-")));
    roots.push(root);
    const outside = join(root, "exterieur");
    mkdirSync(outside);
    writeFileSync(join(outside, "p.jpg"), await flatImage());
    symlinkSync(outside, join(root, "photos-test"));
    expect(() => resolvePhotoPath("photos-test/p.jpg", root, root)).toThrow(/lien symbolique/);
  });
  it("refuse un chemin vide ou contenant un caractère nul", () => {
    expect(() => resolvePhotoPath("", REPO)).toThrow(PhotoTestError);
    expect(() => resolvePhotoPath("photos-test/a\0.jpg", REPO)).toThrow(PhotoTestError);
  });
});

describe("arguments", () => {
  it("lit les nombres à la française et l'état", () => {
    expect(parseDecimal("14,2")).toBe(14.2);
    expect(parseDecimal("14.2")).toBe(14.2);
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("-3")).toBeNull();
    expect(parseDecimal("1e3")).toBeNull();
    expect(parseDecimal("")).toBeNull();
    expect(parseState("érection")).toBe("erect");
    expect(parseState("Erection")).toBe("erect");
    expect(parseState("repos")).toBe("rest");
    expect(parseState("autre")).toBeNull();
  });
  it("exige l'état et une photo (sauf simulation) ; refuse les valeurs hors plage et les options inconnues", () => {
    expect(() => parseCli(["photos-test/a.jpg"])).toThrow(/--etat est obligatoire/);
    expect(() => parseCli(["--etat", "erection"])).toThrow(/Indiquez la photo/);
    expect(() => parseCli(["--simulation", "--etat", "bof"])).toThrow(/--etat doit valoir/);
    expect(() => parseCli(["a.jpg", "--etat", "repos", "--longueur", "99"])).toThrow(/--longueur/);
    expect(() => parseCli(["a.jpg", "--etat", "repos", "--circonference", "1"])).toThrow(/--circonference/);
    expect(() => parseCli(["a.jpg", "b.jpg", "--etat", "repos"])).toThrow(/Une seule photo/);
    expect(() => parseCli(["a.jpg", "--etat", "repos", "--inconnue"])).toThrow(/Option non reconnue/);
    const o = parseCli(["photos-test/a.jpg", "--etat", "érection", "--longueur", "14,2", "--circonference", "12,1", "--supprimer", "--sans-base"]);
    expect(o).toMatchObject({ file: "photos-test/a.jpg", state: "erect", length: 14.2, girth: 12.1, delete: true, simulation: false });
    const sim = parseCli(["--simulation", "--etat", "repos"]);
    expect(sim.simulation).toBe(true);
    expect(sim.file).toBeUndefined();
    expect(parseCli(["--aide"]).help).toBe(true);
  });
});

describe("écart avec la règle", () => {
  it("calcule l'écart en cm et en % de la mesure à la règle, et la présence dans la marge", () => {
    const g = compareToRuler(13, 14.2, 10);
    expect(g.gapCm).toBeCloseTo(-1.2, 10);
    expect(g.gapPct).toBeCloseTo(-8.4507, 3);
    expect(g.withinMargin).toBe(true);
    const h = compareToRuler(16, 14, 10);
    expect(h.gapPct).toBeCloseTo(14.2857, 3);
    expect(h.withinMargin).toBe(false);
    expect(compareToRuler(15.4, 14, 10).withinMargin).toBe(true); // exactement 10 % : dans la marge
    expect(compareToRuler(14, 14, 10).gapCm).toBe(0);
  });
});

describe("mode simulation : même circuit, texte seulement", () => {
  let before: { reports: number; attempts: number };
  const counts = async () => ({
    reports: (await pool().query("SELECT count(*)::int AS n FROM reports")).rows[0].n as number,
    attempts: (await pool().query("SELECT count(*)::int AS n FROM analysis_attempts")).rows[0].n as number,
  });
  beforeEach(async () => {
    before = await counts();
  });
  afterEach(async () => {
    expect(await counts()).toEqual(before); // aucune écriture en base
  });

  it("analyse une photo neutre du dossier, affiche mesures, écart, rapport standardisé, appels, durées et coût", async () => {
    const root = fakeProject();
    await addPhoto(root);
    const c = io(root);
    const infoBefore = console.info;
    const code = await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--longueur", "14,2", "--circonference", "12,1", "--simulation"], c);
    expect(console.info).toBe(infoBefore); // la console est rendue
    expect(code).toBe(0);
    const t = text(c.lines);
    expect(t).toContain("mode SIMULATION");
    expect(t).toContain("photo-report/1");
    expect(t).toMatch(/Longueur : 13,0 cm \(marge ± 10,0 %\) · percentile \d/);
    expect(t).toMatch(/Circonférence : 12,6 cm/);
    expect(t).toContain("Profil morphologique : ");
    // Écart : 13,0 estimé contre 14,2 saisi (−1,2 cm, −8,5 %), 12,6 contre 12,1 (+0,5 cm, +4,1 %).
    expect(t).toContain("Longueur : estimée 13,0 cm · règle 14,2 cm · écart −1,2 cm (−8,5 %)");
    expect(t).toContain("Circonférence : estimée 12,6 cm · règle 12,1 cm · écart +0,5 cm (+4,1 %)");
    expect(t).toMatch(/1\. .+\n\s+2\. .+\n\s+3\. .+\n\s+Verdict : /);
    expect(t).toMatch(/Appels à l'API : 3 \(.*relances : 0\)/);
    expect(t).toContain("Durée totale :");
    expect(t).toContain("Rédaction des observations :");
    expect(t).toContain("Coût de cette analyse : 0,0000 $");
    expect(t).toContain("simulation, aucun appel réel");
    // La photo n'est pas supprimée sans --supprimer ; rien n'a été créé dans le projet (ni cumul de dépense, ni copie).
    expect(readdirSync(join(root, "photos-test"))).toEqual(["ma-photo-secrete.jpg"]);
    expect(existsSync(join(root, LEDGER_FILE))).toBe(false);
    expect(readdirSync(root).sort()).toEqual([".gitignore", "photos-test"]);
  });

  it("la sortie est du texte pur : ni octet d'image, ni base64, ni nom de fichier, ni chemin", async () => {
    const root = fakeProject();
    const { bytes } = await addPhoto(root, "nom-tres-personnel.jpg");
    const c = io(root);
    await runPhotoTestCli(["photos-test/nom-tres-personnel.jpg", "--etat", "repos", "--longueur", "9,5", "--simulation", "--supprimer"], c);
    const t = text(c.lines);
    expect(t).not.toContain("nom-tres-personnel");
    expect(t).not.toContain("personnel");
    expect(t).not.toContain(root);
    expect(t).not.toMatch(/data:image|base64/i);
    expect(t).not.toMatch(/[A-Za-z0-9+/=]{40,}/); // aucune longue chaîne base64
    expect(t).not.toContain(bytes.toString("base64").slice(0, 30));
    expect(t).not.toMatch(/[^\S\n]*[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/); // aucun caractère de contrôle
    expect(Buffer.from(t, "utf8").includes(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false); // pas d'en-tête JPEG
    expect(Buffer.from(t, "utf8").includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("--supprimer : la photo est écrasée puis supprimée, la confirmation et le reste du dossier sont affichés", async () => {
    const root = fakeProject();
    const { path } = await addPhoto(root);
    const c = io(root);
    const code = await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--simulation", "--supprimer"], c);
    expect(code).toBe(0);
    expect(existsSync(path)).toBe(false);
    expect(text(c.lines)).toContain("PHOTO SUPPRIMÉE de photos-test/ (écrasée puis effacée). Entrées restantes dans photos-test/ : 0.");
    expect(remainingInPhotosDir(root)).toBe(0);
  });

  it("sans fichier : photo neutre fabriquée en mémoire (rien n'est écrit), --supprimer n'a rien à supprimer", async () => {
    const root = fakeProject();
    const c = io(root);
    const code = await runPhotoTestCli(["--simulation", "--etat", "erection", "--supprimer"], c);
    expect(code).toBe(0);
    expect(text(c.lines)).toContain("Aucune photo à supprimer");
    expect(readdirSync(join(root, "photos-test"))).toEqual([]);
  });

  it("refus affiché en texte : motif technique, message du site, code de sortie 1, aucune écriture en base", async () => {
    const root = fakeProject();
    await addPhoto(root);
    const c = io(root);
    // Moteur simulé réglé sur « carte absente » : on passe par runPhotoTest via le mode réel factice (aucun réseau).
    const code = await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], {
      ...c,
      env: { XAI_API_KEY: "cle-factice-test", XAI_DAILY_CAP_USD: "5" },
      realVision: createSimulatedVision("no_card"),
      pricing: { inPerM: 2, outPerM: 6 },
    });
    expect(code).toBe(1);
    const t = text(c.lines);
    expect(t).toContain("ANALYSE REFUSÉE");
    expect(t).toContain("Motif technique : carte_absente_ou_illisible");
    expect(t).toContain("Message qu'afficherait le site");
    expect(t).not.toContain("MESURES CALCULÉES");
  });
});

/** Moteur « réel » factice : le simulé, avec une consommation de jetons réaliste (mesurée le 02/10/2026) ; compte les appels. */
function fakeRealVision(scenario: Scenario = "ok") {
  const inner = createSimulatedVision(scenario);
  const calls = { analyse: 0, comment: 0 };
  const vision: VisionProvider = {
    id: "xai-factice",
    analyse: async (j) => {
      calls.analyse++;
      const r = await inner.analyse(j);
      return { ...r, usage: { tokensIn: 5589, tokensOut: 641, ms: 23000, calls: 2 } };
    },
    writeComment: async (i) => {
      calls.comment++;
      const r = await inner.writeComment(i);
      return { ...r, usage: { tokensIn: 1748, tokensOut: 123, ms: 18000, calls: 1 } };
    },
  };
  return { vision, calls };
}

describe("mode réel (moteur factice, aucun réseau) : plafond, clé, coût, cumul", () => {
  const PRICING = { inPerM: 2, outPerM: 6 };
  const NOW = () => new Date("2026-10-03T10:00:00+02:00");
  const base = (root: string, over: Partial<CliIO> = {}): CliIO & { lines: string[] } => io(root, { env: { XAI_API_KEY: "cle-factice-test", XAI_DAILY_CAP_USD: "5" }, pricing: PRICING, now: NOW, ...over });

  it("refuse de démarrer sans clé (jamais affichée) ou sans .env : aucun appel, photo intacte, rien supprimé", async () => {
    const root = fakeProject();
    const { path } = await addPhoto(root);
    const { vision, calls } = fakeRealVision();
    const c = base(root, { env: { XAI_API_KEY: "  " }, realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--supprimer"], c)).toBe(2);
    expect(text(c.lines)).toMatch(/XAI_API_KEY est vide/);
    const c2 = base(root, { loadEnv: () => false, realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--supprimer"], c2)).toBe(2);
    expect(text(c2.lines)).toMatch(/\.env introuvable/);
    expect(calls).toEqual({ analyse: 0, comment: 0 });
    expect(existsSync(path)).toBe(true);
  });

  it("garde-fou du plafond : refus avant tout appel quand dépensé + coût estimé de la session dépasse XAI_DAILY_CAP_USD", async () => {
    // Fonction pure, aux bornes (0,03 $ de réservation).
    expect(checkSessionCap({ spentMicros: 0, capUsd: 0.03, estimateUsd: 0.03 }).ok).toBe(true);
    expect(checkSessionCap({ spentMicros: 0, capUsd: 0.0299, estimateUsd: 0.03 }).ok).toBe(false);
    expect(checkSessionCap({ spentMicros: 4_970_000, capUsd: 5, estimateUsd: 0.03 }).ok).toBe(true);
    expect(checkSessionCap({ spentMicros: 4_970_001, capUsd: 5, estimateUsd: 0.03 }).ok).toBe(false);
    expect(checkSessionCap({ spentMicros: 0, capUsd: 0, estimateUsd: 0.03 }).ok).toBe(false);

    const root = fakeProject();
    const { path } = await addPhoto(root);
    const { vision, calls } = fakeRealVision();
    const c = base(root, { env: { XAI_API_KEY: "cle-factice-test", XAI_DAILY_CAP_USD: "0.02" }, realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--supprimer"], c)).toBe(2);
    expect(text(c.lines)).toMatch(/au-delà du plafond XAI_DAILY_CAP_USD/);
    expect(text(c.lines)).toMatch(/Aucun appel n'a été envoyé/);
    expect(calls).toEqual({ analyse: 0, comment: 0 });
    expect(existsSync(path)).toBe(true); // ni envoyée ni supprimée
    expect(existsSync(join(root, LEDGER_FILE))).toBe(false);

    // Cumul du jour déjà proche du plafond (fichier local) : refus ; la veille ne compte pas.
    writeFileSync(join(root, LEDGER_FILE), JSON.stringify({ days: { "2026-10-03": { spentMicros: 4_980_000, analyses: 200 }, "2026-10-02": { spentMicros: 1, analyses: 1 } } }));
    const c2 = base(root, { realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], c2)).toBe(2);
    expect(calls).toEqual({ analyse: 0, comment: 0 });
    writeFileSync(join(root, LEDGER_FILE), JSON.stringify({ days: { "2026-10-02": { spentMicros: 4_990_000, analyses: 200 } } }));
    const c3 = base(root, { realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], c3)).toBe(0);
    expect(calls).toEqual({ analyse: 1, comment: 1 });
  });

  it("analyse réelle (factice) : coût d'après jetons × tarif, cumul du jour mis à jour, plafond affiché, photo supprimée sur demande", async () => {
    const root = fakeProject();
    const { path } = await addPhoto(root);
    const { vision, calls } = fakeRealVision();
    const c = base(root, { realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection", "--supprimer"], c)).toBe(0);
    const expected = usageCostMicros({ tokensIn: 5589, tokensOut: 641 }, PRICING) + usageCostMicros({ tokensIn: 1748, tokensOut: 123 }, PRICING);
    expect(expected).toBe(19_258);
    const t = text(c.lines);
    expect(t).toContain("mode RÉEL");
    expect(t).toContain("Coût de cette analyse : 0,0193 $");
    expect(t).toContain("Jetons : 7337 en entrée, 764 en sortie");
    expect(t).toMatch(/Appels à l'API : 3 /);
    expect(t).toContain("Cumul du jour (jour civil, Paris) : 0,0193 $ sur un plafond XAI_DAILY_CAP_USD de 5,0000 $ (reste 4,9807 $)");
    expect(t).toContain("0,0150 $"); // coût de l'appel d'analyse
    expect(t).not.toContain("cle-factice-test");
    expect(calls).toEqual({ analyse: 1, comment: 1 });
    expect(existsSync(path)).toBe(false);
    const ledger = JSON.parse(readFileSync(join(root, LEDGER_FILE), "utf8"));
    expect(ledger.days["2026-10-03"]).toEqual({ spentMicros: 19_258, analyses: 1 });
    // Deuxième analyse : le cumul s'additionne.
    await addPhoto(root);
    const c2 = base(root, { realVision: fakeRealVision().vision });
    await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], c2);
    expect(text(c2.lines)).toContain("Cumul du jour (jour civil, Paris) : 0,0385 $");
  });

  it("une relance unique (commentaire invalide une fois) est comptée, coûtée et affichée", async () => {
    const root = fakeProject();
    await addPhoto(root);
    const { vision, calls } = fakeRealVision("comment_invalid_once");
    const c = base(root, { realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], c)).toBe(0);
    expect(calls).toEqual({ analyse: 1, comment: 2 });
    const t = text(c.lines);
    expect(t).toMatch(/Appels à l'API : 4 \(.*relances : 1\)/);
    expect(t).toContain("Coût de cette analyse : 0,0235 $"); // 19 258 + 4 234 micro-dollars
  });

  it("une réponse invalide deux fois donne le message neutre, un code de sortie 1 et un coût compté", async () => {
    const root = fakeProject();
    await addPhoto(root);
    const { vision } = fakeRealVision("comment_digit");
    const c = base(root, { realVision: vision });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], c)).toBe(1);
    const t = text(c.lines);
    expect(t).toContain("ANALYSE REFUSÉE");
    expect(t).toContain("commentaire_invalide");
    expect(t).toContain("Nous n'avons pas pu analyser cette photo");
    expect(t).toMatch(/relances : 1/);
  });

  it("une panne du moteur est affichée sans trace ni octets ; la photo n'est PAS supprimée à tort sans demande", async () => {
    const root = fakeProject();
    const { path } = await addPhoto(root);
    const down: VisionProvider = {
      id: "panne",
      analyse: async () => {
        throw new (await import("@/lib/vision/types")).VisionError("network", "ECONNRESET api.x.ai");
      },
      writeComment: async () => {
        throw new Error("jamais appelé");
      },
    };
    const c = base(root, { realVision: down });
    expect(await runPhotoTestCli(["photos-test/ma-photo-secrete.jpg", "--etat", "erection"], c)).toBe(1);
    const t = text(c.lines);
    expect(t).toContain("RÉSULTAT : ERREUR");
    expect(t).toContain("momentanément indisponible");
    expect(t).toContain("échec (network)");
    expect(existsSync(path)).toBe(true);
  });
});

describe("suppression propre", () => {
  it("écrase le contenu avant de supprimer (vérifié via un second lien sur le même fichier)", async () => {
    const root = fakeProject();
    const { path, bytes } = await addPhoto(root);
    const other = join(root, "autre-lien.bin");
    linkSync(path, other); // même contenu physique : si on écrase, ce lien le voit
    secureDelete(path);
    expect(existsSync(path)).toBe(false);
    const left = readFileSync(other);
    expect(left.length).toBe(bytes.length);
    expect(left.equals(Buffer.alloc(bytes.length))).toBe(true); // dernière passe : zéros
    expect(left.equals(bytes)).toBe(false);
  });

  it("npm run photo:supprimer : un fichier, vérification, refus hors dossier (fichier extérieur intact)", async () => {
    const root = fakeProject();
    await addPhoto(root, "a.jpg");
    await addPhoto(root, "b.png");
    writeFileSync(join(root, "important.jpg"), "ne pas toucher");
    const lines: string[] = [];
    const out = (l: string) => lines.push(l);
    expect(runDeleteCli(["photos-test/a.jpg"], { root, cwd: root, out })).toBe(1); // b.png reste
    expect(text(lines)).toContain("1 fichier(s) supprimé(s)");
    expect(text(lines)).toContain("il reste 1 entrée(s)");
    expect(text(lines)).not.toContain("a.jpg");
    lines.length = 0;
    expect(runDeleteCli(["important.jpg"], { root, cwd: root, out })).toBe(2);
    expect(text(lines)).toMatch(/Refusé : la photo doit se trouver/);
    expect(readFileSync(join(root, "important.jpg"), "utf8")).toBe("ne pas toucher");
    lines.length = 0;
    expect(runDeleteCli(["--verifier"], { root, cwd: root, out })).toBe(1);
    expect(text(lines)).toContain("il reste 1 entrée(s)");
    expect(readdirSync(join(root, "photos-test")).length).toBe(1); // --verifier ne supprime rien
    lines.length = 0;
    expect(runDeleteCli(["--tout"], { root, cwd: root, out })).toBe(0);
    expect(text(lines)).toContain("photos-test/ est vide. Il ne reste aucune photo.");
    expect(readdirSync(join(root, "photos-test"))).toEqual([]);
  });

  it("--tout retire aussi un lien symbolique sans toucher à sa cible, et sans argument le script explique quoi faire", async () => {
    const root = fakeProject();
    writeFileSync(join(root, "cible.txt"), "intacte");
    symlinkSync(join(root, "cible.txt"), join(root, "photos-test", "lien.jpg"));
    const lines: string[] = [];
    expect(runDeleteCli(["--tout"], { root, out: (l) => lines.push(l) })).toBe(0);
    expect(readFileSync(join(root, "cible.txt"), "utf8")).toBe("intacte");
    lines.length = 0;
    expect(runDeleteCli([], { root, out: (l) => lines.push(l) })).toBe(2);
    expect(text(lines)).toMatch(/Indiquez la photo à supprimer/);
  });
});

describe("docs/TEST-PHOTO.md est cohérent avec les commandes", () => {
  const doc = readFileSync(join(REPO, "docs", "TEST-PHOTO.md"), "utf8");
  const commands = [...doc.matchAll(/^npm run (photo:[a-z]+) -- (.+)$/gm)].map((m) => ({ script: m[1], args: m[2] }));
  it("chaque commande « npm run photo:… » du document est acceptée par le script correspondant", () => {
    expect(commands.length).toBeGreaterThanOrEqual(5);
    for (const c of commands.filter((x) => x.script === "photo:test")) {
      expect(() => parseCli(c.args.split(/\s+/)), c.args).not.toThrow();
    }
    const lines: string[] = [];
    const root = fakeProject();
    for (const c of commands.filter((x) => x.script === "photo:supprimer")) {
      const code = runDeleteCli(c.args.split(/\s+/).map((a) => (a.endsWith(".jpg") ? "photos-test/inexistante.jpg" : a)), { root, out: (l) => lines.push(l) });
      expect([0, 1, 2]).toContain(code);
    }
    expect(lines.join("\n")).not.toMatch(/Option non reconnue/);
  });
  it("la commande principale du document reprend l'exemple de la demande, avec suppression", () => {
    expect(doc).toContain("npm run photo:test -- photos-test/ma-photo.jpg --etat erection --longueur 14,2 --circonference 12,1 --supprimer");
    expect(doc).toContain("npm run photo:test -- --simulation --etat erection");
    expect(doc).toContain("npm run photo:supprimer -- --verifier");
  });
  it("les motifs de refus cités existent dans le code ; les sections demandées sont présentes", () => {
    const schema = readFileSync(join(REPO, "src", "lib", "vision", "schema.ts"), "utf8");
    const flow = readFileSync(join(REPO, "src", "lib", "analyseFlow.ts"), "utf8");
    const cited = [...doc.matchAll(/`([a-z_]{8,})`/g)].map((m) => m[1]).filter((m) => /^(carte_|visage_|plusieurs_|sujet_|image_|doute_|inclinaison_|confiance_|mesure_|calcul_|recevabilite_|reperage_|commentaire_)/.test(m));
    expect(cited.length).toBeGreaterThanOrEqual(10);
    for (const m of cited) expect(schema + flow, m).toContain(m);
    for (const h of ["## 1. Avant la photo", "## 2. Faire la photo", "## 3. Les commandes", "## 4. Lire le résultat", "## 5. Supprimer la photo", "## 6. Ce que vous me renvoyez"]) expect(doc).toContain(h);
    expect(doc).toContain("J'ai supprimé la photo");
    expect(doc).toContain("L'écart de référence reste à établir");
  });
});

describe("branchement du kit dans le projet", () => {
  it("les deux commandes npm existent", () => {
    const pkg = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["photo:test"]).toContain("scripts/photo-test.mts");
    expect(pkg.scripts["photo:supprimer"]).toContain("scripts/photo-supprimer.mts");
  });
  it("le script de test ne contient aucune écriture de fichier, aucun affichage d'octets et ne touche pas à la base du site", () => {
    const src = readFileSync(join(REPO, "scripts", "lib", "photoTest.ts"), "utf8");
    // Seules écritures autorisées : le cumul de dépense (texte) et l'écrasement de la photo à supprimer.
    const writes = (src.match(/writeFileSync\(/g) ?? []).length;
    expect(writes).toBe(1);
    expect(src).not.toMatch(/copyFile|cpSync|renameSync|toString\("base64"\)|toString\('base64'\)|base64url/);
    expect(src).not.toMatch(/from "@\/lib\/db"|from "@\/lib\/repo"/);
  });
});
