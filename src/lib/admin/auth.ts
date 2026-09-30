import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { ADMIN } from "@/config/site";

export const ADMIN_COOKIE = "nmb_admin";
export const MIN_PASSWORD_LENGTH = 12;

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

/**
 * Hachage d'un mot de passe : « scrypt:<sel>:<empreinte> » (hexadécimal). Le séparateur « : » est voulu : le caractère « $ »
 * serait interprété comme une variable par le chargeur de fichier .env de Next.js.
 */
export function hashPassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !/^[0-9a-f]+$/i.test(saltHex ?? "") || !/^[0-9a-f]+$/i.test(hashHex ?? "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, SCRYPT);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** L'administration n'est disponible que si le hachage du mot de passe et le secret de session sont renseignés. */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SESSION_SECRET);
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET manquant");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

/** Jeton de session : expiration + valeur aléatoire + signature. Valable ADMIN.sessionHours heures. */
export function issueAdminToken(now = Date.now()): string {
  const payload = `${now + ADMIN.sessionHours * 3_600_000}.${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function isAdminTokenValid(token: string | null | undefined, now = Date.now()): boolean {
  if (!token || !process.env.ADMIN_SESSION_SECRET) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  if (!/^[0-9a-f]+$/i.test(sig)) return false;
  const expected = Buffer.from(sign(`${exp}.${nonce}`), "hex");
  const given = Buffer.from(sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(exp) > now;
}

/** Limite les tentatives de connexion échouées : au plus `max` par fenêtre glissante, par clé (adresse IP hachée). */
export class LoginLimiter {
  private failures = new Map<string, number[]>();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  private recent(key: string, now: number): number[] {
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.failures.set(key, list);
    else this.failures.delete(key);
    return list;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    return this.recent(key, now).length >= this.max;
  }

  registerFailure(key: string, now = Date.now()): void {
    this.failures.set(key, [...this.recent(key, now), now]);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

// Stockée en mémoire du serveur : suffisante pour un serveur unique ; à mutualiser si le site tourne sur plusieurs instances.
const globalForLimiter = globalThis as unknown as { nmbLoginLimiter?: LoginLimiter };
export const loginLimiter = (globalForLimiter.nmbLoginLimiter ??= new LoginLimiter(ADMIN.maxFailures, ADMIN.windowMinutes * 60_000));
