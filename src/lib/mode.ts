// Mode « bêta gratuite » : formule A seulement, rapport débloqué sans paiement. Activé par FREE_BETA=on.
// Le code de paiement et les formules photo restent en place, désactivés ; retirer la variable (ou la mettre à autre chose)
// les réactive. La variable est lue à l'exécution pour les actions et routes, et à la construction pour les pages
// statiques : après un changement, reconstruire et redémarrer le site (une plateforme comme Railway le fait seule).
// Bêta de la formule photo (PHOTO_BETA=on, voir src/lib/photoBeta.ts) : en bêta gratuite, la formule B (photo) existe aussi, gratuite.

import { isPhotoBetaActive, isPhotoPreviewActive } from "./photoBeta";

export const isFreeBeta = (env: Record<string, string | undefined> = process.env): boolean => env.FREE_BETA === "on";

/** Bêta gratuite ET bêta photo active (garde-fous satisfaits) : la formule B existe, gratuite ; C, paiement et CGV restent masqués. */
export const isPhotoBeta = (env: Record<string, string | undefined> = process.env): boolean => isFreeBeta(env) && isPhotoBetaActive(env);

/**
 * La formule photo (B) est-elle accessible pour CETTE requête ? Bêta photo publique (PHOTO_BETA=on), ou aperçu (PHOTO_BETA=admin) avec une
 * session d'administration valide. `adminSession` : la requête porte un cookie d'administration valide (lu par l'appelant).
 */
export const isPhotoAvailable = (adminSession: boolean, env: Record<string, string | undefined> = process.env): boolean =>
  isFreeBeta(env) && (isPhotoBetaActive(env) || (adminSession && isPhotoPreviewActive(env)));

/** Aperçu administrateur en cours pour cette requête (formule photo invisible du public). */
export const isPhotoPreview = (adminSession: boolean, env: Record<string, string | undefined> = process.env): boolean =>
  isFreeBeta(env) && !isPhotoBetaActive(env) && adminSession && isPhotoPreviewActive(env);

/** Durée de conservation des rapports de la bêta gratuite (jours) : au-delà, ils sont effacés par `npm run db:purge`. */
export const BETA = { reportTtlDays: 90 } as const;

/** Chemins de la formule photo (B) : masqués en bêta gratuite, SAUF si la bêta photo est active. */
const PHOTO_PATHS = ["/analyse/photo", "/verification-age", "/api/analyse", "/api/age", "/api/captcha"];
/** Chemins qui n'existent jamais en bêta gratuite (réponse 404) : prestataire général, CGV. */
const ALWAYS_HIDDEN_IN_BETA = ["/api/payments", "/cgv"];
/** Pages de paiement : masquées en bêta, sauf si la formule photo est payante par Plisio (PLISIO_SECRET_KEY renseignée). */
const PAYMENT_PAGES = ["/paiement"];

const under = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function isHiddenInBeta(pathname: string, env: Record<string, string | undefined> = process.env, adminSession = false): boolean {
  if (under(pathname, ALWAYS_HIDDEN_IN_BETA)) return true;
  if (under(pathname, PAYMENT_PAGES)) return (env.PLISIO_SECRET_KEY ?? "").trim() === "";
  return under(pathname, PHOTO_PATHS) && !isPhotoAvailable(adminSession, env);
}

/** Chemins qui n'existent qu'en bêta gratuite. */
export function isBetaOnly(pathname: string): boolean {
  return pathname === "/conditions" || pathname.startsWith("/conditions/");
}
