import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAgeProvider } from "@/lib/providers";
import { ageVerifProvider, makeState, readState } from "@/lib/providers/ageverif";

// Réponses simulées fidèles à la documentation publique d'AgeVerif (https://docs.ageverif.com/oauth2.html). Aucun appel réseau.

beforeEach(() => {
  process.env.AGE_PROVIDER = "ageverif";
  process.env.AGEVERIF_CLIENT_ID = "client-test";
  process.env.AGEVERIF_CLIENT_SECRET = "secret-test";
  process.env.SITE_URL = "https://exemple.test";
  delete process.env.AGEVERIF_CHALLENGES;
});
afterEach(() => {
  vi.unstubAllGlobals();
  process.env.AGE_PROVIDER = "simulation";
});

const callbackReq = (qs: string) => new Request(`https://exemple.test/api/age/callback?${qs}`);

function stubApi(opts: { token?: Response; resources?: Response } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith("/v1/oauth2/token")) return opts.token ?? new Response(JSON.stringify({ token_type: "Bearer", access_token: "jwt.abc", expires_in: 3600 }), { status: 200 });
    if (url.endsWith("/v1/oauth2/resources"))
      return opts.resources ?? new Response(JSON.stringify({ resources: { verified: true, uid: "u1", country: "FR", assurance_level: "STANDARD", age_threshold: 18, reused: false } }), { status: 200 });
    throw new Error("URL inattendue " + url);
  });
  return calls;
}

describe("AgeVerif : désactivé sans variables, sélectionnable", () => {
  it("sélectionné par AGE_PROVIDER=ageverif", () => {
    expect(getAgeProvider().id).toBe("ageverif");
  });
  it("sans identifiants, le démarrage et le retour échouent avec un message clair", async () => {
    delete process.env.AGEVERIF_CLIENT_ID;
    await expect(ageVerifProvider.startVerification({ returnUrl: "/analyse/photo?f=B" })).rejects.toThrow(/AGEVERIF_CLIENT_ID/);
    process.env.AGEVERIF_CLIENT_ID = "client-test";
    delete process.env.AGEVERIF_CLIENT_SECRET;
    const state = makeState("/analyse/photo?f=B");
    await expect(ageVerifProvider.completeVerification(callbackReq(`code=c&state=${state}`))).rejects.toThrow(/AGEVERIF_CLIENT_SECRET/);
  });
});

describe("AgeVerif : démarrage", () => {
  it("construit l'adresse de redirection avec les paramètres de la documentation", async () => {
    const { redirectUrl } = await ageVerifProvider.startVerification({ returnUrl: "/analyse/photo?f=C" });
    const u = new URL(redirectUrl);
    expect(u.origin + u.pathname).toBe("https://api.ageverif.com/v1/oauth2/checker");
    expect(u.searchParams.get("client_id")).toBe("client-test");
    expect(u.searchParams.get("redirect_uri")).toBe("https://exemple.test/api/age/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toBe("read");
    expect(u.searchParams.get("language")).toBe("fr");
    expect(u.searchParams.get("challenges")).toBeNull();
    expect(readState(u.searchParams.get("state"))?.returnPath).toBe("/analyse/photo?f=C");
    expect(redirectUrl).not.toContain("secret-test");
  });
  it("transmet la liste de méthodes si elle est configurée", async () => {
    process.env.AGEVERIF_CHALLENGES = "selfie,email_age";
    const { redirectUrl } = await ageVerifProvider.startVerification({ returnUrl: "/analyse/photo?f=B" });
    expect(new URL(redirectUrl).searchParams.get("challenges")).toBe("selfie,email_age");
  });
});

describe("AgeVerif : état signé (state)", () => {
  it("refuse un état falsifié, expiré, mal formé ou pointant hors des écrans d'envoi", () => {
    const good = makeState("/analyse/photo?f=B");
    expect(readState(good)?.returnPath).toBe("/analyse/photo?f=B");
    expect(readState(good.slice(0, -2) + "xx")).toBeNull();
    expect(readState(good, Date.now() + 16 * 60_000)).toBeNull();
    expect(readState("n importe quoi")).toBeNull();
    expect(readState(null)).toBeNull();
    expect(readState(`${good}.extra`)).toBeNull();
    expect(readState(makeState("https://pirate.test/"))).toBeNull(); // adresse arbitraire : jamais acceptée
    expect(readState(makeState("/admin"))).toBeNull();
  });
  it("un état signé avec un autre secret est refusé", () => {
    const good = makeState("/analyse/photo?f=B");
    const old = process.env.AGE_TOKEN_SECRET;
    process.env.AGE_TOKEN_SECRET = "autre-secret";
    expect(readState(good)).toBeNull();
    process.env.AGE_TOKEN_SECRET = old;
  });
});

describe("AgeVerif : retour et validation côté serveur", () => {
  const state = () => makeState("/analyse/photo?f=C");

  it("code valide, vérifié, seuil 18 : majeur, renvoi vers l'écran demandé ; échange Basic puis Bearer", async () => {
    const calls = stubApi();
    const out = await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`));
    expect(out).toEqual({ adult: true, returnPath: "/analyse/photo?f=C" });
    expect(calls).toHaveLength(2);
    const tokenHeaders = calls[0].init!.headers as Record<string, string>;
    expect(tokenHeaders.authorization).toBe(`Basic ${Buffer.from("client-test:secret-test").toString("base64")}`);
    const body = new URLSearchParams(String(calls[0].init!.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("abc");
    expect(body.get("redirect_uri")).toBe("https://exemple.test/api/age/callback");
    expect((calls[1].init!.headers as Record<string, string>).authorization).toBe("Bearer jwt.abc");
  });

  it("aucune donnée d'identité (uid, pays) n'est renvoyée", async () => {
    stubApi();
    const out = await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`));
    expect(JSON.stringify(out)).not.toMatch(/u1|FR|uid|country/);
  });

  it("refus dans tous les cas douteux, sans appeler le prestataire quand l'état est mauvais", async () => {
    const calls = stubApi();
    expect(await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=faux`))).toEqual({ adult: false });
    expect(await ageVerifProvider.completeVerification(callbackReq(`state=${state()}`))).toEqual({ adult: false }); // pas de code
    expect(await ageVerifProvider.completeVerification(callbackReq(`error=access_denied&state=${state()}`))).toEqual({ adult: false });
    expect(calls).toHaveLength(0);
  });

  it("non vérifié, seuil inférieur à 18, seuil absent ou mal typé : refus", async () => {
    const payloads = [{ verified: false, age_threshold: 18 }, { verified: true, age_threshold: 16 }, { verified: true }, { verified: "true", age_threshold: 18 }, { verified: true, age_threshold: "18" }, {}];
    for (const payload of payloads) {
      stubApi({ resources: new Response(JSON.stringify({ resources: payload }), { status: 200 }) });
      expect(await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`)), JSON.stringify(payload)).toEqual({ adult: false });
    }
  });

  it("erreur du prestataire (jeton refusé, ressources en erreur, réponse illisible, sans access_token) : refus", async () => {
    stubApi({ token: new Response("{}", { status: 400 }) });
    expect(await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`))).toEqual({ adult: false });
    stubApi({ token: new Response("pas du json", { status: 200 }) });
    expect(await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`))).toEqual({ adult: false });
    // Champs à la racine (ancien format supposé, non documenté) : refusé, seul le format documenté {"resources": {…}} est lu.
    stubApi({ resources: new Response(JSON.stringify({ verified: true, age_threshold: 18 }), { status: 200 }) });
    expect((await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`))).adult).toBe(false);
    stubApi({ resources: new Response("{}", { status: 401 }) });
    expect(await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`))).toEqual({ adult: false });
    stubApi({ resources: new Response("pas du json", { status: 200 }) });
    expect(await ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`))).toEqual({ adult: false });
  });

  it("panne réseau : l'erreur remonte, et la route de retour la traite comme un refus", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("réseau coupé");
    });
    await expect(ageVerifProvider.completeVerification(callbackReq(`code=abc&state=${state()}`))).rejects.toThrow();
    const { GET } = await import("@/app/api/age/callback/route");
    const res = await GET(callbackReq(`code=abc&state=${state()}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/verification-age?refus=1");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("route de retour : succès = cookie « majeur » et redirection vers l'écran mémorisé ; jamais d'adresse arbitraire", async () => {
    stubApi();
    const { GET } = await import("@/app/api/age/callback/route");
    const res = await GET(callbackReq(`code=abc&state=${state()}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/analyse/photo?f=C");
    expect(res.headers.get("set-cookie")).toMatch(/^nmb_age=/);
  });
});
