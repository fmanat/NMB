import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/paiement/plisio/route";
import { pool } from "@/lib/db";
import { isHiddenInBeta } from "@/lib/mode";
import { CheckoutError, startCheckout, startCheckoutWith } from "@/lib/payments/checkout";
import { paymentProviderFor } from "@/lib/payments";
import { createPlisioInvoice, invoiceParams, PLISIO_API, PLISIO_CURRENCIES, verifyPlisioCallback } from "@/lib/payments/plisio";
import { paymentAllowed, photoReportIsFree } from "@/lib/payments/policy";
import { buildQuestionnaireReport } from "@/lib/report";
import { createReport } from "@/lib/repo";
import { getReportView } from "@/lib/view";

const KEY = "cle-secrete-plisio-de-test";
const SITE = "https://bitometre.test";

/**
 * Notification telle que Plisio l'envoie à callback_url?json=true (champs de la documentation « Create an invoice », section 4),
 * signée comme l'exemple Node de la documentation : HMAC-SHA1 (clé secrète) de JSON.stringify de l'objet sans verify_hash.
 */
function callback(fields: Record<string, unknown>, key = KEY): string {
  const data: Record<string, unknown> = {
    txn_id: "5ee0e502283675293c450d0e",
    ipn_type: "invoice",
    merchant: "Bitometre",
    merchant_id: "65f0c1a2b3c4d5e6f7a8b9c0",
    amount: "0.00007632",
    currency: "BTC",
    order_name: "Rapport Bitomètre",
    confirmations: "1",
    source_currency: "EUR",
    source_rate: "65381.25",
    comment: "",
    invoice_commission: "0.00000038",
    invoice_sum: "0.00007632",
    invoice_total_sum: "0.00007632",
    ...fields,
  };
  // Calcul écrit à la main d'après la documentation, indépendamment du code testé.
  const copy = { ...data };
  delete copy.verify_hash;
  data.verify_hash = createHmac("sha1", key).update(JSON.stringify(copy)).digest("hex");
  return JSON.stringify(data);
}

describe("création de facture (d'après la documentation de Plisio)", () => {
  it("facture en euros, monnaies limitées, notification en JSON, boutons de retour vers le site", () => {
    const p = invoiceParams({ orderNumber: "123456789012345", amountCents: 499, currency: "EUR", siteUrl: SITE });
    expect(p).toMatchObject({
      source_currency: "EUR",
      source_amount: "4.99",
      order_number: "123456789012345",
      allowed_psys_cids: "BTC,ETH,USDT,USDC,LTC,SOL",
      callback_url: `${SITE}/api/paiement/plisio?json=true`,
      success_invoice_url: `${SITE}/paiement/retour`,
      fail_invoice_url: `${SITE}/paiement/retour?echec=1`,
    });
    expect(PLISIO_CURRENCIES).toEqual(["BTC", "ETH", "USDT", "USDC", "LTC", "SOL"]);
    expect(p).not.toHaveProperty("email"); // aucune donnée personnelle transmise
    expect(p).not.toHaveProperty("amount"); // le montant est en euros (source_amount), pas en cryptomonnaie
  });

  it("appel GET à l'API, clé secrète en paramètre api_key, adresse de la page hébergée renvoyée", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify({ status: "success", data: { txn_id: "abc123", invoice_url: "https://plisio.net/invoice/abc123" } }));
    });
    const r = await createPlisioInvoice({ amountCents: 499, currency: "EUR" }, { fetch: fetchMock as unknown as typeof fetch, key: KEY, siteUrl: SITE });
    const u = new URL(calls[0]);
    expect(u.origin + u.pathname).toBe(PLISIO_API);
    expect(u.searchParams.get("api_key")).toBe(KEY);
    expect(u.searchParams.get("order_number")).toBe(r.providerRef);
    expect(r.providerRef).toMatch(/^[1-9]\d{14}$/);
    expect(r.redirectUrl).toBe("https://plisio.net/invoice/abc123");
  });

  it("réponse d'erreur de Plisio, ou adresse de facture hors de plisio.net : refus", async () => {
    const err = vi.fn(async () => new Response(JSON.stringify({ status: "error", data: { name: "Bad Request", message: "Missing required attribute", code: 103 } }), { status: 400 }));
    await expect(createPlisioInvoice({ amountCents: 499, currency: "EUR" }, { fetch: err as unknown as typeof fetch, key: KEY, siteUrl: SITE })).rejects.toThrow("refusé");
    const evil = vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { txn_id: "x", invoice_url: "https://evil.test/invoice/x" } })));
    await expect(createPlisioInvoice({ amountCents: 499, currency: "EUR" }, { fetch: evil as unknown as typeof fetch, key: KEY, siteUrl: SITE })).rejects.toThrow("inattendue");
  });
});

describe("notification signée", () => {
  it("statut completed : paiement réussi, montant de la facture en euros, numéro de commande et numéro Plisio", () => {
    expect(verifyPlisioCallback(callback({ status: "completed", order_number: "123456789012345", source_amount: "4.99" }), KEY)).toEqual({
      type: "payment.succeeded",
      providerRef: "123456789012345",
      saleId: "5ee0e502283675293c450d0e",
      amountCents: 499,
      currency: "EUR",
    });
  });

  it("signature absente, fausse, calculée avec une autre clé, ou champ modifié après signature : refusé", () => {
    const ok = callback({ status: "completed", order_number: "1", source_amount: "4.99" });
    const noSig = JSON.parse(ok);
    delete noSig.verify_hash;
    expect(() => verifyPlisioCallback(JSON.stringify(noSig), KEY)).toThrow("Signature absente");
    expect(() => verifyPlisioCallback(callback({ status: "completed", order_number: "1", source_amount: "4.99" }, "autre-cle"), KEY)).toThrow("Signature invalide");
    const tampered = JSON.parse(ok);
    tampered.source_amount = "0.01";
    expect(() => verifyPlisioCallback(JSON.stringify(tampered), KEY)).toThrow("Signature invalide");
    expect(() => verifyPlisioCallback("pas du json", KEY)).toThrow("illisible");
  });

  it("paiement partiel (pending, au-delà de la tolérance), facture nouvelle, en cours ou remplacée (cancelled duplicate) : sans effet", () => {
    for (const status of ["new", "pending", "pending internal", "cancelled duplicate", "mismatch"])
      expect(verifyPlisioCallback(callback({ status, order_number: "1", source_amount: "4.99", pending_amount: "0.00003" }), KEY), status).toBeNull();
  });

  it("facture expirée, annulée ou en erreur : paiement en échec (rien n'est débloqué)", () => {
    for (const status of ["expired", "cancelled", "error"])
      expect(verifyPlisioCallback(callback({ status, order_number: "1", source_amount: "4.99" }), KEY)?.type, status).toBe("payment.failed");
  });

  it("autre type de notification (pas une facture) : sans effet ; succès sans devise de facture ou sans numéro de commande : refusé", () => {
    expect(verifyPlisioCallback(callback({ ipn_type: "cash-in", status: "completed", order_number: "1" }), KEY)).toBeNull();
    expect(() => verifyPlisioCallback(callback({ status: "completed", order_number: "1", source_currency: undefined, source_amount: "4.99" }), KEY)).toThrow("Devise");
    expect(() => verifyPlisioCallback(callback({ status: "completed", source_amount: "4.99" }), KEY)).toThrow("order_number");
  });
});

describe("documentation", () => {
  it("PLISIO_SECRET_KEY est documentée dans .env.example (ligne NOM=) et dans le README", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(".env.example", "utf8")).toMatch(/^PLISIO_SECRET_KEY=$/m);
    expect(readFileSync("README.md", "utf8")).toContain("`PLISIO_SECRET_KEY`");
  });
});

describe("qui paie quoi pendant la bêta", () => {
  const BETA = { FREE_BETA: "on", PLISIO_SECRET_KEY: KEY };
  it("questionnaire toujours gratuit en bêta ; formule photo payante par Plisio dès que la clé est renseignée, gratuite sinon", () => {
    expect(paymentAllowed("A", BETA)).toBe(false);
    expect(paymentAllowed("B", BETA)).toBe(true);
    expect(paymentAllowed("B", { FREE_BETA: "on" })).toBe(false);
    expect(photoReportIsFree(true, BETA)).toBe(false);
    expect(photoReportIsFree(true, { FREE_BETA: "on" })).toBe(true);
    expect(paymentAllowed("A", {})).toBe(true); // hors bêta : prestataire général
  });
  it("page de paiement masquée en bêta sans la clé ; ouverte avec la clé ; prestataire général et CGV toujours masqués en bêta", () => {
    expect(isHiddenInBeta("/paiement/x", { FREE_BETA: "on" })).toBe(true);
    expect(isHiddenInBeta("/paiement/x", BETA)).toBe(false);
    expect(isHiddenInBeta("/api/payments/webhook", BETA)).toBe(true);
    expect(isHiddenInBeta("/cgv", BETA)).toBe(true);
  });
});

// --- Intégration : création, notification, déblocage ---

const TABLES = "TRUNCATE payments, reports, analysis_attempts, report_log, stat_events, webhook_deliveries, funnel_events CASCADE";
const input = { state: "erect", length: 14, girth: 12, curvature: "none", direction: "none" } as const;
const results = buildQuestionnaireReport(input);

function enablePlisio() {
  vi.stubEnv("FREE_BETA", "on");
  vi.stubEnv("PAYMENT_PROVIDER", "simulation");
  vi.stubEnv("PLISIO_SECRET_KEY", KEY);
  vi.stubEnv("SITE_URL", SITE);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (!url.startsWith(PLISIO_API)) throw new Error("appel réseau inattendu");
      return new Response(JSON.stringify({ status: "success", data: { txn_id: "5ee0e502283675293c450d0e", invoice_url: "https://plisio.net/invoice/5ee0e502283675293c450d0e" } }));
    }),
  );
}

async function photoPayment(): Promise<{ id: string; order: string }> {
  const id = await createReport({ formula: "B", input, results, ipHash: null, freeBeta: false });
  const started = await startCheckoutWith(id, true);
  expect(started.external).toBe(true);
  expect(started.url).toBe("https://plisio.net/invoice/5ee0e502283675293c450d0e");
  expect(started.url).not.toContain(id);
  const row = (await pool().query("SELECT provider, provider_ref, amount_cents FROM payments WHERE report_id = $1", [id])).rows[0];
  expect(row.provider).toBe("plisio");
  expect(row.amount_cents).toBe(499);
  return { id, order: row.provider_ref };
}
const send = (body: string) => POST(new Request(`${SITE}/api/paiement/plisio?json=true`, { method: "POST", body, headers: { "content-type": "application/json" } }));
const status = async (id: string) => (await getReportView(id)).status;
const paymentStatus = async (id: string) => (await pool().query("SELECT status FROM payments WHERE report_id = $1", [id])).rows[0].status as string;

beforeEach(async () => {
  await pool().query(TABLES);
  enablePlisio();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
afterAll(async () => {
  await pool().query(TABLES);
  await pool().end();
});

describe("Plisio : parcours complet", () => {
  it("rapport photo : facture Plisio ; questionnaire en bêta : paiement refusé", async () => {
    await photoPayment();
    expect(paymentProviderFor("B").id).toBe("plisio");
    const q = await createReport({ formula: "A", input, results, ipHash: null, freeBeta: true });
    await expect(startCheckout(q, true)).rejects.toBeInstanceOf(CheckoutError);
  });

  it("notification completed : rapport débloqué ; rejouée : aucun double effet", async () => {
    const { id, order } = await photoPayment();
    expect(await status(id)).toBe("locked");
    const body = callback({ status: "completed", order_number: order, source_amount: "4.99" });
    expect((await send(body)).status).toBe(200);
    expect(await status(id)).toBe("unlocked");
    const paidAt = (await pool().query("SELECT paid_at FROM reports WHERE id = $1", [id])).rows[0].paid_at;
    expect((await send(body)).status).toBe(200);
    expect((await send(body)).status).toBe(200);
    expect((await pool().query("SELECT paid_at FROM reports WHERE id = $1", [id])).rows[0].paid_at).toEqual(paidAt);
    expect((await pool().query("SELECT count(*)::int AS n FROM payments WHERE status = 'succeeded'")).rows[0].n).toBe(1);
    expect((await pool().query("SELECT provider_sale_id FROM payments WHERE report_id = $1", [id])).rows[0].provider_sale_id).toBe("5ee0e502283675293c450d0e");
  });

  it("signature invalide : 422, rien n'est lu ni débloqué", async () => {
    const { id, order } = await photoPayment();
    const res = await send(callback({ status: "completed", order_number: order, source_amount: "4.99" }, "mauvaise-cle"));
    expect(res.status).toBe(422);
    expect(await status(id)).toBe("locked");
    expect(await paymentStatus(id)).toBe("pending");
  });

  it("paiement partiel au-delà de la tolérance (pending) : rien n'est débloqué, le paiement reste en attente", async () => {
    const { id, order } = await photoPayment();
    expect((await send(callback({ status: "pending", order_number: order, source_amount: "4.99", amount: "0.00003", pending_amount: "0.00004632" }))).status).toBe(200);
    expect(await status(id)).toBe("locked");
    expect(await paymentStatus(id)).toBe("pending");
  });

  it("facture expirée puis annulée : rien n'est débloqué ; un paiement complet arrivé ensuite débloque quand même", async () => {
    const { id, order } = await photoPayment();
    expect((await send(callback({ status: "expired", order_number: order, source_amount: "4.99", amount: "0.00001" }))).status).toBe(200);
    expect(await status(id)).toBe("locked");
    expect(await paymentStatus(id)).toBe("failed");
    expect((await send(callback({ status: "cancelled", order_number: order, source_amount: "4.99" }))).status).toBe(200);
    expect(await status(id)).toBe("locked");
    await send(callback({ status: "completed", order_number: order, source_amount: "4.99" }));
    expect(await status(id)).toBe("unlocked");
  });

  it("montant incorrect (facture d'un autre montant ou d'une autre devise) : rien n'est débloqué, paiement en échec", async () => {
    const { id, order } = await photoPayment();
    await send(callback({ status: "completed", order_number: order, source_amount: "0.99" }));
    expect(await status(id)).toBe("locked");
    expect(await paymentStatus(id)).toBe("failed");
    const other = await photoPayment();
    await send(callback({ status: "completed", order_number: other.order, source_amount: "4.99", source_currency: "USD" }));
    expect(await status(other.id)).toBe("locked");
  });

  it("commande inconnue (signée) : 200 sans effet ; sans la clé, l'adresse de notification n'existe pas (404)", async () => {
    const { id } = await photoPayment();
    expect((await send(callback({ status: "completed", order_number: "999999999999999", source_amount: "4.99" }))).status).toBe(200);
    expect(await status(id)).toBe("locked");
    vi.stubEnv("PLISIO_SECRET_KEY", "");
    expect((await send(callback({ status: "completed", order_number: "1", source_amount: "4.99" }))).status).toBe(404);
  });

  it("Plisio indisponible : message clair, aucun paiement enregistré", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erreur", { status: 500 })));
    const id = await createReport({ formula: "B", input, results, ipHash: null, freeBeta: false });
    await expect(startCheckout(id, true)).rejects.toThrow("momentanément indisponible");
    expect((await pool().query("SELECT count(*)::int AS n FROM payments")).rows[0].n).toBe(0);
  });
});
