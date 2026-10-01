// Contrôle d'accès global du site, appelé par src/proxy.ts (une fonction pure, testée sans serveur).
//  1. /api/health : toujours accessible (point de contrôle de santé de l'hébergeur), sans donnée.
//  2. Site non ouvert : en production, sans mot de passe de protection et tant que l'identité de la Ltd contient des marqueurs
//     « [À COMPLÉTER : ...] », le site répond 503. C'est le garde-fou qui empêche d'ouvrir au public avec des mentions légales vides.
//  3. Protection par mot de passe (authentification HTTP « Basic ») si SITE_PASSWORD est défini : tout le reste exige les identifiants.
//  4. Bêta gratuite : les chemins des formules photo, du paiement et des CGV n'existent pas (404) ; /conditions n'existe qu'en bêta.
import { hasCompanyPlaceholders } from "@/config/company";
import { isBetaOnly, isFreeBeta, isHiddenInBeta } from "./mode";

export type GateDecision = { action: "next"; protectedSite: boolean } | { action: "unauthorized" } | { action: "closed" } | { action: "not_found" };

type Env = Record<string, string | undefined>;

export const HEALTH_PATH = "/api/health";

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

export function decideAccess(pathname: string, authorization: string | null, env: Env = process.env, placeholders = hasCompanyPlaceholders()): GateDecision {
  if (pathname === HEALTH_PATH) return { action: "next", protectedSite: false };

  const password = env.SITE_PASSWORD ?? "";
  if (!password && env.NODE_ENV === "production" && placeholders) return { action: "closed" };

  if (password) {
    const creds = parseBasicAuth(authorization);
    const user = env.SITE_USER || "bitometre";
    // Les deux comparaisons sont toujours faites (pas de court-circuit).
    const okUser = creds ? safeEqual(creds.user, user) : false;
    const okPass = creds ? safeEqual(creds.password, password) : false;
    if (!(okUser && okPass)) return { action: "unauthorized" };
  }

  if (isFreeBeta(env) ? isHiddenInBeta(pathname) : isBetaOnly(pathname)) return { action: "not_found" };
  return { action: "next", protectedSite: password !== "" };
}
