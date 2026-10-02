// Mode « bêta gratuite » : formule A seulement, rapport débloqué sans paiement. Activé par FREE_BETA=on.
// Le code de paiement et les formules photo restent en place, désactivés ; retirer la variable (ou la mettre à autre chose)
// les réactive. La variable est lue à l'exécution pour les actions et routes, et à la construction pour les pages
// statiques : après un changement, reconstruire et redémarrer le site (une plateforme comme Railway le fait seule).
// Bêta de la formule photo (PHOTO_BETA=on, voir src/lib/photoBeta.ts) : en bêta gratuite, la formule B (photo) existe aussi, gratuite.

import { isPhotoBetaActive } from "./photoBeta";

export const isFreeBeta = (env: Record<string, string | undefined> = process.env): boolean => env.FREE_BETA === "on";

/** Bêta gratuite ET bêta photo active (garde-fous satisfaits) : la formule B existe, gratuite ; C, paiement et CGV restent masqués. */
export const isPhotoBeta = (env: Record<string, string | undefined> = process.env): boolean => isFreeBeta(env) && isPhotoBetaActive(env);

/** Durée de conservation des rapports de la bêta gratuite (jours) : au-delà, ils sont effacés par `npm run db:purge`. */
export const BETA = { reportTtlDays: 90 } as const;

/** Chemins de la formule photo (B) : masqués en bêta gratuite, SAUF si la bêta photo est active. */
const PHOTO_PATHS = ["/analyse/photo", "/verification-age", "/api/analyse", "/api/age", "/api/captcha"];
/** Chemins qui n'existent jamais en bêta gratuite (réponse 404) : paiement, CGV. */
const ALWAYS_HIDDEN_IN_BETA = ["/paiement", "/api/payments", "/cgv"];

const under = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

export function isHiddenInBeta(pathname: string, env: Record<string, string | undefined> = process.env): boolean {
  if (under(pathname, ALWAYS_HIDDEN_IN_BETA)) return true;
  return under(pathname, PHOTO_PATHS) && !isPhotoBetaActive(env);
}

/** Chemins qui n'existent qu'en bêta gratuite. */
export function isBetaOnly(pathname: string): boolean {
  return pathname === "/conditions" || pathname.startsWith("/conditions/");
}
