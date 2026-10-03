// Contrôle d'accès global du site, appelé par src/proxy.ts (une fonction pure, testée sans serveur).
//  1. /api/health : toujours accessible (point de contrôle de santé de l'hébergeur), sans donnée.
//  2. Protection par mot de passe (authentification HTTP « Basic ») si SITE_PASSWORD est défini : tout le reste exige les identifiants.
//  3. Bêta gratuite : les chemins des formules photo, du paiement et des CGV n'existent pas (404) ; /conditions n'existe qu'en bêta.
//     Bêta photo active (PHOTO_BETA=on et garde-fous satisfaits, src/lib/photoBeta.ts) : les chemins de la formule B existent.
import { isBetaOnly, isFreeBeta, isHiddenInBeta } from "./mode";

export type GateDecision = { action: "next"; protectedSite: boolean } | { action: "unauthorized" } | { action: "not_found" };

type Env = Record<string, string | undefined>;

export const HEALTH_PATH = "/api/health";
export const PAYMENT_WEBHOOK_PATH = "/api/payments/webhook";

/** Comparaison en temps constant (évite de révéler le mot de passe par le temps de réponse). */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Extrait « utilisateur:mot de passe » d'un en-tête Authorization: Basic ... (UTF-8). */
export function parseBasicAuth(header: string | null | undefined): { user: string; password: string } | null {
  if (!header || !/^basic /i.test(header)) return null;
  try {
    const bin = atob(header.slice(6).trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const i = text.indexOf(":");
    if (i < 0) return null;
    return { user: text.slice(0, i), password: text.slice(i + 1) };
  } catch {
    return null;
  }
}

/** `adminSession` : la requête porte une session d'administration valide (aperçu de la formule photo, PHOTO_BETA=admin). */
export function decideAccess(pathname: string, authorization: string | null, env: Env = process.env, adminSession = false): GateDecision {
  if (pathname === HEALTH_PATH) return { action: "next", protectedSite: false };

  const password = env.SITE_PASSWORD ?? "";
  // Notifications du prestataire de paiement (Verotel) : elles ne portent pas d'identifiants du site et sont authentifiées par leur propre
  // signature (vérifiée avant tout accès à la base). Exception limitée à ce chemin, et seulement si ce prestataire est configuré :
  // sans elle, un site de test protégé ne recevrait jamais les notifications de paiement.
  const signedByProvider = pathname === PAYMENT_WEBHOOK_PATH && env.PAYMENT_PROVIDER === "verotel";
  if (password && !signedByProvider) {
    const creds = parseBasicAuth(authorization);
    const user = env.SITE_USER || "bitometre";
    // Les deux comparaisons sont toujours faites (pas de court-circuit).
    const okUser = creds ? safeEqual(creds.user, user) : false;
    const okPass = creds ? safeEqual(creds.password, password) : false;
    if (!(okUser && okPass)) return { action: "unauthorized" };
  }

  if (isFreeBeta(env) ? isHiddenInBeta(pathname, env, adminSession) : isBetaOnly(pathname)) return { action: "not_found" };
  return { action: "next", protectedSite: password !== "" && !signedByProvider };
}
