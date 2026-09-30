import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Marked, type Token, type Tokens } from "marked";

/** Les huit pages du lancement (cahier des charges, section 12). Le nom du fichier est <slug>.md. */
export const SEO_SLUGS = [
  "taille-moyenne-penis-france",
  "taille-penis-par-pays",
  "comment-mesurer-son-penis",
  "circonference-moyenne-penis",
  "courbure-penis-normale",
  "taille-repos-erection",
  "etudes-taille-penis",
  "faq",
] as const;
export type SeoSlug = (typeof SEO_SLUGS)[number];

export const SEO_LIMITS = { titleMax: 60, metaDescriptionMax: 155, wordsMin: 800, wordsMax: 1500 } as const;
export const SEO_DIR = join(process.cwd(), "content", "seo");

export class SeoError extends Error {}

export type SeoFaq = { q: string; a: string };
export type SeoSource = { title: string; url: string };
export type Heading = { depth: 2 | 3; text: string; id: string };

export type SeoPage = {
  slug: SeoSlug;
  title: string;
  metaDescription: string;
  targetKeyword: string;
  faq: SeoFaq[];
  sources: SeoSource[];
  bodyHtml: string;
  headings: Heading[];
  words: number;
  /** Liens internes vers des pages du lancement qui n'existent pas (encore). */
  pendingLinks: string[];
  modifiedAt: Date;
};

/** Publication : tant que SEO_PUBLISH n'est pas « on », les pages restent en noindex, hors sitemap, et cachées en production. */
export function isPublished(): boolean {
  return process.env.SEO_PUBLISH === "on";
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const isSlug = (s: string): s is SeoSlug => (SEO_SLUGS as readonly string[]).includes(s);

function nonEmpty(v: unknown, what: string, file: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new SeoError(`${file} : « ${what} » est vide ou absent.`);
  return v.trim();
}

const SCALAR_KEYS = ["slug", "title", "metaDescription", "targetKeyword"] as const;
const LIST_KEYS = { faq: ["q", "a"], sources: ["title", "url"] } as const;

/** Valeur d'une ligne « clé: valeur » : tout ce qui suit le premier « : », les deux-points du texte sont donc permis. */
function scalar(v: string): string {
  const t = v.trim();
  return t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) ? t.slice(1, -1) : t;
}

/**
 * Lit l'en-tête au format du cahier des charges (clés simples, deux listes faq et sources). Volontairement plus
 * tolérant que le YAML strict : un titre comme « France : que disent les études ? » n'a pas besoin de guillemets.
 */
function parseHeader(block: string, file: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  let list: { key: keyof typeof LIST_KEYS; items: Record<string, string>[] } | null = null;
  const lines = block.split(/\r?\n/);
  for (const [i, raw] of lines.entries()) {
    const at = `${file}, ligne ${i + 2} du fichier`;
    if (raw.trim() === "") continue;
    const top = raw.match(/^([A-Za-z][A-Za-z0-9]*):(.*)$/);
    if (top) {
      const [, key, rest] = top;
      if (key in meta) throw new SeoError(`${at} : champ « ${key} » présent deux fois.`);
      if (key in LIST_KEYS) {
        if (rest.trim() !== "") throw new SeoError(`${at} : « ${key}: » doit être suivi d'une liste sur les lignes suivantes.`);
        list = { key: key as keyof typeof LIST_KEYS, items: [] };
        meta[key] = list.items;
      } else if ((SCALAR_KEYS as readonly string[]).includes(key)) {
        list = null;
        meta[key] = scalar(rest);
      } else {
        throw new SeoError(`${at} : champ inconnu « ${key} » (attendus : ${[...SCALAR_KEYS, ...Object.keys(LIST_KEYS)].join(", ")}).`);
      }
      continue;
    }
    const item = raw.match(/^\s+-\s+([a-z]+):(.*)$/);
    const cont = raw.match(/^\s+([a-z]+):(.*)$/);
    if (list && (item || cont)) {
      const m = (item ?? cont)!;
      const [, k, rest] = m;
      if (!(LIST_KEYS[list.key] as readonly string[]).includes(k))
        throw new SeoError(`${at} : clé « ${k} » inconnue dans « ${list.key} » (attendues : ${LIST_KEYS[list.key].join(", ")}).`);
      if (item) list.items.push({});
      const current = list.items[list.items.length - 1];
      if (!current) throw new SeoError(`${at} : chaque élément de liste doit commencer par « - ».`);
      if (k in current) throw new SeoError(`${at} : clé « ${k} » présente deux fois dans le même élément.`);
      current[k] = scalar(rest);
      continue;
    }
    throw new SeoError(`${at} : ligne non reconnue « ${raw.trim().slice(0, 60)} ».`);
  }
  return meta;
}

function splitFrontMatter(raw: string, file: string): { meta: Record<string, unknown>; body: string } {
  const m = raw.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new SeoError(`${file} : en-tête manquant (le fichier doit commencer par --- puis les champs, puis ---).`);
  return { meta: parseHeader(m[1], file), body: m[2] };
}

function* walk(tokens: Token[]): Generator<Token> {
  for (const t of tokens) {
    yield t;
    const any = t as unknown as Record<string, unknown>;
    for (const v of Object.values(any)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item && typeof item === "object" && "type" in item) yield* walk([item as Token]);
          else if (Array.isArray(item)) for (const cell of item) if (cell && typeof cell === "object" && "tokens" in cell) yield* walk((cell as { tokens: Token[] }).tokens);
        }
      }
    }
  }
}

/** Résout un lien du corps : /analyse, slug d'une page du lancement, ou adresse externe http(s). */
function resolveHref(href: string, file: string, pending: Set<string>, existing: Set<string>): string {
  if (/^https?:\/\//i.test(href)) return href;
  const clean = href.replace(/^\/+/, "");
  const [base, hash] = clean.split("#");
  if (base === "analyse") return "/analyse" + (hash ? `#${hash}` : "");
  if (isSlug(base)) {
    if (!existing.has(base)) pending.add(base);
    return `/${base}` + (hash ? `#${hash}` : "");
  }
  throw new SeoError(`${file} : lien interne inconnu « ${href} » (autorisés : /analyse ou le slug d'une des 8 pages).`);
}

/** Convertit le Markdown en HTML après validation stricte : titres H2/H3 seulement, ni image, ni HTML brut, liens contrôlés. */
export function renderBody(markdown: string, file: string, existingSlugs: Set<string>): { html: string; headings: Heading[]; words: number; pending: string[] } {
  const marked = new Marked();
  const tokens = marked.lexer(markdown);
  const pending = new Set<string>();
  const headings: Heading[] = [];
  const used = new Map<string, number>();

  for (const t of walk(tokens)) {
    if (t.type === "heading") {
      const h = t as Tokens.Heading;
      if (h.depth === 1) throw new SeoError(`${file} : titre H1 interdit dans le corps (le H1 vient du champ title) : « ${h.text} ».`);
      if (h.depth > 3) throw new SeoError(`${file} : seuls les titres H2 et H3 sont autorisés (trouvé H${h.depth}) : « ${h.text} ».`);
    } else if (t.type === "image") {
      throw new SeoError(`${file} : les images sont interdites (aucune image sur ces pages).`);
    } else if (t.type === "html") {
      throw new SeoError(`${file} : HTML brut interdit : « ${String((t as Tokens.HTML).raw).trim().slice(0, 40)} ».`);
    }
  }

  marked.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Token[]) => string } }, { tokens, depth, text }: Tokens.Heading) {
        let id = slugify(text) || "section";
        const n = used.get(id) ?? 0;
        used.set(id, n + 1);
        if (n > 0) id = `${id}-${n + 1}`;
        headings.push({ depth: depth as 2 | 3, text, id });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link(this: { parser: { parseInline: (t: Token[]) => string } }, { href, title, tokens }: Tokens.Link) {
        const resolved = resolveHref(href, file, pending, existingSlugs);
        const external = /^https?:\/\//i.test(resolved);
        const t = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
        const rel = external ? ' rel="noopener nofollow" target="_blank"' : "";
        return `<a href="${resolved.replace(/"/g, "&quot;")}"${t}${rel}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });

  const html = marked.parser(tokens) as string;
  const words = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").split(/\s+/).filter(Boolean).length;
  return { html, headings, words, pending: [...pending] };
}

/** Lit et valide un fichier de page. Toute erreur de format est signalée en français, avec le nom du fichier. */
export function parseSeoFile(raw: string, filename: string, existingSlugs: Set<string>, modifiedAt = new Date(0)): SeoPage {
  const { meta, body } = splitFrontMatter(raw, filename);
  const slug = nonEmpty(meta.slug, "slug", filename);
  if (!isSlug(slug)) throw new SeoError(`${filename} : slug inconnu « ${slug} » (attendus : ${SEO_SLUGS.join(", ")}).`);
  if (filename !== `${slug}.md`) throw new SeoError(`${filename} : le nom du fichier doit être ${slug}.md.`);

  const title = nonEmpty(meta.title, "title", filename);
  if ([...title].length > SEO_LIMITS.titleMax) throw new SeoError(`${filename} : title de ${[...title].length} caractères (maximum ${SEO_LIMITS.titleMax}).`);
  const metaDescription = nonEmpty(meta.metaDescription, "metaDescription", filename);
  if ([...metaDescription].length > SEO_LIMITS.metaDescriptionMax)
    throw new SeoError(`${filename} : metaDescription de ${[...metaDescription].length} caractères (maximum ${SEO_LIMITS.metaDescriptionMax}).`);
  const targetKeyword = nonEmpty(meta.targetKeyword, "targetKeyword", filename);

  const faqRaw = meta.faq ?? [];
  if (!Array.isArray(faqRaw)) throw new SeoError(`${filename} : « faq » doit être une liste de questions (q) et réponses (a).`);
  const faq = faqRaw.map((f, i) => {
    const o = (f ?? {}) as Record<string, unknown>;
    return { q: nonEmpty(o.q, `faq[${i + 1}].q`, filename), a: nonEmpty(o.a, `faq[${i + 1}].a`, filename) };
  });

  const sourcesRaw = meta.sources ?? [];
  if (!Array.isArray(sourcesRaw)) throw new SeoError(`${filename} : « sources » doit être une liste (title, url).`);
  const sources = sourcesRaw.map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>;
    const url = nonEmpty(o.url, `sources[${i + 1}].url`, filename);
    if (!/^https?:\/\/\S+$/i.test(url)) throw new SeoError(`${filename} : sources[${i + 1}].url n'est pas une adresse http(s) valide : « ${url} ».`);
    return { title: nonEmpty(o.title, `sources[${i + 1}].title`, filename), url };
  });

  const rendered = renderBody(body, filename, existingSlugs);
  return { slug, title, metaDescription, targetKeyword, faq, sources, bodyHtml: rendered.html, headings: rendered.headings, words: rendered.words, pendingLinks: rendered.pending, modifiedAt };
}

/** Charge toutes les pages présentes dans le dossier (les fichiers absents sont simplement ignorés). */
export function loadSeoPages(dir: string = SEO_DIR): SeoPage[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md") && isSlug(f.slice(0, -3)));
  } catch {
    return [];
  }
  const existing = new Set(files.map((f) => f.slice(0, -3)));
  return files
    .map((f) => parseSeoFile(readFileSync(join(dir, f), "utf8"), f, existing, statSync(join(dir, f)).mtime))
    .sort((a, b) => SEO_SLUGS.indexOf(a.slug) - SEO_SLUGS.indexOf(b.slug));
}

/** Comme loadSeoPages, mais collecte les erreurs de chaque fichier au lieu de s'arrêter à la première (pour l'outil de contrôle). */
export function loadSeoPagesReport(dir: string = SEO_DIR): { pages: SeoPage[]; errors: { file: string; message: string }[] } {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md") && isSlug(f.slice(0, -3)));
  } catch {
    return { pages: [], errors: [] };
  }
  const existing = new Set(files.map((f) => f.slice(0, -3)));
  const pages: SeoPage[] = [];
  const errors: { file: string; message: string }[] = [];
  for (const f of files) {
    try {
      pages.push(parseSeoFile(readFileSync(join(dir, f), "utf8"), f, existing, statSync(join(dir, f)).mtime));
    } catch (e) {
      errors.push({ file: f, message: e instanceof Error ? e.message : String(e) });
    }
  }
  pages.sort((x, y) => SEO_SLUGS.indexOf(x.slug) - SEO_SLUGS.indexOf(y.slug));
  return { pages, errors };
}

export function getSeoPage(slug: string, dir?: string): SeoPage | null {
  if (!isSlug(slug)) return null;
  return loadSeoPages(dir).find((p) => p.slug === slug) ?? null;
}

/** Données structurées schema.org FAQPage. Le caractère « < » est échappé pour un usage sûr dans une balise script. */
export function faqJsonLd(page: Pick<SeoPage, "faq">): string | null {
  if (page.faq.length === 0) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Entrées du sitemap : pages publiques fixes, plus les pages de contenu seulement si elles sont publiées. */
export function sitemapEntries(base: string, pages: Pick<SeoPage, "slug" | "modifiedAt">[], published: boolean) {
  const fixed = ["", "/methode", "/contact", "/mentions-legales", "/cgv", "/confidentialite"].map((p) => ({ url: `${base}${p}` }));
  const content = published ? pages.map((p) => ({ url: `${base}/${p.slug}`, lastModified: p.modifiedAt })) : [];
  return [...fixed, ...content];
}
