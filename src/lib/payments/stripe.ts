import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentEvent, PaymentProvider } from "./types";

/**
 * Adaptateur Stripe (page de paiement hébergée « Checkout »), sans bibliothèque : appels HTTP directs.
 * D'après la documentation publique : https://docs.stripe.com/api/checkout/sessions/create (création),
 * https://docs.stripe.com/webhooks (signature `Stripe-Signature`, schéma v1, HMAC-SHA256 de « horodatage.corps »).
 *
 * Désactivé tant que STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET ne sont pas renseignées : toute utilisation lève alors une erreur claire.
 * Apple Pay et Google Pay apparaissent sur la page hébergée selon la configuration du compte Stripe (à vérifier à l'ouverture du compte).
 * Stripe recueille lui-même l'adresse e-mail du client pour son reçu ; le site ne la reçoit pas et ne la lit jamais.
 */

const API = "https://api.stripe.com/v1/checkout/sessions";
const TIMEOUT_MS = 20_000;
export const STRIPE_TOLERANCE_SECONDS = 300;

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Stripe désactivé : ${name} n'est pas renseignée.`);
  return v;
}

function siteUrl(): string {
  return need("SITE_URL").replace(/\/$/, "");
}

type Session = { id?: string; url?: string; error?: { message?: string } };

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createCheckout({ reportId, amountCents, currency }) {
    const key = need("STRIPE_SECRET_KEY");
    const base = siteUrl();
    const form = new URLSearchParams({
      mode: "payment",
      locale: "fr",
      success_url: `${base}/r/${reportId}?retour=1`,
      cancel_url: `${base}/paiement/${reportId}`,
      client_reference_id: reportId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][price_data][product_data][name]": "Rapport d'analyse Bitomètre",
      "metadata[report_id]": reportId,
    });

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(API, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/x-www-form-urlencoded",
          "idempotency-key": `checkout-${reportId}-${randomUUID()}`,
        },
        body: form,
        signal: ctl.signal,
      });
    } catch (e) {
      throw new Error(ctl.signal.aborted ? "Stripe : délai dépassé" : `Stripe : erreur réseau (${String((e as Error).message ?? e)})`);
    } finally {
      clearTimeout(timer);
    }
    let json: Session = {};
    try {
      json = (await res.json()) as Session;
    } catch {
      /* corps illisible : traité ci-dessous */
    }
    if (!res.ok || !json.id || !json.url) {
      // Le message de Stripe ne contient ni clé ni donnée personnelle ; il est tronqué par prudence.
      throw new Error(`Stripe : création du paiement refusée (HTTP ${res.status}) ${(json.error?.message ?? "").slice(0, 160)}`.trim());
    }
    return { providerRef: json.id, redirectUrl: json.url };
  },

  verifyWebhook(rawBody, signatureHeader, now = Date.now()): PaymentEvent | null {
    const secret = need("STRIPE_WEBHOOK_SECRET");
    if (!signatureHeader) throw new Error("Signature absente");

    // En-tête : « t=1492774577,v1=5257a8…,v1=… » (plusieurs v1 possibles pendant une rotation de secret).
    let t = "";
    const candidates: string[] = [];
    for (const part of signatureHeader.split(",")) {
      const [k, v] = part.trim().split("=");
      if (k === "t") t = v ?? "";
      else if (k === "v1" && v) candidates.push(v);
    }
    if (!/^\d+$/.test(t) || candidates.length === 0) throw new Error("Signature mal formée");
    if (Math.abs(now / 1000 - Number(t)) > STRIPE_TOLERANCE_SECONDS) throw new Error("Horodatage hors tolérance (rejeu possible)");

    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
    const valid = candidates.some((c) => {
      const given = Buffer.from(c, "hex");
      return given.length === expected.length && timingSafeEqual(given, expected);
    });
    if (!valid) throw new Error("Signature invalide");

    const event = JSON.parse(rawBody) as { type?: string; data?: { object?: { id?: string; amount_total?: number; currency?: string; payment_status?: string } } };
    const obj = event.data?.object;
    const build = (type: PaymentEvent["type"]): PaymentEvent => {
      if (!obj?.id || !Number.isInteger(obj.amount_total) || !obj.currency) throw new Error("Événement invalide");
      return { type, providerRef: obj.id, amountCents: obj.amount_total as number, currency: obj.currency.toUpperCase() };
    };
    switch (event.type) {
      case "checkout.session.completed":
        // Paiement différé (ex. prélèvement) : « completed » n'est pas « payé ». On attend l'événement asynchrone.
        return obj?.payment_status === "paid" ? build("payment.succeeded") : null;
      case "checkout.session.async_payment_succeeded":
        return build("payment.succeeded");
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        return build("payment.failed");
      default:
        return null; // événement authentique mais inutile au site
    }
  },
};
