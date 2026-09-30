export type CheckoutRequest = {
  reportId: string;
  amountCents: number;
  currency: "EUR";
};

export type Checkout = {
  providerRef: string;
  redirectUrl: string;
};

export type PaymentEvent = {
  type: "payment.succeeded" | "payment.failed";
  providerRef: string;
  amountCents: number;
  currency: string;
};

/** Interface à implémenter pour chaque prestataire de paiement réel. */
export interface PaymentProvider {
  id: string;
  createCheckout(req: CheckoutRequest): Promise<Checkout>;
  /** Vérifie l'authenticité d'une notification reçue du prestataire. Lève une erreur si invalide. */
  verifyWebhook(rawBody: string, signature: string | null): PaymentEvent;
}
