import { getReport, priceCents, recordPayment, setWaiverAccepted } from "../repo";
import { paymentProviderFor } from "./index";
import { paymentAllowed } from "./policy";

export class CheckoutError extends Error {}

/**
 * Démarre un paiement. La case de renonciation au droit de rétractation est obligatoire
 * (Code de la consommation, art. L221-28, 13°) et son horodatage est conservé.
 */
export async function startCheckout(reportId: string, waiverAccepted: boolean): Promise<string> {
  return (await startCheckoutWith(reportId, waiverAccepted)).url;
}

/** Comme startCheckout, et dit si le prestataire est externe (page de paiement hors du site). */
export async function startCheckoutWith(reportId: string, waiverAccepted: boolean): Promise<{ url: string; external: boolean }> {
  if (!waiverAccepted) throw new CheckoutError("Vous devez accepter l'accès immédiat et la renonciation au droit de rétractation.");
  const report = await getReport(reportId);
  if (!report) throw new CheckoutError("Rapport introuvable.");
  if (!paymentAllowed(report.formula)) throw new CheckoutError("Le paiement est désactivé : le service est gratuit pendant la bêta.");
  if (report.paid) throw new CheckoutError("Ce rapport est déjà débloqué.");
  if (report.relocked_at) throw new CheckoutError("Ce rapport a été remboursé ou contesté : il ne peut pas être repayé.");

  await setWaiverAccepted(reportId);
  const provider = paymentProviderFor(report.formula);
  const amountCents = priceCents(report.formula);
  let checkout;
  try {
    checkout = await provider.createCheckout({ reportId, amountCents, currency: "EUR" });
  } catch (e) {
    if (provider.id === "plisio") throw new CheckoutError("Le paiement est momentanément indisponible. Réessayez dans quelques minutes.");
    throw e;
  }
  await recordPayment({ reportId, formula: report.formula, provider: provider.id, providerRef: checkout.providerRef, amountCents });
  return { url: checkout.redirectUrl, external: provider.id !== "simulation" };
}
