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
  /** refunded : remboursement ; chargeback : contestation bancaire. Les deux reverrouillent le rapport. */
  type: "payment.succeeded" | "payment.failed" | "payment.refunded" | "payment.chargeback";
  /** Référence du paiement chez nous (peut être vide pour un remboursement qui ne porte que le numéro de vente). */
  providerRef: string;
  /** Numéro de vente chez le prestataire, s'il en fournit un. */
  saleId?: string;
  /** Non utilisé pour un remboursement ou une contestation. */
  amountCents: number;
  currency: string;
};

/** Interface à implémenter pour chaque prestataire de paiement réel. */
export interface PaymentProvider {
  id: string;
  createCheckout(req: CheckoutRequest): Promise<Checkout>;
  /**
   * Vérifie l'authenticité d'une notification reçue du prestataire. Lève une erreur si la signature ou le format est invalide.
   * Renvoie null pour une notification authentique mais sans intérêt pour le site (autre type d'événement) : elle est acquittée sans effet.
   */
  verifyWebhook(rawBody: string, signature: string | null): PaymentEvent | null;
}
