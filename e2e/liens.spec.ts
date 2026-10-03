import { expect, test } from "@playwright/test";

// Parcours automatique des liens internes à partir de l'accueil, et contrôle du sitemap :
//  - aucun lien interne cassé (toute adresse interne trouvée répond sans erreur, redirections suivies) ;
//  - le sitemap contient exactement les pages publiables : toutes celles qu'un robot peut indexer (ni noindex, ni interdites par
//    robots.txt), et rien d'autre ;
//  - chaque page publiable porte une adresse canonique égale à sa propre adresse, et son image de partage répond.

const MAX_PAGES = 250;

const hrefsOf = (html: string) => [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const noindex = (html: string) => /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html);
const canonicalOf = (html: string) => html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? null;
const ogImageOf = (html: string) => html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ?? null;

test.describe("Liens internes et sitemap", () => {
  test.setTimeout(900_000);

  test("aucun lien interne cassé ; sitemap = pages publiables", async ({ request, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const robots = await (await request.get("/robots.txt")).text();
    const disallow = [...robots.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
    const blocked = (path: string) => disallow.some((d) => path.startsWith(d) || `${path}/` === d);

    const queue = ["/"];
    const seen = new Set<string>(queue);
    const broken: string[] = [];
    const indexable = new Map<string, string>(); // chemin → html

    while (queue.length && seen.size <= MAX_PAGES) {
      const path = queue.shift()!;
      const res = await request.get(path, { maxRedirects: 5 });
      if (res.status() >= 400) {
        broken.push(`${path} → ${res.status()}`);
        continue;
      }
      const finalPath = new URL(res.url()).pathname;
      if (!(res.headers()["content-type"] ?? "").includes("text/html")) continue;
      const html = await res.text();
      if (!noindex(html) && !blocked(finalPath)) indexable.set(finalPath, html);
      // Les pages interdites aux robots (parcours d'analyse, vérification d'âge) ne sont pas explorées plus loin : leurs liens
      // dépendent d'un état (formulaire, session) que ce parcours ne simule pas.
      if (blocked(finalPath)) continue;
      for (const href of hrefsOf(html)) {
        if (/^(mailto:|tel:|#)/.test(href)) continue;
        const u = new URL(href, origin + finalPath);
        if (u.origin !== origin) continue;
        const p = u.pathname;
        if (!seen.has(p)) {
          seen.add(p);
          queue.push(p);
        }
      }
    }

    expect(broken, `liens internes cassés :\n${broken.join("\n")}`).toEqual([]);

    // Sitemap : exactement les pages indexables trouvées par le parcours.
    const xml = await (await request.get("/sitemap.xml")).text();
    const inSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname.replace(/(.)\/$/, "$1"));
    expect(new Set(inSitemap).size, "adresse en double dans le sitemap").toBe(inSitemap.length);
    expect([...inSitemap].sort()).toEqual([...indexable.keys()].sort());

    // Chaque page publiable : canonique = elle-même ; image de partage présente et servie.
    for (const [path, html] of indexable) {
      const canonical = canonicalOf(html);
      expect(canonical, `canonique absente : ${path}`).not.toBeNull();
      expect(new URL(canonical!, origin).pathname.replace(/(.)\/$/, "$1"), `canonique de ${path}`).toBe(path);
      const og = ogImageOf(html);
      expect(og, `image de partage absente : ${path}`).not.toBeNull();
      const img = await request.get(new URL(og!, origin).pathname);
      expect(img.status(), `image de partage de ${path}`).toBe(200);
    }
  });
});
