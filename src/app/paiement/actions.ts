"use server";

import { redirect } from "next/navigation";
import { CheckoutError, startCheckout } from "@/lib/payments/checkout";
import { handleWebhook } from "@/lib/payments/confirm";
import { signSimulated } from "@/lib/payments/simulation";
import { getPaymentProvider } from "@/lib/payments";
import { pool } from "@/lib/db";

export type PayState = { error?: string };

export async function pay(reportId: string, _prev: PayState, fd: FormData): Promise<PayState> {
  let url: string;
  try {
    url = await startCheckout(reportId, fd.get("waiver") === "on");
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    throw e;
  }
  redirect(url);
}

/**
 * Mode simulation uniquement : joue le rôle du prestataire et envoie une notification signée
 * au même code que le vrai webhook. Sans effet hors PAYMENT_PROVIDER=simulation.
 */
export async function simulatePaymentSuccess(reportId: string, providerRef: string): Promise<void> {
  if (getPaymentProvider().id !== "simulation") throw new Error("Simulation désactivée");
  const { rows } = await pool().query(
    "SELECT amount_cents, currency FROM payments WHERE provider_ref = $1 AND report_id = $2",
    [providerRef, reportId],
  );
  if (!rows[0]) throw new Error("Paiement introuvable");
  const body = JSON.stringify({
    type: "payment.succeeded",
    providerRef,
    amountCents: rows[0].amount_cents,
    currency: rows[0].currency,
  });
  await handleWebhook(body, signSimulated(body));
  redirect(`/r/${reportId}?retour=1`);
}
