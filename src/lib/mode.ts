// Mode « bêta gratuite » : formule A seulement, rapport débloqué sans paiement. Activé par FREE_BETA=on.
// Le code de paiement et les formules photo restent en place, désactivés ; retirer la variable (ou la mettre à autre chose)
// les réactive. La variable est lue à l'exécution pour les actions et routes, et à la construction pour les pages
// statiques : après un changement, reconstruire et redémarrer le site (une plateforme comme Railway le fait seule).

export const isFreeBeta = (env: Record<string, string | undefined> = process.env): boolean => env.FREE_BETA === "on";

/** Durée de conservation des rapports de la bêta gratuite (jours) : au-delà, ils sont effacés par `npm run db:purge`. */
export const BETA = { reportTtlDays: 90 } as const;

/** Chemins qui n'existent pas en bêta gratuite (réponse 404) : formules photo, vérification d'âge, captcha, paiement, CGV. */
const HIDDEN_IN_BETA = ["/analyse/photo", "/verification-age", "/api/analyse", "/api/age", "/api/captcha", "/paiement", "/api/payments", "/cgv"];

export function isHiddenInBeta(pathname: string): boolean {
  return HIDDEN_IN_BETA.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Chemins qui n'existent qu'en bêta gratuite. */
export function isBetaOnly(pathname: string): boolean {
  return pathname === "/conditions" || pathname.startsWith("/conditions/");
}
