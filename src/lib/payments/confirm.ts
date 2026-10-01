import { pool } from "../db";
import { reportKey } from "../repo";
import { getPaymentProvider } from "./index";

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: true; relocked: boolean; alreadyRelocked: boolean }
  | { ok: false; reason: "unknown_payment" | "amount_mismatch" | "failed_event" | "ignored_event" };

/**
 * Seul point d'entrée qui débloque ou reverrouille un rapport. Il n'est appelé que par une notification
 * du prestataire dont la signature a été vérifiée côté serveur.
 *  - paiement réussi : déblocage (une seule fois, montant vérifié) ;
 *  - remboursement ou contestation : le rapport se reverrouille (conservé 30 jours, voir purgeExpired).
 */
export async function handleWebhook(rawBody: string, signature: string | null): Promise<ConfirmResult> {
  const event = getPaymentProvider().verifyWebhook(rawBody, signature); // lève une erreur si invalide
  if (!event) return { ok: false, reason: "ignored_event" };

  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    // Le paiement est retrouvé par notre référence, ou à défaut (remboursement) par le numéro de vente du prestataire.
    const { rows } = event.providerRef
      ? await client.query("SELECT id, report_id, amount_cents, currency, status FROM payments WHERE provider_ref = $1 FOR UPDATE", [event.providerRef])
      : event.saleId
        ? await client.query("SELECT id, report_id, amount_cents, currency, status FROM payments WHERE provider_sale_id = $1 FOR UPDATE", [event.saleId])
        : { rows: [] };
    const payment = rows[0];
    if (!payment) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unknown_payment" };
    }

    if (event.type === "payment.refunded" || event.type === "payment.chargeback") {
      const target = event.type === "payment.refunded" ? "refunded" : "disputed";
      if (payment.status === "refunded" || payment.status === "disputed") {
        // Notification rejouée ou double événement (remboursement puis contestation) : un contesté reste « disputed » (le plus grave).
        if (target === "disputed" && payment.status === "refunded") await client.query("UPDATE payments SET status = 'disputed' WHERE id = $1", [payment.id]);
        await client.query("COMMIT");
        return { ok: true, relocked: false, alreadyRelocked: true };
      }
      if (payment.status !== "succeeded") {
        // Remboursement d'un paiement jamais confirmé chez nous : on ne devine rien.
        await client.query("COMMIT");
        return { ok: false, reason: "ignored_event" };
      }
      await client.query("UPDATE payments SET status = $2, refunded_at = now() WHERE id = $1", [payment.id, target]);
      if (payment.report_id) {
        await client.query("UPDATE reports SET paid = false, paid_at = NULL, relocked_at = now() WHERE id = $1", [payment.report_id]);
        // Le journal anonyme ne compte plus ce rapport comme payé (bandeau, conversion).
        await client.query("UPDATE report_log SET paid_at = NULL WHERE key = $1", [reportKey(payment.report_id)]);
      }
      await client.query("COMMIT");
      return { ok: true, relocked: true, alreadyRelocked: false };
    }

    if (event.type === "payment.failed") {
      if (payment.status === "pending") {
        await client.query("UPDATE payments SET status = 'failed' WHERE id = $1", [payment.id]);
      }
      await client.query("COMMIT");
      return { ok: false, reason: "failed_event" };
    }
    if (payment.status === "succeeded") {
      await client.query("COMMIT");
      return { ok: true, alreadyConfirmed: true };
    }
    if (payment.status === "refunded" || payment.status === "disputed") {
      // Une notification de succès rejouée après un remboursement ne doit jamais redébloquer le rapport.
      await client.query("COMMIT");
      return { ok: true, alreadyConfirmed: true };
    }
    if (event.amountCents !== payment.amount_cents || event.currency !== payment.currency) {
      await client.query("UPDATE payments SET status = 'failed' WHERE id = $1", [payment.id]);
      await client.query("COMMIT");
      return { ok: false, reason: "amount_mismatch" };
    }
    await client.query("UPDATE payments SET status = 'succeeded', confirmed_at = now(), provider_sale_id = COALESCE($2, provider_sale_id) WHERE id = $1", [payment.id, event.saleId ?? null]);
    if (payment.report_id) {
      await client.query("UPDATE reports SET paid = true, paid_at = now(), relocked_at = NULL WHERE id = $1", [payment.report_id]);
      await client.query("UPDATE report_log SET paid_at = now() WHERE key = $1 AND paid_at IS NULL", [reportKey(payment.report_id)]);
    }
    await client.query("COMMIT");
    return { ok: true, alreadyConfirmed: false };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
