import type { AltchaChallenge, AltchaPayload } from "./altcha";

/**
 * Côté navigateur : résout le défi (cherche le nombre tel que SHA-256(sel + nombre) = défi) et prépare la solution à envoyer.
 * Sans dépendance : utilise l'API Web Crypto, aussi disponible dans Node pour les tests.
 */
export async function solveChallenge(c: AltchaChallenge, opts: { signal?: AbortSignal } = {}): Promise<string> {
  const enc = new TextEncoder();
  const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  const t0 = Date.now();
  for (let n = 0; n <= c.maxnumber; n++) {
    if (opts.signal?.aborted) throw new Error("annulé");
    if (n % 2000 === 0) await new Promise((r) => setTimeout(r, 0)); // laisse respirer la page
    if (hex(await crypto.subtle.digest("SHA-256", enc.encode(c.salt + n))) === c.challenge) {
      const payload: AltchaPayload & { took: number } = { algorithm: c.algorithm, challenge: c.challenge, number: n, salt: c.salt, signature: c.signature, took: Date.now() - t0 };
      return btoa(JSON.stringify(payload));
    }
  }
  throw new Error("défi insoluble");
}
