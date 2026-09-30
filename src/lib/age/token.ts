import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AGE_TOKEN_MINUTES } from "@/config/site";

export const AGE_COOKIE = "nmb_age";

function secret(): string {
  const s = process.env.AGE_TOKEN_SECRET;
  if (!s) throw new Error("AGE_TOKEN_SECRET manquant");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

/**
 * Jeton « majeur : oui » : expiration + valeur aléatoire + signature. Aucune donnée d'identité.
 * Valable AGE_TOKEN_MINUTES minutes.
 */
export function issueAgeToken(now = Date.now()): string {
  const payload = `${now + AGE_TOKEN_MINUTES * 60_000}.${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}

export function isAgeTokenValid(token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  const expected = Buffer.from(sign(`${exp}.${nonce}`), "hex");
  const given = Buffer.from(sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(exp) > now;
}
