import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STANDARD_VERSIONS, validateAnalyse, validateComment } from "@/lib/analyseFlow";
import { PROMPT_RECEVABILITE, PROMPT_REPERAGE, PROMPT_VERSION, SYSTEM_COMMENT, SYSTEM_VISION, TARGET_SCHEMA_VERSION, commentPrompt } from "@/lib/vision/prompts";
import {
  COMMENTAIRE_SCHEMA,
  FORBIDDEN_TERMS,
  OBSERVATION_COUNT,
  OBSERVATION_MAX_CHARS,
  OBSERVATION_MIN_CHARS,
  PHOTO_REPORT_SCHEMA_VERSION,
  RECEVABILITE_SCHEMA,
  REPERAGE_SCHEMA,
  VERDICT_MAX_CHARS,
  textViolations,
  validateCommentaire,
  validateRecevabilite,
  validateReperage,
} from "@/lib/vision/schema";
import { SIMULATED_OBSERVATIONS, SIMULATED_VERDICT, createSimulatedVision } from "@/lib/vision/simulation";
import type { CommentInput } from "@/lib/vision/types";
import { flatImage } from "./fixtures/neutralImage";

const V = PHOTO_REPORT_SCHEMA_VERSION;
const validComment = () => ({ schemaVersion: V, observations: [...SIMULATED_OBSERVATIONS], verdict: SIMULATED_VERDICT });

describe("versions du schéma et des prompts", () => {
  it("sont exposées, nommées et cohérentes entre elles", () => {
    expect(PHOTO_REPORT_SCHEMA_VERSION).toBe("photo-report/1");
    expect(PROMPT_VERSION).toBe("photo-report-prompts/1");
    expect(TARGET_SCHEMA_VERSION).toBe(PHOTO_REPORT_SCHEMA_VERSION);
    expect(STANDARD_VERSIONS).toEqual({ schemaVersion: "photo-report/1", promptVersion: "photo-report-prompts/1" });
  });

  it("le fichier de prompts en service est bien un fichier versionné, et la version qu'il déclare est celle de son nom", () => {
    const files = readdirSync("src/lib/vision/prompts").filter((f) => /^photo-report-v\d+\.ts$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(1);
    const index = readFileSync("src/lib/vision/prompts/index.ts", "utf8");
    const used = index.match(/photo-report-v(\d+)/)?.[1];
    expect(used).toBeTruthy();
    expect(PROMPT_VERSION.endsWith(`/${used}`)).toBe(true);
  });

  it("chaque schéma JSON envoyé à l'API impose la version et interdit les propriétés inconnues", () => {
    for (const s of [RECEVABILITE_SCHEMA, REPERAGE_SCHEMA, COMMENTAIRE_SCHEMA]) {
      expect(s.additionalProperties).toBe(false);
      expect(s.required).toContain("schemaVersion");
      expect(s.properties.schemaVersion.enum).toEqual([V]);
    }
    expect(COMMENTAIRE_SCHEMA.required).toEqual(["schemaVersion", "observations", "verdict"]);
    expect(RECEVABILITE_SCHEMA.properties.motif.enum).toEqual(["ok", "visage_visible", "plusieurs_personnes", "sujet_non_conforme", "carte_absente_ou_illisible", "image_non_originale", "doute_majorite"]);
  });

  it("les prompts annoncent la version et ne contiennent aucun exemple explicite ni terme anatomique interdit", () => {
    for (const p of [SYSTEM_VISION, SYSTEM_COMMENT]) expect(p).toContain(V);
    const texts = [SYSTEM_VISION, PROMPT_RECEVABILITE, PROMPT_REPERAGE, SYSTEM_COMMENT, commentPrompt(sample())];
    // Vulgarité, argot et anatomie : jamais dans un prompt (les mots « sexuel » et « anatomique » n'y figurent que comme interdictions).
    const anatomical = ["bite", "bites", "zob", "queue", "verge", "pénis", "penis", "kiki", "nouille", "chibre", "engin", "bander", "burne", "couille", "couilles", "gland", "organe"];
    for (const w of anatomical) expect(FORBIDDEN_TERMS).toContain(w);
    // Mot entier (le repère technique « sous_gland » du contrat de repérage n'est pas un mot du commentaire).
    for (const t of texts) for (const w of anatomical) expect(new RegExp(`(?<![\\p{L}_])${w}(?![\\p{L}_])`, "iu").test(t), `« ${w} » dans un prompt`).toBe(false);
    expect(SYSTEM_COMMENT).toMatch(/aucun chiffre/i);
    expect(SYSTEM_COMMENT).toMatch(/médical/i);
  });
});

function sample(over: Partial<CommentInput> = {}): CommentInput {
  return {
    formula: "B",
    state: "erect",
    score: 74,
    lengthPercentile: 55,
    girthPercentile: 60,
    marginPct: 11,
    symmetry: 94,
    curvatureDeg: 6,
    confidence: 90,
    cardFraction: 0.3,
    tiltDeg: 12,
    declaredGapFlagged: false,
    ...over,
  };
}

describe("consigne de rédaction : indicateurs en mots, jamais de mesure", () => {
  it("ne transmet aucune valeur en centimètres et demande le format fixe", () => {
    const p = commentPrompt(sample());
    expect(p).not.toMatch(/\bcm\b/);
    expect(p).toContain(`exactement ${OBSERVATION_COUNT} observations`);
    expect(p).toContain(String(OBSERVATION_MAX_CHARS));
    expect(p).toContain(String(VERDICT_MAX_CHARS));
    expect(p).toContain("zone médiane");
    expect(commentPrompt(sample({ lengthPercentile: 10 }))).toContain("longueur estimée dans la population de référence : partie basse");
    expect(commentPrompt(sample({ girthPercentile: 90 }))).toContain("circonférence estimée dans la population de référence : partie haute");
    expect(commentPrompt(sample({ declaredGapFlagged: true }))).toContain("vérifier la méthode de mesure");
  });
});

describe("validation du commentaire standardisé", () => {
  it("accepte exactement trois observations courtes et un verdict d'une phrase", () => {
    const c = validateCommentaire(validComment());
    expect(c).not.toBeNull();
    expect(c!.observations).toHaveLength(3);
    expect(validateComment({ json: validComment() })).toMatchObject({ ok: true, value: { schemaVersion: V, promptVersion: PROMPT_VERSION } });
  });

  it("rejette un chiffre, où qu'il soit", () => {
    for (const bad of ["Une observation avec 3 mots.", "La carte occupe 30 % de l'image.", "Mesure estimée 13,8 cm environ."]) {
      expect(validateCommentaire({ ...validComment(), observations: [SIMULATED_OBSERVATIONS[0], bad, SIMULATED_OBSERVATIONS[2]] })).toBeNull();
      expect(validateCommentaire({ ...validComment(), verdict: bad })).toBeNull();
    }
  });

  it("rejette 2 ou 4 observations, une observation vide ou trop longue, un verdict de deux phrases", () => {
    const v = validComment();
    expect(validateCommentaire({ ...v, observations: v.observations.slice(0, 2) })).toBeNull();
    expect(validateCommentaire({ ...v, observations: [...v.observations, v.observations[0]] })).toBeNull();
    expect(validateCommentaire({ ...v, observations: [v.observations[0], "", v.observations[2]] })).toBeNull();
    expect(validateCommentaire({ ...v, observations: [v.observations[0], "a".repeat(OBSERVATION_MIN_CHARS - 1), v.observations[2]] })).toBeNull();
    expect(validateCommentaire({ ...v, observations: [v.observations[0], "Le cadrage est net. " + "a".repeat(OBSERVATION_MAX_CHARS), v.observations[2]] })).toBeNull();
    expect(validateCommentaire({ ...v, verdict: "Première phrase sobre. Seconde phrase de trop." })).toBeNull();
    expect(validateCommentaire({ ...v, verdict: "Un verdict sans point final" })).toBeNull();
    expect(validateCommentaire({ ...v, verdict: "Un verdict qui se termine par un point d'exclamation !" })).not.toBeNull();
  });

  it("rejette une version de schéma absente ou différente, et des champs en trop", () => {
    const v = validComment();
    const { schemaVersion: _s, ...noVersion } = v;
    void _s;
    expect(validateCommentaire(noVersion)).toBeNull();
    expect(validateCommentaire({ ...v, schemaVersion: "photo-report/2" })).toBeNull();
    expect(validateCommentaire({ ...v, mesure: "treize" })).not.toBeNull(); // zod ignore les clés inconnues : le schéma API, lui, les interdit
    expect(validateCommentaire(null)).toBeNull();
    expect(validateCommentaire("texte libre")).toBeNull();
  });

  it("rejette les termes interdits (liste du code), mot entier seulement, insensible à la casse", () => {
    for (const w of ["petit", "Diagnostic", "organe", "cm", "Parfait", "médecin"]) {
      const text = `Une observation sobre avec le mot ${w} dedans.`;
      expect(textViolations(text).length, w).toBeGreaterThan(0);
      expect(validateCommentaire({ ...validComment(), verdict: text })).toBeNull();
    }
    expect(textViolations("Un profil habite ici, sans incident.")).toEqual([]); // « bite » n'est pas un mot entier ici
    expect(textViolations("Le repérage est de qualité et la carte est entière.")).toEqual([]);
    expect(FORBIDDEN_TERMS).toContain("diagnostic");
    expect(FORBIDDEN_TERMS).toContain("cm");
    expect(new Set(FORBIDDEN_TERMS).size).toBe(FORBIDDEN_TERMS.length); // aucun doublon
  });

  it("le commentaire simulé du dépôt est conforme (sinon toute la chaîne simulée serait fausse)", () => {
    expect(validateCommentaire(validComment())).not.toBeNull();
    for (const o of SIMULATED_OBSERVATIONS) expect(o.length).toBeLessThanOrEqual(OBSERVATION_MAX_CHARS);
    expect(SIMULATED_VERDICT.length).toBeLessThanOrEqual(VERDICT_MAX_CHARS);
  });
});

describe("validation de la recevabilité et du repérage", () => {
  it("recevabilité : version, booléen, motif de la liste fermée", () => {
    expect(validateRecevabilite({ schemaVersion: V, recevable: true, motif: "ok" })).toEqual({ schemaVersion: V, recevable: true, motif: "ok" });
    expect(validateRecevabilite({ schemaVersion: V, recevable: false, motif: "doute_majorite" })?.motif).toBe("doute_majorite");
    expect(validateRecevabilite({ recevable: true, motif: "ok" })).toBeNull();
    expect(validateRecevabilite({ schemaVersion: V, recevable: "oui", motif: "ok" })).toBeNull();
    expect(validateRecevabilite({ schemaVersion: V, recevable: false, motif: "motif_invente" })).toBeNull();
  });

  it("repérage : contrat de points inchangé (4 coins, 8 à 12 points, 5 hauteurs), version exigée, version retirée du résultat", async () => {
    const sim = createSimulatedVision("ok");
    const r = await sim.analyse(await flatImage());
    const rep = validateReperage(r.reperage);
    expect(rep).not.toBeNull();
    expect(rep!.coins_carte).toHaveLength(4);
    expect(rep!.bords).toHaveLength(5);
    expect(rep!.ligne_mediane.length).toBeGreaterThanOrEqual(8);
    expect("schemaVersion" in rep!).toBe(false);
    const { schemaVersion: _s, ...noVersion } = r.reperage as Record<string, unknown>;
    void _s;
    expect(validateReperage(noVersion)).toBeNull();
    expect(validateReperage({ schemaVersion: V, coins_carte: [] })).toBeNull();
    expect(validateAnalyse(r)).toMatchObject({ ok: true, value: { refused: false, recevable: true } });
    expect(validateAnalyse({ ...r, reperage: { schemaVersion: V, coins_carte: [] } })).toEqual({ ok: false, motif: "reperage_incomplet" });
    expect(validateAnalyse({ ...r, recevabilite: { recevable: true } })).toEqual({ ok: false, motif: "recevabilite_invalide" });
    expect(validateAnalyse({ ...r, refused: true })).toEqual({ ok: true, value: { refused: true } });
  });
});
