import { describe, expect, it } from "vitest";
import { clientIp, isCloudflareIp } from "@/lib/clientIp";

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("plages Cloudflare", () => {
  it("reconnaît des adresses Cloudflare IPv4 et IPv6 (relevées en production)", () => {
    for (const ip of ["162.158.110.193", "172.64.0.1", "104.16.0.1", "173.245.48.5", "2606:4700:3032::ac43:a7f4", "2a06:98c0::1"]) expect(isCloudflareIp(ip), ip).toBe(true);
  });
  it("refuse les autres adresses et les valeurs invalides", () => {
    for (const ip of ["92.138.127.38", "162.160.0.1", "2a01:cb11:60d:4d00::1", "6.6.6.6", "", "n'importe quoi", "999.1.1.1", "1:2:3"]) expect(isCloudflareIp(ip), ip).toBe(false);
  });
});

describe("adresse du visiteur (limite par IP)", () => {
  it("via Cloudflare : l'adresse du visiteur (cf-connecting-ip), pas celle de Cloudflare", () => {
    const visitor = "2a01:cb11:60d:4d00:987c:3c25:5cb4:9da9";
    expect(clientIp(h({ "x-forwarded-for": "162.158.110.193, 79.127.178.82", "x-real-ip": visitor, "cf-connecting-ip": visitor }))).toBe(visitor);
    expect(clientIp(h({ "x-forwarded-for": "162.158.110.193, 79.127.178.82", "cf-connecting-ip": "92.138.127.38" }))).toBe("92.138.127.38");
  });
  it("deux visiteurs derrière le même nœud Cloudflare ont deux adresses distinctes", () => {
    const xff = "162.158.110.193, 79.127.178.82";
    expect(clientIp(h({ "x-forwarded-for": xff, "cf-connecting-ip": "1.2.3.4" }))).not.toBe(clientIp(h({ "x-forwarded-for": xff, "cf-connecting-ip": "5.6.7.8" })));
  });
  it("accès direct à l'hébergeur : un cf-connecting-ip falsifié est ignoré, on garde l'adresse posée par l'hébergeur", () => {
    expect(clientIp(h({ "x-forwarded-for": "92.138.127.38, 79.127.178.81", "x-real-ip": "92.138.127.38", "cf-connecting-ip": "7.7.7.7" }))).toBe("92.138.127.38");
  });
  it("cf-connecting-ip invalide : ignoré même si la requête vient de Cloudflare", () => {
    expect(clientIp(h({ "x-forwarded-for": "162.158.110.193, 10.0.0.1", "x-real-ip": "92.138.127.38", "cf-connecting-ip": "pas-une-ip" }))).toBe("92.138.127.38");
  });
  it("développement local, sans proxy : x-forwarded-for (utilisé par les tests de bout en bout)", () => {
    expect(clientIp(h({ "x-forwarded-for": "10.1.2.3" }))).toBe("10.1.2.3");
  });
  it("aucune information : « inconnue »", () => {
    expect(clientIp(h({}))).toBe("inconnue");
  });
});
