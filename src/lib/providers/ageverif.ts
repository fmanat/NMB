import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AgeVerificationProvider } from "./types";

/**
 * Adaptateur AgeVerif (vérification d'âge par un prestataire tiers), flux OAuth2 « authorization code ».
 * D'après la documentation publique : https://docs.ageverif.com/oauth2.html
 *   - redirection vers GET https://api.ageverif.com/v1/oauth2/checker (client_id, redirect_uri, response_type=code, scope=read, state, language, challenges) ;
 *   - retour sur redirect_uri avec `code` et `state` ; le code est valable 10 minutes ;
 *   - échange du code : POST https://api.ageverif.com/v1/oauth2/token, authentification Basic base64(client_id:client_secret),
 *     corps grant_type=authorization_code, code, redirect_uri ; réponse access_token (jeton d'1 h) ;
 *   - confirmation : GET https://api.ageverif.com/v1/oauth2/resources avec « Bearer access_token » ; champs `verified` (booléen),
 *     `age_threshold` (entier, ex. 18), `assurance_level`, et des champs d'identifiant et de pays que ce site ne lit ni ne conserve.
 *
 * Le site ne garde que « majeur : oui / non » dans le jeton signé de 30 minutes. L'échange du code a lieu de serveur à serveur :
 * rien n'est à croire dans le navigateur. Désactivé tant que les variables ne sont pas renseignées.
 *
 * Ce que ce dispositif garantit (voir docs/PRESTATAIRES.md) : jamais « âge garanti », jamais « certifié Arcom » ; AgeVerif connaît le site
 * qui le sollicite (client_id), donc ne pas parler de « double anonymat » sans réserve.
 */

const AUTHORIZE = "https://api.ageverif.com/v1/oauth2/checker";
const TOKEN = "https://api.ageverif.com/v1/oauth2/token";
const RESOURCES = "https://api.ageverif.com/v1/oauth2/resources";
const TIMEOUT_MS = 15_000;
const STATE_MINUTES = 15; // plus que les 10 minutes de validité du code
const RETURN_RE = /^\/analyse\/photo\?f=[BC]$/;

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`AgeVerif désactivé : ${name} n'est pas renseignée.`);
  return v;
}

const redirectUri = () => `${need("SITE_URL").replace(/\/$/, "")}/api/age/callback`;

const sign = (payload: string) => createHmac("sha256", need("AGE_TOKEN_SECRET")).update(`ageverif-state.${payload}`).digest("base64url");

/** `state` : protection contre la falsification (CSRF) et mémoire de l'écran de retour ; signé, valable 15 minutes, sans donnée personnelle. */
export function makeState(returnPath: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ n: randomBytes(8).toString("hex"), r: returnPath, e: now + STATE_MINUTES * 60_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readState(state: string | null, now = Date.now()): { returnPath: string } | null {
  if (!state) return null;
  const [payload, sig, ...rest] = state.split(".");
  if (!payload || !sig || rest.length) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { r, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { r?: string; e?: number };
    if (typeof r !== "string" || !RETURN_RE.test(r) || typeof e !== "number" || e < now) return null;
    return { returnPath: r };
  } catch {
    return null;
  }
}

async function call(url: string, init: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const ageVerifProvider: AgeVerificationProvider = {
  id: "ageverif",

  async startVerification({ returnUrl }) {
    const q = new URLSearchParams({
      client_id: need("AGEVERIF_CLIENT_ID"),
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: "read",
      state: makeState(returnUrl),
      language: "fr",
    });
    // Liste de méthodes facultative (ex. « selfie,email_age,credit_card »). Vide : toutes celles que propose AgeVerif.
    if (process.env.AGEVERIF_CHALLENGES) q.set("challenges", process.env.AGEVERIF_CHALLENGES);
    return { redirectUrl: `${AUTHORIZE}?${q.toString()}` };
  },

  async completeVerification(req) {
    const url = new URL(req.url);
    const state = readState(url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    if (!state || !code || url.searchParams.get("error")) return { adult: false };

    const basic = Buffer.from(`${need("AGEVERIF_CLIENT_ID")}:${need("AGEVERIF_CLIENT_SECRET")}`).toString("base64");
    const tokenRes = await call(TOKEN, {
      method: "POST",
      headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }),
    });
    if (!tokenRes.ok) return { adult: false };
    const { access_token: accessToken } = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
    if (!accessToken) return { adult: false };

    const resRes = await call(RESOURCES, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!resRes.ok) return { adult: false };
    const r = (await resRes.json().catch(() => ({}))) as { verified?: unknown; age_threshold?: unknown };
    // Seule information retenue : vérifié ET seuil d'âge d'au moins 18 ans. Le reste (identifiant, pays) est ignoré.
    const adult = r.verified === true && typeof r.age_threshold === "number" && r.age_threshold >= 18;
    return adult ? { adult: true, returnPath: state.returnPath } : { adult: false };
  },
};
