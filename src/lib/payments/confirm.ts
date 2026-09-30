import { pool } from "../db";
import { reportKey } from "../repo";
import { getPaymentProvider } from "./index";

export type ConfirmResult =
  | { ok: true; alreadyConfirmed: boolean }
  | { ok: false; reason: "unknown_payment" | "amount_mismatch" | "failed_event" | "ignored_event" };

/**
 * Seul point d'entrée qui débloque un rapport. Il n'est appelé que par une notification
 * du prestataire dont la signature a été vérifiée côté serveur.
 */
export async function handleWebhook(rawBody: string, signature: string | null): Promise<ConfirmResult> {
  const event = getPaymentProvider().verifyWebhook(rawBody, signature); // lève une erreur si invalide
  if (!event) return { ok: false, reason: "ignored_event" };

  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT id, report_id, amount_cents, currency, status FROM payments WHERE provider_ref = $1 FOR UPDATE",
      [event.providerRef],
    );
    const payment = rows[0];
    if (!payment) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "unknown_payment" };
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
    if (event.amountCents !== payment.amount_cents || event.currency !== payment.currency) {
      await client.query("UPDATE payments SET status = 'failed' WHERE id = $1", [payment.id]);
      await client.query("COMMIT");
      return { ok: false, reason: "amount_mismatch" };
    }
    await client.query("UPDATE payments SET status = 'succeeded', confirmed_at = now() WHERE id = $1", [payment.id]);
    if (payment.report_id) {
      await client.query("UPDATE reports SET paid = true, paid_at = now() WHERE id = $1", [payment.report_id]);
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
