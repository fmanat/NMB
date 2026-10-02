// Adresse du visiteur, utilisée pour la limite d'analyses par adresse IP.
//
// Pourquoi pas simplement le premier élément de x-forwarded-for : derrière Cloudflare, c'est une adresse de Cloudflare (partagée par
// des milliers de visiteurs) ; et en accès direct à l'hébergeur il pourrait être écrit par le visiteur. Mesuré le 02/10/2026 sur Railway :
//   - via Cloudflare : x-forwarded-for = « <adresse Cloudflare>, <interne Railway> », cf-connecting-ip = visiteur ;
//   - accès direct : Railway écrase x-forwarded-for et x-real-ip (valeurs falsifiées ignorées) mais laisse passer cf-connecting-ip.
// Règle : la requête vient de Cloudflare si l'adresse de la connexion vue par l'hébergeur (1er élément de x-forwarded-for) est dans les
// plages publiées par Cloudflare ; alors seulement on lit cf-connecting-ip. Sinon : x-real-ip (posé par l'hébergeur), puis x-forwarded-for
// (développement local, sans proxy), puis « inconnue ».
// Plages : https://www.cloudflare.com/ips-v4 et https://www.cloudflare.com/ips-v6 (relevées le 02/10/2026 ; elles changent très rarement).

const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20",
  "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];

/** Adresse IPv4 ou IPv6 en entier (et sa famille), ou null si ce n'est pas une adresse valide. */
function parseIp(raw: string): { v: 4 | 6; n: bigint } | null {
  const s = raw.trim();
  const m4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (m4) {
    const p = m4.slice(1).map(Number);
    if (p.some((x) => x > 255)) return null;
    return { v: 4, n: p.reduce((a, x) => (a << BigInt(8)) | BigInt(x), BigInt(0)) };
  }
  if (!/^[0-9a-f:]+$/i.test(s) || !s.includes(":") || s.split("::").length > 2) return null;
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail ? tail.split(":") : [];
  const missing = 8 - h.length - t.length;
  if (s.includes("::") ? missing < 1 : missing !== 0) return null;
  const groups = [...h, ...Array(s.includes("::") ? missing : 0).fill("0"), ...t];
  if (groups.length !== 8 || groups.some((g) => g === "" || g.length > 4)) return null;
  return { v: 6, n: groups.reduce((a, g) => (a << BigInt(16)) | BigInt(parseInt(g, 16)), BigInt(0)) };
}

const RANGES = CLOUDFLARE_RANGES.map((c) => {
  const [addr, bits] = c.split("/");
  const ip = parseIp(addr)!;
  return { v: ip.v, n: ip.n, bits: Number(bits) };
});

export function isCloudflareIp(raw: string): boolean {
  const ip = parseIp(raw);
  if (!ip) return false;
  const total = ip.v === 4 ? 32 : 128;
  return RANGES.some((r) => {
    if (r.v !== ip.v) return false;
    const shift = BigInt(total - r.bits);
    return ip.n >> shift === r.n >> shift;
  });
}

type HeaderSource = { get(name: string): string | null };

export function clientIp(headers: HeaderSource): string {
  const xff = headers.get("x-forwarded-for")?.split(",")[0].trim() || "";
  const cf = headers.get("cf-connecting-ip")?.trim() || "";
  if (xff && isCloudflareIp(xff) && cf && parseIp(cf)) return cf;
  return headers.get("x-real-ip")?.trim() || xff || "inconnue";
}
