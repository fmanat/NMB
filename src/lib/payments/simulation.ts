import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentEvent, PaymentProvider } from "./types";

function secret(): string {
  const s = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!s) throw new Error("PAYMENT_WEBHOOK_SECRET manquant");
  return s;
}

export function signSimulated(rawBody: string): string {
  return createHmac("sha256", secret()).update(rawBody).digest("hex");
}

/** Prestataire fictif pour le développement et les tests. Interdit en production. */
export const simulationProvider: PaymentProvider = {
  id: "simulation",

  async createCheckout({ reportId }) {
    if (process.env.NODE_ENV === "production") throw new Error("Paiement simulé interdit en production");
    const providerRef = "sim_" + randomBytes(16).toString("hex");
    return { providerRef, redirectUrl: `/paiement/${reportId}/simulation?ref=${providerRef}` };
  },

  verifyWebhook(rawBody, signature) {
    if (process.env.NODE_ENV === "production") throw new Error("Paiement simulé interdit en production");
    if (!signature) throw new Error("Signature absente");
    const expected = Buffer.from(signSimulated(rawBody), "hex");
    const given = Buffer.from(signature, "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new Error("Signature invalide");
    }
    const event = JSON.parse(rawBody) as PaymentEvent;
    if (!event.providerRef || !Number.isInteger(event.amountCents)) throw new Error("Événement invalide");
    return event;
  },
};
