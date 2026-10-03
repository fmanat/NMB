import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Marked, type Token, type Tokens } from "marked";

import { FigureError, resolveFigureTokens } from "./seoFigures";

/**
 * Pages de contenu. Le nom du fichier est <slug>.md. La nature d'une page (pilier, guide, information, page par centimètre)
 * se déduit de son slug : elle décide de la mise en page (réponse immédiate, courbe, calculateur prérempli, fil d'Ariane).
 */
export const PILLAR_SLUGS = ["taille-moyenne-penis", "taille-penis-normale", "percentile-penis"] as const;
export const GUIDE_SLUGS = [
  "taille-penis-par-pays",
  "comment-mesurer-son-penis",
  "circonference-moyenne-penis",
  "courbure-penis-normale",
  "taille-repos-erection",
  "etudes-taille-penis",
  "faq",
] as const;
export const INFO_SLUGS = ["a-propos"] as const;
/** Pages par centimètre : longueur en érection, de 10 à 20 cm. */
export const CM_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;
export type CmSize = (typeof CM_SIZES)[number];
export const cmSlug = (n: number) => `taille-penis-${n}-cm` as const;
const CM_SLUGS = CM_SIZES.map(cmSlug);

export const SEO_SLUGS = [...PILLAR_SLUGS, ...GUIDE_SLUGS, ...INFO_SLUGS, ...CM_SLUGS] as const;
export type SeoSlug = (typeof SEO_SLUGS)[number];
export type SeoKind = "pilier" | "guide" | "info" | "centimetre";

export function kindOf(slug: SeoSlug): SeoKind {
  if ((PILLAR_SLUGS as readonly string[]).includes(slug)) return "pilier";
  if ((INFO_SLUGS as readonly string[]).includes(slug)) return "info";
  if ((CM_SLUGS as readonly string[]).includes(slug)) return "centimetre";
  return "guide";
}

/** Taille (cm) d'une page par centimètre, sinon null. */
export function cmOf(slug: string): CmSize | null {
  const m = slug.match(/^taille-penis-(\d+)-cm$/);
  const n = m ? Number(m[1]) : NaN;
  return (CM_SIZES as readonly number[]).includes(n) ? (n as CmSize) : null;
}

export { RENAMED_SLUGS } from "./seoRenamed";

/** Pages publiques du site vers lesquelles le corps d'une page de contenu peut renvoyer (en plus de /, /analyse et des slugs). */
export const PUBLIC_PAGES = ["methode", "confidentialite", "cgv", "contact", "mentions-legales", "presse"] as const;

/** Blocs interactifs ou calculés insérés dans le corps par une ligne seule « [[nom]] ». */
export const BLOCKS = ["calculateur", "distribution", "tableau-percentiles", "tailles", "mesure"] as const;
export type BlockName = (typeof BLOCKS)[number];
export type BodySegment = { type: "html"; html: string } | { type: "block"; name: BlockName };

export const SEO_LIMITS = { titleMax: 60, metaDescriptionMax: 155, wordsMin: 600, wordsMax: 1500 } as const;
export const SEO_DIR = join(process.cwd(), "content", "seo");

export class SeoError extends Error {}

export type SeoFaq = { q: string; a: string };
export type SeoSource = { title: string; url: string };
export type Heading = { depth: 2 | 3; text: string; id: string };

export type SeoPage = {
  slug: SeoSlug;
  kind: SeoKind;
  /** Taille de la page par centimètre (longueur en érection), sinon null. */
  cm: CmSize | null;
  /** Titre de la page pour les moteurs (balise title, 60 caractères au plus). */
  title: string;
  /** Titre affiché (H1) ; à défaut, le titre. */
  h1: string;
  /** Libellé court du fil d'Ariane ; à défaut, le H1. */
  breadcrumb: string;
  /** Date de vérification du contenu (AAAA-MM-JJ), affichée sous le titre et reprise dans les données structurées. */
  verified: string | null;
  /** Chiffre clé de l'image de partage (déjà calculé) et son libellé. */
  ogFigure: string | null;
  ogLabel: string | null;
  metaDescription: string;
  targetKeyword: string;
  faq: SeoFaq[];
  sources: SeoSource[];
  bodyHtml: string;
  /** Corps découpé autour des blocs [[…]] (calculateur, courbe, tableau, tailles, mesure). */
  segments: BodySegment[];
  headings: Heading[];
  words: number;
  /** Liens internes vers des pages du lancement qui n'existent pas (encore). */
  pendingLinks: string[];
  modifiedAt: Date;
};

/**
 * Publication des pages de contenu : activée par défaut depuis la phase 1 du référencement (session SEO 1, 03/10/2026).
 * `SEO_PUBLISH=off` la coupe : pages en noindex, hors sitemap, et introuvables en production. Lu à la construction du site.
 */
export function isPublished(): boolean {
  return process.env.SEO_PUBLISH !== "off";
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

const SCALAR_KEYS = ["slug", "title", "h1", "breadcrumb", "metaDescription", "targetKeyword", "verified", "ogFigure", "ogLabel"] as const;
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
  if (base === "") return "/" + (hash ? `#${hash}` : "");
  if (base === "analyse" || (PUBLIC_PAGES as readonly string[]).includes(base)) return `/${base}` + (hash ? `#${hash}` : "");
  if (isSlug(base)) {
    if (!existing.has(base)) pending.add(base);
    return `/${base}` + (hash ? `#${hash}` : "");
  }
  throw new SeoError(`${file} : lien interne inconnu « ${href} » (autorisés : /, /analyse, le slug d'une page de contenu, ou /${PUBLIC_PAGES.join(", /")}).`);
}

/** Convertit le Markdown en HTML après validation stricte : titres H2/H3 seulement, ni image, ni HTML brut, liens contrôlés. */
export function renderBody(
  markdown: string,
  file: string,
  existingSlugs: Set<string>,
): { html: string; segments: BodySegment[]; headings: Heading[]; words: number; pending: string[] } {
  const marked = new Marked();
  let resolved: string;
  try {
    resolved = resolveFigureTokens(markdown, file);
  } catch (e) {
    throw new SeoError(e instanceof FigureError ? e.message : String(e));
  }
  const tokens = marked.lexer(resolved);
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
      paragraph(this: { parser: { parseInline: (t: Token[]) => string } }, { tokens, text }: Tokens.Paragraph) {
        const block = text.trim().match(/^\[\[([a-z-]+)\]\]$/);
        if (block) {
          if (!(BLOCKS as readonly string[]).includes(block[1])) throw new SeoError(`${file} : bloc inconnu « [[${block[1]}]] » (disponibles : ${BLOCKS.join(", ")}).`);
          return `<!--bloc:${block[1]}-->`;
        }
        return `<p>${this.parser.parseInline(tokens)}</p>\n`;
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

  const raw = marked.parser(tokens) as string;
  const segments: BodySegment[] = [];
  for (const [i, part] of raw.split(/<!--bloc:([a-z-]+)-->/).entries()) {
    if (i % 2 === 1) segments.push({ type: "block", name: part as BlockName });
    else if (part.trim() !== "") segments.push({ type: "html", html: part });
  }
  const html = raw.replace(/<!--bloc:[a-z-]+-->/g, "");
  const words = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").split(/\s+/).filter(Boolean).length;
  return { html, segments, headings, words, pending: [...pending] };
}

/** Lit et valide un fichier de page. Toute erreur de format est signalée en français, avec le nom du fichier. */
export function parseSeoFile(raw: string, filename: string, existingSlugs: Set<string>, modifiedAt = new Date(0)): SeoPage {
  const { meta, body } = splitFrontMatter(raw, filename);
  const slug = nonEmpty(meta.slug, "slug", filename);
  if (!isSlug(slug)) throw new SeoError(`${filename} : slug inconnu « ${slug} » (attendus : ${SEO_SLUGS.join(", ")}).`);
  if (filename !== `${slug}.md`) throw new SeoError(`${filename} : le nom du fichier doit être ${slug}.md.`);

  // Les jetons de chiffres {{…}} sont permis dans tous les champs de texte : ils sont remplacés avant les contrôles de longueur.
  const tok = (v: string, field: string) => {
    try {
      return resolveFigureTokens(v, `${filename}, ${field}`);
    } catch (e) {
      throw new SeoError(e instanceof Error ? e.message : String(e));
    }
  };
  const opt = (k: string) => (typeof meta[k] === "string" && (meta[k] as string).trim() !== "" ? tok((meta[k] as string).trim(), k) : null);
  const title = tok(nonEmpty(meta.title, "title", filename), "title");
  const metaDescription = tok(nonEmpty(meta.metaDescription, "metaDescription", filename), "metaDescription");
  const h1 = opt("h1") ?? title;
  const breadcrumb = opt("breadcrumb") ?? h1;
  const verified = opt("verified");
  if (verified !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(verified) || Number.isNaN(new Date(verified).getTime())))
    throw new SeoError(`${filename} : « verified » doit être une date AAAA-MM-JJ (trouvé « ${verified} »).`);
  const ogFigure = opt("ogFigure");
  const ogLabel = opt("ogLabel");
  if ((ogFigure === null) !== (ogLabel === null)) throw new SeoError(`${filename} : « ogFigure » et « ogLabel » vont ensemble.`);
  // Tous les dépassements de longueur sont signalés ensemble, pour ne pas obliger à corriger en plusieurs passes.
  const limitErrors: string[] = [];
  if ([...title].length > SEO_LIMITS.titleMax) limitErrors.push(`title de ${[...title].length} caractères (maximum ${SEO_LIMITS.titleMax})`);
  if ([...metaDescription].length > SEO_LIMITS.metaDescriptionMax)
    limitErrors.push(`metaDescription de ${[...metaDescription].length} caractères (maximum ${SEO_LIMITS.metaDescriptionMax})`);
  if (limitErrors.length) throw new SeoError(`${filename} : ${limitErrors.join(" ; ")}.`);
  const targetKeyword = nonEmpty(meta.targetKeyword, "targetKeyword", filename);

  const faqRaw = meta.faq ?? [];
  if (!Array.isArray(faqRaw)) throw new SeoError(`${filename} : « faq » doit être une liste de questions (q) et réponses (a).`);
  const faq = faqRaw.map((f, i) => {
    const o = (f ?? {}) as Record<string, unknown>;
    return { q: tok(nonEmpty(o.q, `faq[${i + 1}].q`, filename), `faq[${i + 1}].q`), a: tok(nonEmpty(o.a, `faq[${i + 1}].a`, filename), `faq[${i + 1}].a`) };
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
  return {
    slug,
    kind: kindOf(slug),
    cm: cmOf(slug),
    title,
    h1,
    breadcrumb,
    verified,
    ogFigure,
    ogLabel,
    metaDescription,
    targetKeyword,
    faq,
    sources,
    bodyHtml: rendered.html,
    segments: rendered.segments,
    headings: rendered.headings,
    words: rendered.words,
    pendingLinks: rendered.pending,
    modifiedAt,
  };
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

/** Pages accessibles au public : toutes une fois publiées (ou hors production, pour la relecture), aucune sinon. */
export function visibleSeoPages(dir?: string): SeoPage[] {
  return isPublished() || process.env.NODE_ENV !== "production" ? loadSeoPages(dir) : [];
}

/** Slugs des pages accessibles : un lien vers une page de contenu n'est affiché que si elle existe pour le visiteur. */
export function existingSlugs(dir?: string): Set<string> {
  return new Set(visibleSeoPages(dir).map((p) => p.slug));
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
/** Pages publiques fixes (hors pages de contenu) qui ont leur place dans le sitemap. La page presse suit la publication. */
export function fixedPublicPaths(published: boolean, beta = false): string[] {
  return ["", "/methode", "/contact", "/mentions-legales", beta ? "/conditions" : "/cgv", "/confidentialite"];
}

/**
 * Entrées du sitemap : pages publiques fixes, plus les pages de contenu seulement si elles sont publiées. Date de modification d'une
 * page de contenu : sa date de vérification (champ verified), à défaut la date du fichier.
 */
export function sitemapEntries(base: string, pages: Pick<SeoPage, "slug" | "modifiedAt" | "verified">[], published: boolean, beta = false) {
  const fixed = fixedPublicPaths(published, beta).map((p) => ({ url: `${base}${p}` }));
  const content = published ? pages.map((p) => ({ url: `${base}/${p.slug}`, lastModified: p.verified ? new Date(p.verified) : p.modifiedAt })) : [];
  return [...fixed, ...content];
}
