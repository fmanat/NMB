import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pool } from "@/lib/db";
import { startCheckout } from "@/lib/payments/checkout";
import { handleWebhook } from "@/lib/payments/confirm";
import { getPaymentProvider } from "@/lib/payments";
import { stripeProvider } from "@/lib/payments/stripe";
import { buildQuestionnaireReport } from "@/lib/report";
import { createReport, priceCents } from "@/lib/repo";
import { getReportView } from "@/lib/view";

// Réponses simulées fidèles à la documentation de Stripe (Checkout Session, événements de webhook, en-tête Stripe-Signature).
// Aucun appel réseau, aucune clé réelle.

const WHSEC = "whsec_test_secret_for_unit_tests";
const input = { state: "erect", length: 14, girth: 12, curvature: "light", direction: "left" } as const;

const header = (raw: string, t = Math.floor(Date.now() / 1000), secret = WHSEC) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;

const event = (type: string, obj: Record<string, unknown>) => JSON.stringify({ id: "evt_1", object: "event", type, data: { object: obj } });
const session = (id: string, over: Record<string, unknown> = {}) => ({ id, object: "checkout.session", amount_total: 299, currency: "eur", payment_status: "paid", ...over });

beforeEach(async () => {
  process.env.PAYMENT_PROVIDER = "stripe";
  process.env.STRIPE_SECRET_KEY = "sk_test_unit";
  process.env.STRIPE_WEBHOOK_SECRET = WHSEC;
  process.env.SITE_URL = "https://exemple.test";
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  process.env.PAYMENT_PROVIDER = "simulation";
  await pool().query("TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries CASCADE");
  await pool().end();
});

describe("Stripe : désactivé sans variables", () => {
  it("sans clé ou sans secret de webhook, toute utilisation échoue avec un message clair", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    await expect(stripeProvider.createCheckout({ reportId: "r", amountCents: 299, currency: "EUR" })).rejects.toThrow(/STRIPE_SECRET_KEY/);
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(() => stripeProvider.verifyWebhook("{}", "t=1,v1=00")).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it("PAYMENT_PROVIDER=stripe sélectionne l'adaptateur", () => {
    expect(getPaymentProvider().id).toBe("stripe");
  });
});

describe("Stripe : création du paiement", () => {
  it("envoie la bonne requête (montant, devise, retours, identifiant) et renvoie l'identifiant de session et l'adresse de paiement", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "cs_test_abc", url: "https://checkout.stripe.com/c/pay/cs_test_abc" }), { status: 200 });
    });
    const out = await stripeProvider.createCheckout({ reportId: "REPORT43", amountCents: 499, currency: "EUR" });
    expect(out).toEqual({ providerRef: "cs_test_abc", redirectUrl: "https://checkout.stripe.com/c/pay/cs_test_abc" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk_test_unit");
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["idempotency-key"]).toMatch(/^checkout-REPORT43-/);
    const body = new URLSearchParams(String(calls[0].init.body));
    expect(body.get("mode")).toBe("payment");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("499");
    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(body.get("success_url")).toBe("https://exemple.test/r/REPORT43?retour=1");
    expect(body.get("cancel_url")).toBe("https://exemple.test/paiement/REPORT43");
    expect(body.get("client_reference_id")).toBe("REPORT43");
    // Aucune donnée de mesure ni de photo n'est envoyée à Stripe.
    expect(String(calls[0].init.body)).not.toMatch(/length|girth|score|photo/i);
  });

  it("erreur de Stripe, réponse sans adresse, délai dépassé : erreur claire sans la clé", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "Invalid API Key provided: sk_test_unit" } }), { status: 401 }));
    await expect(stripeProvider.createCheckout({ reportId: "r", amountCents: 299, currency: "EUR" })).rejects.toThrow(/HTTP 401/);

    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ id: "cs_1" }), { status: 200 }));
    await expect(stripeProvider.createCheckout({ reportId: "r", amountCents: 299, currency: "EUR" })).rejects.toThrow(/refusée/);

    vi.stubGlobal("fetch", async () => {
      throw new Error("réseau coupé");
    });
    await expect(stripeProvider.createCheckout({ reportId: "r", amountCents: 299, currency: "EUR" })).rejects.toThrow(/réseau/);
  });
});

describe("Stripe : signature et événements", () => {
  it("accepte un événement signé et le traduit (identifiant de session, montant, devise en majuscules)", () => {
    const raw = event("checkout.session.completed", session("cs_1", { amount_total: 499 }));
    expect(stripeProvider.verifyWebhook(raw, header(raw))).toEqual({ type: "payment.succeeded", providerRef: "cs_1", amountCents: 499, currency: "EUR" });
  });

  it("refuse : signature absente, mal formée, fausse, secret différent, corps modifié", () => {
    const raw = event("checkout.session.completed", session("cs_1"));
    expect(() => stripeProvider.verifyWebhook(raw, null)).toThrow(/absente/);
    expect(() => stripeProvider.verifyWebhook(raw, "n'importe quoi")).toThrow(/mal formée/);
    expect(() => stripeProvider.verifyWebhook(raw, `t=${Math.floor(Date.now() / 1000)},v1=${"00".repeat(32)}`)).toThrow(/invalide/);
    expect(() => stripeProvider.verifyWebhook(raw, header(raw, undefined, "whsec_autre"))).toThrow(/invalide/);
    expect(() => stripeProvider.verifyWebhook(raw + " ", header(raw))).toThrow(/invalide/);
  });

  it("refuse un horodatage hors tolérance (notification rejouée plus tard), accepte pendant la tolérance", () => {
    const raw = event("checkout.session.completed", session("cs_1"));
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(() => stripeProvider.verifyWebhook(raw, header(raw, old))).toThrow(/tolérance/);
    const recent = Math.floor(Date.now() / 1000) - 120;
    expect(stripeProvider.verifyWebhook(raw, header(raw, recent))?.type).toBe("payment.succeeded");
  });

  it("accepte plusieurs signatures v1 (rotation de secret) si l'une est valide", () => {
    const raw = event("checkout.session.completed", session("cs_1"));
    const t = Math.floor(Date.now() / 1000);
    const good = createHmac("sha256", WHSEC).update(`${t}.${raw}`).digest("hex");
    expect(stripeProvider.verifyWebhook(raw, `t=${t},v1=${"ab".repeat(32)},v1=${good}`)?.providerRef).toBe("cs_1");
  });

  it("paiement différé : « completed » non payé est ignoré, l'événement asynchrone réussi débloque, l'échec et l'expiration échouent", () => {
    const unpaid = event("checkout.session.completed", session("cs_1", { payment_status: "unpaid" }));
    expect(stripeProvider.verifyWebhook(unpaid, header(unpaid))).toBeNull();
    const ok = event("checkout.session.async_payment_succeeded", session("cs_1"));
    expect(stripeProvider.verifyWebhook(ok, header(ok))?.type).toBe("payment.succeeded");
    const ko = event("checkout.session.async_payment_failed", session("cs_1"));
    expect(stripeProvider.verifyWebhook(ko, header(ko))?.type).toBe("payment.failed");
    const exp = event("checkout.session.expired", session("cs_1", { payment_status: "unpaid" }));
    expect(stripeProvider.verifyWebhook(exp, header(exp))?.type).toBe("payment.failed");
  });

  it("événement authentique mais inutile : ignoré ; événement incomplet : erreur", () => {
    const other = event("charge.refunded", { id: "ch_1" });
    expect(stripeProvider.verifyWebhook(other, header(other))).toBeNull();
    const bad = event("checkout.session.completed", { id: "cs_1", payment_status: "paid" });
    expect(() => stripeProvider.verifyWebhook(bad, header(bad))).toThrow(/invalide/);
  });
});

describe("Stripe : déblocage du rapport de bout en bout (base réelle, Stripe simulé)", () => {
  async function pending() {
    const id = await createReport({ formula: "A", input, results: buildQuestionnaireReport(input), ipHash: null });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ id: "cs_live_like_1", url: "https://checkout.stripe.com/c/pay/cs_live_like_1" }), { status: 200 }));
    const url = await startCheckout(id, true);
    expect(url).toContain("checkout.stripe.com");
    return id;
  }

  it("seul l'événement signé débloque ; rejoué, il n'a aucun effet de plus ; montant faux : refusé", async () => {
    const id = await pending();
    expect((await getReportView(id)).status).toBe("locked");

    // Événement non signé : erreur, rapport toujours verrouillé.
    const raw = event("checkout.session.completed", session("cs_live_like_1", { amount_total: priceCents("A") }));
    await expect(handleWebhook(raw, null)).rejects.toThrow();
    expect((await getReportView(id)).status).toBe("locked");

    // Événement d'un autre type : acquitté sans effet.
    const other = event("charge.succeeded", { id: "ch_1" });
    expect(await handleWebhook(other, header(other))).toEqual({ ok: false, reason: "ignored_event" });
    expect((await getReportView(id)).status).toBe("locked");

    // Montant falsifié : refusé.
    const wrong = event("checkout.session.completed", session("cs_live_like_1", { amount_total: 1 }));
    expect(await handleWebhook(wrong, header(wrong))).toEqual({ ok: false, reason: "amount_mismatch" });
    expect((await getReportView(id)).status).toBe("locked");
  });

  it("événement valide : débloque une seule fois ; rejeu identique : déjà confirmé", async () => {
    const id = await pending();
    const raw = event("checkout.session.completed", session("cs_live_like_1", { amount_total: priceCents("A") }));
    expect(await handleWebhook(raw, header(raw))).toEqual({ ok: true, alreadyConfirmed: false });
    expect((await getReportView(id)).status).toBe("unlocked");
    const before = (await pool().query("SELECT confirmed_at FROM payments WHERE report_id = $1", [id])).rows;
    expect(await handleWebhook(raw, header(raw))).toEqual({ ok: true, alreadyConfirmed: true });
    const after = (await pool().query("SELECT confirmed_at FROM payments WHERE report_id = $1", [id])).rows;
    expect(after).toEqual(before);
  });

  it("événement de session inconnue : refusé sans rien débloquer", async () => {
    const id = await pending();
    const raw = event("checkout.session.completed", session("cs_inconnue", { amount_total: priceCents("A") }));
    expect(await handleWebhook(raw, header(raw))).toEqual({ ok: false, reason: "unknown_payment" });
    expect((await getReportView(id)).status).toBe("locked");
  });
});
