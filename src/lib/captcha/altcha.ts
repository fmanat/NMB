import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { pool } from "../db";

/**
 * Captcha à preuve de travail, protocole ALTCHA v1 (SHA-256), auto-hébergé : aucun tiers, aucun cookie, aucune donnée personnelle.
 * Protocole (documentation publique et bibliothèque altcha-lib, version v1 dite « legacy », toujours prise en charge) :
 *   - le serveur tire un sel « <aléa>?expires=<secondes>» et un nombre secret n (0 à maxnumber) ;
 *   - défi = SHA-256(sel + n) en hexadécimal ; signature = HMAC-SHA256(clé, défi) en hexadécimal ;
 *   - le navigateur cherche n en essayant tous les nombres (c'est la « preuve de travail »), puis renvoie en base 64 le JSON
 *     { algorithm, challenge, number, salt, signature } ;
 *   - le serveur recalcule défi et signature, contrôle l'expiration du sel, et refuse un défi déjà utilisé (table captcha_used).
 * Limites assumées : pas de réputation d'adresse IP mondiale (la limite de 5 essais par 24 h et la vérification d'âge restent les
 * vraies barrières) ; protocole v1 (la v2 d'ALTCHA utilise une dérivation de clé) ; vérifié ici par des tests sur le protocole,
 * pas avec le composant officiel de la page, à essayer avant la mise en ligne si on veut l'utiliser.
 */

export type AltchaChallenge = { algorithm: "SHA-256"; challenge: string; maxnumber: number; salt: string; signature: string };
export type AltchaPayload = { algorithm: string; challenge: string; number: number; salt: string; signature: string };

export const ALTCHA_VALID_SECONDS = 300;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function key(): string {
  const k = process.env.ALTCHA_HMAC_KEY;
  if (!k || k.length < 32) throw new Error("ALTCHA désactivé : ALTCHA_HMAC_KEY (32 caractères ou plus) n'est pas renseignée.");
  return k;
}

export function maxNumber(): number {
  const n = Number(process.env.ALTCHA_MAX_NUMBER);
  return Number.isInteger(n) && n >= 1_000 && n <= 10_000_000 ? n : 100_000;
}

const hmac = (challenge: string) => createHmac("sha256", key()).update(challenge).digest("hex");

export function createChallenge(now = Date.now()): AltchaChallenge {
  const max = maxNumber();
  const salt = `${randomBytes(12).toString("hex")}?expires=${Math.floor(now / 1000) + ALTCHA_VALID_SECONDS}`;
  const challenge = sha256(salt + randomInt(0, max + 1));
  return { algorithm: "SHA-256", challenge, maxnumber: max, salt, signature: hmac(challenge) };
}

const safeEqualHex = (a: string, b: string) => {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Vrai si la solution est correcte, récente et jamais utilisée. Toute anomalie donne faux (jamais d'exception vers l'appelant). */
export async function verifySolution(token: string | null, now = Date.now()): Promise<boolean> {
  if (!token || token.length > 2000) return false;
  let p: AltchaPayload;
  try {
    p = JSON.parse(Buffer.from(token, "base64").toString("utf8")) as AltchaPayload;
  } catch {
    return false;
  }
  if (p?.algorithm !== "SHA-256" || typeof p.challenge !== "string" || typeof p.salt !== "string" || typeof p.signature !== "string") return false;
  if (!Number.isInteger(p.number) || p.number < 0 || p.number > maxNumber()) return false;

  const expires = Number(new URLSearchParams(p.salt.split("?")[1] ?? "").get("expires"));
  if (!Number.isFinite(expires) || expires * 1000 < now) return false;

  if (!safeEqualHex(sha256(p.salt + p.number), p.challenge)) return false; // la preuve de travail est juste
  if (!safeEqualHex(hmac(p.challenge), p.signature)) return false; // le défi a bien été émis par ce serveur

  // Usage unique : la signature d'un défi n'est acceptée qu'une fois (les lignes expirées sont effacées au passage).
  await pool().query("DELETE FROM captcha_used WHERE expires_at < now() - interval '1 hour'");
  const res = await pool().query("INSERT INTO captcha_used (signature, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING", [p.signature, expires]);
  return (res.rowCount ?? 0) === 1;
}
