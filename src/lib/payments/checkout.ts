import { getReport, priceCents, recordPayment, setWaiverAccepted } from "../repo";
import { getPaymentProvider } from "./index";

export class CheckoutError extends Error {}

/**
 * Démarre un paiement. La case de renonciation au droit de rétractation est obligatoire
 * (Code de la consommation, art. L221-28, 13°) et son horodatage est conservé.
 */
export async function startCheckout(reportId: string, waiverAccepted: boolean): Promise<string> {
  if (!waiverAccepted) throw new CheckoutError("Vous devez accepter l'accès immédiat et la renonciation au droit de rétractation.");
  const report = await getReport(reportId);
  if (!report) throw new CheckoutError("Rapport introuvable.");
  if (report.paid) throw new CheckoutError("Ce rapport est déjà débloqué.");

  await setWaiverAccepted(reportId);
  const provider = getPaymentProvider();
  const amountCents = priceCents(report.formula);
  const checkout = await provider.createCheckout({ reportId, amountCents, currency: "EUR" });
  await recordPayment({ reportId, formula: report.formula, provider: provider.id, providerRef: checkout.providerRef, amountCents });
  return checkout.redirectUrl;
}
