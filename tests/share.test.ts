import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "@/lib/db";
import { attachFriend, createChallenge, getChallengeState, getInvite, withdraw, ChallengeError } from "@/lib/challenge";
import { buildQuestionnaireReport, type QuestionnaireInput, type ReportResults } from "@/lib/report";
import { createReport, getReport, purgeExpired } from "@/lib/repo";
import { buildCardContent, createCard, deleteCard, dossierNumber, getCard, listCards, ShareError, topPercent, MAX_CARDS_PER_REPORT } from "@/lib/share";

const input: QuestionnaireInput = { state: "erect", length: 15, girth: 12, curvature: "none", direction: "none" };
const resultsA: ReportResults = buildQuestionnaireReport(input);
const resultsB: ReportResults = { ...buildQuestionnaireReport({ ...input, length: 12.5 }), formula: "B" };

async function report(results: ReportResults = resultsA, paid = true) {
  const id = await createReport({ formula: results.formula, input, results, ipHash: null });
  if (paid) await pool().query("UPDATE reports SET paid = true, paid_at = now() WHERE id = $1", [id]);
  return id;
}

beforeEach(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts CASCADE");
});
afterAll(async () => {
  await pool().query("TRUNCATE payments, reports, analysis_attempts CASCADE");
  await pool().end();
});

describe("contenu de la carte de partage", () => {
  it("score seul par défaut, rien d'autre", () => {
    const c = buildCardContent(resultsA, "r".repeat(43), { mode: "score" });
    expect(c.score).toBe(resultsA.score);
    expect(c.percentiles).toEqual([]);
    expect(c.landmark).toBeNull();
    const json = JSON.stringify(c);
    for (const hidden of ["comment", "girth", "length", "curvature", "symmetry", "everyday"]) expect(json).not.toContain(hidden);
  });

  it("mentionne les valeurs déclarées pour la formule A, l'analyse photo pour B et C", () => {
    expect(buildCardContent(resultsA, "x".repeat(43), { mode: "score" }).basis).toBe("declared");
    expect(buildCardContent(resultsB, "x".repeat(43), { mode: "score" }).basis).toBe("photo");
  });

  it("jusqu'à deux percentiles, en « top X % » arrondi à l'entier supérieur, jamais flatté", () => {
    expect(topPercent(88)).toBe(12);
    expect(topPercent(87.6)).toBe(13); // 12,4 -> 13
    expect(topPercent(99.9)).toBe(1); // minimum 1 %
    expect(topPercent(50)).toBe(50);
    const c = buildCardContent(resultsA, "x".repeat(43), { mode: "percentiles", percentiles: ["length", "girth"] });
    expect(c.percentiles.map((p) => p.label)).toEqual(["Longueur", "Circonférence"]);
    expect(c.percentiles[0].topPct).toBe(topPercent(resultsA.length.percentile));
  });

  it("refuse 0 percentile, des doublons sont ignorés, option inconnue refusée", () => {
    expect(() => buildCardContent(resultsA, "x".repeat(43), { mode: "percentiles", percentiles: [] })).toThrow(ShareError);
    expect(buildCardContent(resultsA, "x".repeat(43), { mode: "percentiles", percentiles: ["length", "length"] }).percentiles).toHaveLength(1);
    expect(() => buildCardContent(resultsA, "x".repeat(43), { mode: "percentiles", percentiles: ["autre" as never] })).toThrow(ShareError);
    expect(() => buildCardContent(resultsA, "x".repeat(43), { mode: "nimporte" as never })).toThrow(ShareError);
  });

  it("une mesure de référence OU des percentiles, jamais les deux", () => {
    const c = buildCardContent(resultsA, "x".repeat(43), { mode: "landmark", landmark: "Tour Eiffel", percentiles: ["length"] });
    expect(c.landmark?.label).toBe("Tour Eiffel");
    expect(c.percentiles).toEqual([]);
    expect(() => buildCardContent(resultsA, "x".repeat(43), { mode: "landmark", landmark: "Lune" })).toThrow(ShareError);
  });

  it("numéro de dossier à 4 chiffres, stable", () => {
    const n = dossierNumber("abc".repeat(15));
    expect(n).toBeGreaterThanOrEqual(1000);
    expect(n).toBeLessThanOrEqual(9999);
    expect(dossierNumber("abc".repeat(15))).toBe(n);
  });
});

describe("cartes en base", () => {
  it("impossible de créer une carte pour un rapport non débloqué", async () => {
    const id = await report(resultsA, false);
    await expect(createCard(id, { mode: "score" })).rejects.toBeInstanceOf(ShareError);
  });

  it("la lecture publique ne renvoie que l'instantané, avec un identifiant d'au moins 16 caractères", async () => {
    const id = await report();
    const cardId = await createCard(id, { mode: "score" });
    expect(cardId.length).toBeGreaterThanOrEqual(16);
    const card = await getCard(cardId);
    expect(card?.score).toBe(resultsA.score);
    expect(JSON.stringify(card)).not.toContain(id);
    expect(await getCard("court")).toBeNull();
    expect(await getCard("x".repeat(20))).toBeNull();
  });

  it("supprimer le rapport supprime ses cartes ; une carte peut être retirée seule", async () => {
    const id = await report();
    const a = await createCard(id, { mode: "score" });
    const b = await createCard(id, { mode: "landmark", landmark: "Mont Blanc" });
    await deleteCard(id, a);
    expect((await listCards(id)).map((c) => c.id)).toEqual([b]);
    await pool().query("DELETE FROM reports WHERE id = $1", [id]);
    expect(await getCard(b)).toBeNull();
  });

  it("un autre rapport ne peut pas supprimer la carte", async () => {
    const id = await report();
    const other = await report();
    const cardId = await createCard(id, { mode: "score" });
    await deleteCard(other, cardId);
    expect(await getCard(cardId)).not.toBeNull();
  });

  it("nombre de cartes limité par rapport", async () => {
    const id = await report();
    for (let i = 0; i < MAX_CARDS_PER_REPORT; i++) await createCard(id, { mode: "score" });
    await expect(createCard(id, { mode: "score" })).rejects.toBeInstanceOf(ShareError);
  });
});

describe("défi entre amis", () => {
  it("le lien de défi exige un rapport débloqué et reste le même ensuite", async () => {
    const locked = await report(resultsA, false);
    await expect(createChallenge(locked)).rejects.toBeInstanceOf(ChallengeError);
    const id = await report();
    const c1 = await createChallenge(id);
    expect(c1.length).toBeGreaterThanOrEqual(16);
    expect(await createChallenge(id)).toBe(c1);
  });

  it("l'invitation ne révèle rien sur le créateur", async () => {
    const id = await report();
    const c = await createChallenge(id);
    const invite = await getInvite(c);
    expect(invite).toEqual({ available: true });
    expect(await getInvite("inconnu-inconnu-inconnu")).toBeNull();
    expect(await getInvite("court")).toBeNull();
  });

  it("l'ami relève le défi une seule fois, pas avec le rapport du créateur", async () => {
    const creator = await report();
    const c = await createChallenge(creator);
    expect(await attachFriend(c, creator)).toBe(false);
    const friend = await report(resultsB, false);
    expect(await attachFriend(c, friend)).toBe(true);
    const other = await report();
    expect(await attachFriend(c, other)).toBe(false); // déjà relevé
    expect(await getInvite(c)).toEqual({ available: false });
    expect(await attachFriend("x".repeat(22), other)).toBe(false);
    expect(await attachFriend(c, "n".repeat(43))).toBe(false); // rapport inexistant
  });

  it("un rapport ne peut être l'ami que d'un seul défi", async () => {
    const c1 = await createChallenge(await report());
    const c2 = await createChallenge(await report());
    const friend = await report();
    expect(await attachFriend(c1, friend)).toBe(true);
    expect(await attachFriend(c2, friend)).toBe(false);
  });

  it("aucune donnée de l'autre tant que les deux rapports ne sont pas payés", async () => {
    const creator = await report();
    const c = await createChallenge(creator);
    expect((await getChallengeState(creator)).status).toBe("creator_waiting_friend");
    const friend = await report(resultsB, false);
    await attachFriend(c, friend);
    const s = await getChallengeState(creator);
    expect(s.status).toBe("waiting_payment");
    expect(JSON.stringify(s)).not.toContain("score");
    expect((await getChallengeState(friend)).status).toBe("waiting_payment");
  });

  it("comparaison visible des deux côtés quand les deux sont payés, avec la base déclarée/photo", async () => {
    const creator = await report(resultsA);
    const c = await createChallenge(creator);
    const friend = await report(resultsB, false);
    await attachFriend(c, friend);
    await pool().query("UPDATE reports SET paid = true WHERE id = $1", [friend]);

    const s1 = await getChallengeState(creator);
    const s2 = await getChallengeState(friend);
    expect(s1.status).toBe("ready");
    expect(s2.status).toBe("ready");
    if (s1.status === "ready" && s2.status === "ready") {
      expect(s1.me.score).toBe(resultsA.score);
      expect(s1.other.score).toBe(resultsB.score);
      expect(s1.me.basis).toBe("declared");
      expect(s1.other.basis).toBe("photo");
      expect(s2.me.score).toBe(resultsB.score);
      expect(s2.other.score).toBe(resultsA.score);
      // uniquement score et percentiles : pas de mesures en centimètres, pas de commentaire
      const json = JSON.stringify(s1.other);
      expect(Object.keys(s1.other).sort()).toEqual(["basis", "girthPercentile", "lengthPercentile", "score"]);
      expect(json).not.toContain("comment");
    }
  });

  it("un participant qui se retire coupe la comparaison des deux côtés", async () => {
    const creator = await report();
    const c = await createChallenge(creator);
    const friend = await report(resultsB);
    await attachFriend(c, friend);
    expect((await getChallengeState(creator)).status).toBe("ready");

    await withdraw(friend);
    expect((await getChallengeState(friend)).status).toBe("withdrawn_self");
    const s = await getChallengeState(creator);
    expect(s.status).toBe("withdrawn_other");
    expect(JSON.stringify(s)).not.toContain("score");
  });

  it("le créateur qui se retire rend le défi indisponible pour un nouvel ami", async () => {
    const creator = await report();
    const c = await createChallenge(creator);
    await withdraw(creator);
    expect(await getInvite(c)).toEqual({ available: false });
    expect(await attachFriend(c, await report())).toBe(false);
  });

  it("un rapport étranger au défi ne voit rien", async () => {
    const creator = await report();
    await createChallenge(creator);
    expect((await getChallengeState(await report())).status).toBe("none");
  });

  it("supprimer le rapport d'un participant supprime ou rouvre le défi", async () => {
    const creator = await report();
    const c = await createChallenge(creator);
    const friend = await report();
    await attachFriend(c, friend);
    await pool().query("DELETE FROM reports WHERE id = $1", [friend]);
    expect(await getInvite(c)).toEqual({ available: true }); // le défi redevient disponible
    await pool().query("DELETE FROM reports WHERE id = $1", [creator]);
    expect(await getInvite(c)).toBeNull();
  });

  it("le rapport non payé de l'ami, purgé après 24 h, rouvre le défi", async () => {
    const creator = await report();
    const c = await createChallenge(creator);
    const friend = await report(resultsB, false);
    await attachFriend(c, friend);
    await pool().query("UPDATE reports SET created_at = now() - interval '25 hours' WHERE id = $1", [friend]);
    await purgeExpired();
    expect(await getReport(friend)).toBeNull();
    expect(await getInvite(c)).toEqual({ available: true });
  });
});
