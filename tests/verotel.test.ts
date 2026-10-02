import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/payments/webhook/route";
import { pool } from "@/lib/db";
import { dashboardStats } from "@/lib/admin/stats";
import { CheckoutError, startCheckout } from "@/lib/payments/checkout";
import { handleWebhook } from "@/lib/payments/confirm";
import { getPaymentProvider } from "@/lib/payments";
import { PAY_COOKIE, returnTarget } from "@/lib/payments/return";
import { amountToCents, flexpaySignature, purchaseUrl, verifyPostback, VEROTEL_PROTOCOL_VERSION } from "@/lib/payments/verotel";
import { buildQuestionnaireReport } from "@/lib/report";
import { completedAnalysisStats, createReport, purgeExpired, reportKey } from "@/lib/repo";
import { getReportView } from "@/lib/view";

const SHOP = "68849";
const KEY = "zpXwe2D77g4P7ysGJcr3rY87TBYs6J"; // valeurs du jeu d'essai du client officiel de Verotel (tests/VerotelFlexPayClientTest.php)
const cfg = { shopId: SHOP, secret: KEY };

const sign = (p: Record<string, string>) => ({ ...p, signature: flexpaySignature(p, KEY, SHOP) });
const qs = (p: Record<string, string>) => "?" + new URLSearchParams(p).toString();
/** Notification « vente acceptée » telle que Verotel l'enverrait (paramètres d'après la bibliothèque tierce documentée dans verotel.ts). */
const initial = (ref: string, over: Record<string, string> = {}) =>
  sign({ event: "initial", saleID: "777001", referenceID: ref, priceAmount: "2.99", priceCurrency: "EUR", type: "purchase", shopID: SHOP, ...over });

describe("signature FlexPay (client officiel Verotel)", () => {
  // Jeu d'essai du dépôt officiel (tests/VerotelFlexPayClientTest.php, test_validate_signature__returns_true_for_old_sha1_signature) :
  // la signature SHA-1 « fc63f38e… » est celle que le client officiel accepte pour ces paramètres, ce secret et ce shopID.
  const officialParams = {
    saleID: "433456",
    priceAmount: "0.00",
    referenceID: "reference1234",
    priceCurrency: "USD",
    custom1: "My",
    description: "My Dščřčřřěřě&?=blah123",
    subscriptionType: "RECURRING",
    period: "P1M",
    name: "My name",
    trialAmount: "0.01",
    trialPeriod: "P3D",
    successURL: "http://backURL.test",
    declineURL: "http://declineURL.test",
    cancelDiscountPercentage: "30",
    blah: "something",
  };
  it("reproduit exactement la signature SHA-1 du jeu d'essai officiel (ordre des paramètres, séparateurs, shopID ajouté)", () => {
    expect(flexpaySignature(officialParams, KEY, SHOP, "sha1")).toBe("fc63f38e2722d2e5bc4f2044ad3ffb2051e89643");
  });
  it("la signature SHA-256 suit la même construction, écrite ici à la main", () => {
    const p = { priceCurrency: "EUR", priceAmount: "2.99" };
    const manual = createHash("sha256").update(`${KEY}:priceAmount=2.99:priceCurrency=EUR:shopID=${SHOP}`).digest("hex");
    expect(flexpaySignature(p, KEY, SHOP)).toBe(manual);
    // « signature » n'entre pas dans le calcul ; un shopID déjà présent n'est pas ajouté deux fois.
    expect(flexpaySignature({ ...p, signature: "x" }, KEY, SHOP)).toBe(manual);
    expect(flexpaySignature({ ...p, shopID: SHOP }, KEY, SHOP)).toBe(manual);
  });
  it("trie par nom en comparant les octets (majuscules avant minuscules), comme PHP ksort", () => {
    const manual = createHash("sha256").update(`${KEY}:Zeta=1:alpha=2:shopID=${SHOP}`).digest("hex");
    expect(flexpaySignature({ alpha: "2", Zeta: "1" }, KEY, SHOP)).toBe(manual);
  });
});

describe("URL d'achat", () => {
  const url = new URL(
    purchaseUrl(
      { priceAmount: "2.99", priceCurrency: "EUR", description: "Rapport d'analyse Bitomètre", referenceID: "nmb_abc", successURL: "https://x.test/paiement/retour", declineURL: "https://x.test/paiement/retour?echec=1" },
      cfg,
    ),
  );
  it("pointe vers la page de paiement hébergée de Verotel, version 4, type purchase, shopID", () => {
    expect(url.origin + url.pathname).toBe("https://secure.verotel.com/startorder");
    const p = Object.fromEntries(url.searchParams);
    expect(p).toMatchObject({ type: "purchase", version: VEROTEL_PROTOCOL_VERSION, shopID: SHOP, priceAmount: "2.99", priceCurrency: "EUR", referenceID: "nmb_abc" });
    expect(p.description).toBe("Rapport d'analyse Bitomètre");
  });
  it("sa signature est celle du client officiel (calculée sur tous les paramètres sauf elle-même)", () => {
    const p = Object.fromEntries(url.searchParams);
    expect(p.signature).toBe(flexpaySignature(p, KEY, SHOP));
    expect(Array.from(url.searchParams.keys()).at(-1)).toBe("signature");
  });
  it("modifier un paramètre invaliderait la signature (montant inchangé par un tiers)", () => {
    const p = Object.fromEntries(url.searchParams);
    expect(flexpaySignature({ ...p, priceAmount: "0.01" }, KEY, SHOP)).not.toBe(p.signature);
  });
});

describe("notification signée (postback)", () => {
  it("vente acceptée : événement de paiement réussi avec montant en centimes", () => {
    expect(verifyPostback(qs(initial("nmb_ref1")), cfg)).toEqual({ type: "payment.succeeded", providerRef: "nmb_ref1", saleId: "777001", amountCents: 299, currency: "EUR" });
  });
  it("accepte « amount » / « currency » à la place de « priceAmount » / « priceCurrency » ; refuse s'ils se contredisent", () => {
    const ok = sign({ event: "initial", saleID: "1", referenceID: "r", amount: "4.99", currency: "eur", shopID: SHOP });
    expect(verifyPostback(qs(ok), cfg)).toMatchObject({ amountCents: 499, currency: "EUR" });
    const bad = sign({ event: "initial", saleID: "1", referenceID: "r", amount: "4.99", priceAmount: "2.99", priceCurrency: "EUR", shopID: SHOP });
    expect(() => verifyPostback(qs(bad), cfg)).toThrow("Montants incohérents");
  });
  it("achat unique sans paramètre « event » mais type=purchase et saleID : accepté (À CONFIRMER chez Verotel) ; sans saleID : ignoré", () => {
    expect(verifyPostback(qs(sign({ type: "purchase", saleID: "5", referenceID: "r", priceAmount: "2.99", priceCurrency: "EUR", shopID: SHOP })), cfg)?.type).toBe("payment.succeeded");
    expect(verifyPostback(qs(sign({ type: "purchase", referenceID: "r", priceAmount: "2.99", priceCurrency: "EUR", shopID: SHOP })), cfg)).toBeNull();
  });
  it("remboursement (credit) et contestation (chargeback)", () => {
    expect(verifyPostback(qs(sign({ event: "credit", saleID: "9", referenceID: "r", shopID: SHOP })), cfg)).toMatchObject({ type: "payment.refunded", providerRef: "r", saleId: "9" });
    expect(verifyPostback(qs(sign({ event: "chargeback", saleID: "9", shopID: SHOP })), cfg)).toMatchObject({ type: "payment.chargeback", providerRef: "", saleId: "9" });
    expect(() => verifyPostback(qs(sign({ event: "credit", shopID: SHOP })), cfg)).toThrow("Aucune référence de vente");
  });
  it("autres événements (rebill, cancel, expiry…) : authentiques mais sans effet", () => {
    for (const event of ["rebill", "cancel", "uncancel", "expiry", "extend", "downgrade", "upgrade"]) expect(verifyPostback(qs(sign({ event, saleID: "1", referenceID: "r", shopID: SHOP })), cfg)).toBeNull();
  });
  it("signature absente, fausse, ou paramètre modifié après signature : refusé", () => {
    const good = initial("nmb_ref1");
    const { signature: _s, ...unsigned } = good;
    void _s;
    expect(() => verifyPostback(qs(unsigned), cfg)).toThrow("Signature absente");
    expect(() => verifyPostback(qs({ ...good, signature: "0".repeat(64) }), cfg)).toThrow("Signature invalide");
    expect(() => verifyPostback(qs({ ...good, priceAmount: "0.01" }), cfg)).toThrow("Signature invalide");
    expect(() => verifyPostback(qs({ ...good, referenceID: "autre" }), cfg)).toThrow("Signature invalide");
    expect(() => verifyPostback(qs(good), { shopId: SHOP, secret: "mauvais-secret" })).toThrow("Signature invalide");
  });
  it("signature SHA-1 (ancien format) : refusée par défaut, acceptée seulement si activée expressément", () => {
    const p = { event: "initial", saleID: "1", referenceID: "r", priceAmount: "2.99", priceCurrency: "EUR", shopID: SHOP };
    const legacy = { ...p, signature: flexpaySignature(p, KEY, SHOP, "sha1") };
    expect(() => verifyPostback(qs(legacy), cfg)).toThrow("Signature invalide");
    expect(verifyPostback(qs(legacy), { ...cfg, acceptSha1: true })?.type).toBe("payment.succeeded");
  });
  it("shopID d'une autre boutique : refusé, même correctement signé ; paramètre répété : refusé ; montant mal formé : refusé", () => {
    expect(() => verifyPostback(qs(sign({ event: "initial", saleID: "1", referenceID: "r", priceAmount: "2.99", priceCurrency: "EUR", shopID: "1" })), cfg)).toThrow("shopID inattendu");
    expect(() => verifyPostback(qs(initial("r")) + "&referenceID=autre", cfg)).toThrow();
    for (const bad of ["2,99", "-2.99", "abc", "2.999", "", "1e3"]) {
      expect(() => verifyPostback(qs(sign({ event: "initial", saleID: "1", referenceID: "r", priceAmount: bad, priceCurrency: "EUR", shopID: SHOP })), cfg), bad).toThrow();
    }
    expect(amountToCents("0.5")).toBe(50);
  });
});

describe("retour du client (sans transmettre l'adresse du rapport au prestataire)", () => {
  const id = "a".repeat(43);
  it("destination selon le cookie ; refus d'un cookie mal formé (pas de redirection ouverte)", () => {
    expect(PAY_COOKIE).toBe("nmb_pay");
    expect(returnTarget(id, false)).toBe(`/r/${id}?retour=1`);
    expect(returnTarget(id, true)).toBe(`/paiement/${id}`);
    for (const bad of [undefined, "", "court", "https://evil.test/", "../../x", id + "/../x", "a b".repeat(20)]) expect(returnTarget(bad, false)).toBeNull();
  });
});

// --- Intégration avec la base : déblocage, rejeu, montant, remboursement, contestation ---

const TABLES = "TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, funnel_events CASCADE";
const input = { state: "erect", length: 14, girth: 12, curvature: "none", direction: "none" } as const;

function enableVerotel() {
  vi.stubEnv("PAYMENT_PROVIDER", "verotel");
  vi.stubEnv("VEROTEL_SHOP_ID", SHOP);
  vi.stubEnv("VEROTEL_SIGNATURE_KEY", KEY);
  vi.stubEnv("SITE_URL", "https://bitometre.test");
}

async function startPayment(): Promise<{ id: string; ref: string; url: URL }> {
  const id = await createReport({ formula: "A", input, results: buildQuestionnaireReport(input), ipHash: null });
  const redirect = await startCheckout(id, true);
  const ref = (await pool().query("SELECT provider_ref FROM payments WHERE report_id = $1", [id])).rows[0].provider_ref as string;
  return { id, ref, url: new URL(redirect) };
}
const post = (query: string) => handleWebhook(query, null);
const statusOf = async (id: string) => (await pool().query("SELECT status FROM payments WHERE report_id = $1", [id])).rows[0].status as string;
const view = async (id: string) => (await getReportView(id)).status;

beforeEach(async () => {
  await pool().query(TABLES);
  enableVerotel();
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await pool().query(TABLES);
  await pool().end();
});

describe("Verotel : désactivé sans ses variables", () => {
  it("sans VEROTEL_SHOP_ID ou clé : erreur claire à la création du paiement et à la notification", async () => {
    vi.stubEnv("VEROTEL_SHOP_ID", "");
    const id = await createReport({ formula: "A", input, results: buildQuestionnaireReport(input), ipHash: null });
    await expect(startCheckout(id, true)).rejects.toThrow("Verotel désactivé : VEROTEL_SHOP_ID");
    vi.stubEnv("VEROTEL_SHOP_ID", SHOP);
    vi.stubEnv("VEROTEL_SIGNATURE_KEY", "");
    expect(() => getPaymentProvider().verifyWebhook("?a=b", null)).toThrow("Verotel désactivé : VEROTEL_SIGNATURE_KEY");
  });
  it("base de l'URL en https obligatoire", async () => {
    vi.stubEnv("VEROTEL_BASE_URL", "http://secure.verotel.test");
    const id = await createReport({ formula: "A", input, results: buildQuestionnaireReport(input), ipHash: null });
    await expect(startCheckout(id, true)).rejects.toThrow("https");
  });
});

describe("Verotel : parcours de paiement", () => {
  it("création : référence aléatoire, montant TTC de la formule, aucun identifiant de rapport transmis à Verotel", async () => {
    const { id, ref, url } = await startPayment();
    expect(url.origin + url.pathname).toBe("https://secure.verotel.com/startorder");
    const p = Object.fromEntries(url.searchParams);
    expect(p.referenceID).toBe(ref);
    expect(ref).toMatch(/^nmb_[0-9a-f]{32}$/);
    expect(p.priceAmount).toBe("2.99");
    expect(p.priceCurrency).toBe("EUR");
    expect(p.successURL).toBe("https://bitometre.test/paiement/retour");
    expect(p.declineURL).toBe("https://bitometre.test/paiement/retour?echec=1");
    expect(url.toString()).not.toContain(id); // l'adresse privée du rapport ne part jamais chez le prestataire
    expect(p.signature).toBe(flexpaySignature(p, KEY, SHOP));
    expect(await view(id)).toBe("locked");
  });

  it("notification valide : le rapport est débloqué, une seule fois ; le numéro de vente est conservé", async () => {
    const { id, ref } = await startPayment();
    expect(await post(qs(initial(ref)))).toEqual({ ok: true, alreadyConfirmed: false });
    expect(await view(id)).toBe("unlocked");
    expect((await pool().query("SELECT provider_sale_id FROM payments WHERE report_id = $1", [id])).rows[0].provider_sale_id).toBe("777001");
    expect((await completedAnalysisStats()).count).toBe(1); // rapport débloqué par le paiement : compte comme analyse réalisée
  });

  it("notification rejouée : sans double effet", async () => {
    const { id, ref } = await startPayment();
    const q = qs(initial(ref));
    await post(q);
    expect(await post(q)).toEqual({ ok: true, alreadyConfirmed: true });
    expect((await pool().query("SELECT count(*)::int AS n FROM payments WHERE status = 'succeeded'")).rows[0].n).toBe(1);
    expect(await view(id)).toBe("unlocked");
  });

  it("signature invalide : rien n'est débloqué ; montant incorrect : paiement en échec, rapport verrouillé", async () => {
    const { id, ref } = await startPayment();
    await expect(post(qs({ ...initial(ref), signature: "0".repeat(64) }))).rejects.toThrow("Signature invalide");
    expect(await view(id)).toBe("locked");
    expect(await post(qs(initial(ref, { priceAmount: "0.01" })))).toEqual({ ok: false, reason: "amount_mismatch" });
    expect(await view(id)).toBe("locked");
    expect(await statusOf(id)).toBe("failed");
  });

  it("référence inconnue (signée) : aucun effet", async () => {
    await startPayment();
    expect(await post(qs(initial("nmb_inconnue")))).toEqual({ ok: false, reason: "unknown_payment" });
  });

  it("remboursement : le rapport se reverrouille, le journal et le bandeau ne le comptent plus, rejeu sans effet", async () => {
    const { id, ref } = await startPayment();
    await post(qs(initial(ref)));
    expect(await view(id)).toBe("unlocked");
    const refund = qs(sign({ event: "credit", saleID: "777001", referenceID: ref, shopID: SHOP }));
    expect(await post(refund)).toEqual({ ok: true, relocked: true, alreadyRelocked: false });
    expect(await view(id)).toBe("locked");
    const v = await getReportView(id);
    expect(v.status === "locked" && v.relocked).toBe(true);
    expect(await statusOf(id)).toBe("refunded");
    const row = (await pool().query("SELECT paid, paid_at, relocked_at FROM reports WHERE id = $1", [id])).rows[0];
    expect(row.paid).toBe(false);
    expect(row.paid_at).toBeNull();
    expect(row.relocked_at).not.toBeNull();
    expect((await pool().query("SELECT paid_at FROM report_log WHERE key = $1", [reportKey(id)])).rows[0].paid_at).toBeNull();
    expect(await post(refund)).toEqual({ ok: true, relocked: false, alreadyRelocked: true });
    // Revenu : le paiement remboursé n'est plus compté ; il apparaît à part.
    const d = await dashboardStats(null);
    expect(d.revenue.total.grossCents).toBe(0);
    expect(d.refunds).toEqual({ refunded: 1, disputed: 0, cents: 299 });
  });

  it("une notification de succès rejouée APRÈS un remboursement ne redébloque jamais le rapport", async () => {
    const { id, ref } = await startPayment();
    const success = qs(initial(ref));
    await post(success);
    await post(qs(sign({ event: "credit", saleID: "777001", referenceID: ref, shopID: SHOP })));
    await post(success);
    expect(await view(id)).toBe("locked");
    expect(await statusOf(id)).toBe("refunded");
  });

  it("remboursement qui ne porte que le numéro de vente : retrouvé par ce numéro", async () => {
    const { id, ref } = await startPayment();
    await post(qs(initial(ref)));
    await post(qs(sign({ event: "credit", saleID: "777001", shopID: SHOP })));
    expect(await view(id)).toBe("locked");
    expect(await statusOf(id)).toBe("refunded");
  });

  it("contestation (chargeback) : rapport reverrouillé ; une contestation après remboursement garde le statut le plus grave", async () => {
    const { id, ref } = await startPayment();
    await post(qs(initial(ref)));
    await post(qs(sign({ event: "chargeback", saleID: "777001", referenceID: ref, shopID: SHOP })));
    expect(await view(id)).toBe("locked");
    expect(await statusOf(id)).toBe("disputed");
    await post(qs(sign({ event: "credit", saleID: "777001", referenceID: ref, shopID: SHOP })));
    expect(await statusOf(id)).toBe("disputed"); // un remboursement tardif n'« adoucit » pas une contestation

    const b = await startPayment();
    await post(qs(initial(b.ref, { saleID: "888" })));
    await post(qs(sign({ event: "credit", saleID: "888", referenceID: b.ref, shopID: SHOP })));
    await post(qs(sign({ event: "chargeback", saleID: "888", referenceID: b.ref, shopID: SHOP })));
    expect(await statusOf(b.id)).toBe("disputed");
  });

  it("remboursement d'un paiement jamais confirmé chez nous : ignoré", async () => {
    const { id, ref } = await startPayment();
    expect(await post(qs(sign({ event: "credit", saleID: "1", referenceID: ref, shopID: SHOP })))).toEqual({ ok: false, reason: "ignored_event" });
    expect(await statusOf(id)).toBe("pending");
  });

  it("un rapport reverrouillé ne peut pas être repayé et est conservé 30 jours avant purge", async () => {
    const { id, ref } = await startPayment();
    await post(qs(initial(ref)));
    await post(qs(sign({ event: "credit", saleID: "777001", referenceID: ref, shopID: SHOP })));
    await expect(startCheckout(id, true)).rejects.toBeInstanceOf(CheckoutError);
    await pool().query("UPDATE reports SET created_at = now() - interval '5 days' WHERE id = $1", [id]);
    await purgeExpired();
    expect(await view(id)).toBe("locked"); // encore là (non payé depuis 24 h, mais reverrouillé)
    await pool().query("UPDATE reports SET relocked_at = now() - interval '31 days' WHERE id = $1", [id]);
    await purgeExpired();
    expect(await view(id)).toBe("not_found");
  });
});

describe("Verotel : adresse de notification (GET)", () => {
  const call = (query: string) => GET(new Request("https://bitometre.test/api/payments/webhook" + query));

  it("notification valide : « OK » et rapport débloqué ; rejeu : « OK » sans double effet", async () => {
    const { id, ref } = await startPayment();
    const q = qs(initial(ref));
    const r1 = await call(q);
    expect([r1.status, await r1.text()]).toEqual([200, "OK"]);
    expect(await view(id)).toBe("unlocked");
    const r2 = await call(q);
    expect([r2.status, await r2.text()]).toEqual([200, "OK"]);
  });
  it("signature invalide : erreur 500 (comme l'exemple officiel), rien débloqué", async () => {
    const { id, ref } = await startPayment();
    const r = await call(qs({ ...initial(ref), signature: "0".repeat(64) }));
    expect(r.status).toBe(500);
    expect(await r.text()).toBe("ERROR - Invalid signature!");
    expect(await view(id)).toBe("locked");
    expect((await call("")).status).toBe(500);
  });
  it("montant incorrect, événement inutile ou paiement inconnu : « OK » (pas de renvoi en boucle) mais aucun déblocage", async () => {
    const { id, ref } = await startPayment();
    for (const q of [qs(initial(ref, { priceAmount: "0.01" })), qs(sign({ event: "rebill", saleID: "1", referenceID: ref, shopID: SHOP })), qs(initial("nmb_inconnue"))]) {
      const r = await call(q);
      expect([r.status, await r.text()]).toEqual([200, "OK"]);
    }
    expect(await view(id)).toBe("locked");
  });
  it("avec un autre prestataire de paiement : 404", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "simulation");
    expect((await call("?x=1")).status).toBe(404);
  });
});
