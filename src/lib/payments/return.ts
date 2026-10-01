// Retour du client après la page de paiement d'un prestataire externe : le prestataire ne reçoit JAMAIS l'adresse privée du rapport.
// Il renvoie le client vers /paiement/retour (sans paramètre) ; l'identifiant du rapport est retrouvé dans un cookie fonctionnel
// (httpOnly, 2 heures) posé au moment où le paiement est lancé. Ce cookie ne sert à rien d'autre. Le déblocage, lui, ne dépend jamais
// du retour du navigateur : seule la notification signée du prestataire débloque.
export const PAY_COOKIE = "nmb_pay";
export const PAY_COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

const ID = /^[A-Za-z0-9_-]{32,128}$/;

/** Destination après le retour : le rapport (ou la page de paiement en cas d'échec), ou null sans cookie valide. */
export function returnTarget(cookieValue: string | undefined, failed: boolean): string | null {
  if (!cookieValue || !ID.test(cookieValue)) return null;
  return failed ? `/paiement/${cookieValue}` : `/r/${cookieValue}?retour=1`;
}
