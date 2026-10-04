import type { FormulaId } from "@/config/site";
import { plisioConfigured, plisioProvider } from "./plisio";
import { isPhotoFormula } from "./policy";
import { simulationProvider } from "./simulation";
import { stripeProvider } from "./stripe";
import { verotelProvider } from "./verotel";
import type { PaymentProvider } from "./types";

// Pour ajouter un prestataire réel : créer un fichier qui implémente PaymentProvider,
// l'ajouter ici et renseigner PAYMENT_PROVIDER dans .env.
export function getPaymentProvider(): PaymentProvider {
  const id = process.env.PAYMENT_PROVIDER ?? "simulation";
  if (id === "simulation") return simulationProvider;
  if (id === "stripe") return stripeProvider; // exclu définitivement par le propriétaire : laissé désactivé, jamais utilisé
  if (id === "verotel") return verotelProvider;
  throw new Error(`Prestataire de paiement inconnu : ${id}`);
}

/** Prestataire d'un rapport donné : Plisio pour la formule photo dès que PLISIO_SECRET_KEY est renseignée, sinon le prestataire général. */
export function paymentProviderFor(formula: FormulaId): PaymentProvider {
  if (isPhotoFormula(formula) && plisioConfigured()) return plisioProvider;
  return getPaymentProvider();
}
