import type { FormulaId } from "@/config/site";
import { isFreeBeta, isPhotoBeta } from "../mode";
import { plisioConfigured } from "./plisio";

// Qui paie quoi, et avec quel prestataire (décision du propriétaire du 04/10/2026) :
//  - le questionnaire (formule A) reste gratuit pendant la bêta (FREE_BETA=on) ;
//  - la formule photo est payante par Plisio (cryptomonnaie) dès que PLISIO_SECRET_KEY est renseignée : à l'ouverture publique
//    (PHOTO_BETA=on) comme en aperçu administrateur (PHOTO_BETA=admin), ce qui permet au propriétaire un vrai paiement de test ;
//  - sans PLISIO_SECRET_KEY, rien ne change : formule photo gratuite en bêta, prestataire général (PAYMENT_PROVIDER) hors bêta.
// Fonctions pures (reçoivent l'environnement), testées par tests/plisio.test.ts.

export type Env = Record<string, string | undefined>;

export const isPhotoFormula = (formula: FormulaId): boolean => formula !== "A";

/** Un rapport photo est-il payant par Plisio ? */
export const photoPaidByPlisio = (env: Env = process.env): boolean => plisioConfigured(env);

/** Le paiement de ce rapport est-il possible (page de paiement, lancement du paiement, aperçu verrouillé) ? */
export function paymentAllowed(formula: FormulaId, env: Env = process.env): boolean {
  if (!isFreeBeta(env)) return true;
  return isPhotoFormula(formula) && photoPaidByPlisio(env);
}

/** Un rapport photo créé maintenant est-il gratuit (bêta, sans Plisio) ? */
export const photoReportIsFree = (photoBeta: boolean, env: Env = process.env): boolean => photoBeta && !photoPaidByPlisio(env);

/** Formule photo ouverte au public ET payante par Plisio : les libellés publics ne disent plus « gratuit » que du questionnaire. */
export const isPhotoPaidPublic = (env: Env = process.env): boolean => isPhotoBeta(env) && photoPaidByPlisio(env);
