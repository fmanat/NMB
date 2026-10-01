import type { Page } from "@playwright/test";

// Détection des problèmes de mise en page (débordement horizontal, texte coupé, textes qui se recouvrent) d'après les rectangles réels
// de chaque morceau de texte. Utilisée par mobile.spec.ts (bêta) et mobile-payant.spec.ts (version payante).
/** Problèmes de mise en page de la page affichée (liste vide = rien à signaler). */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw + 1) problems.push(`défilement horizontal : la page fait ${document.documentElement.scrollWidth}px pour ${vw}px`);

    type Item = { l: number; t: number; r: number; b: number; text: string; el: Element };
    const items: Item[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hiddenAncestor = (el: Element) => !!el.closest('[aria-hidden="true"], script, style, noscript, template, dialog:not([open]), nextjs-portal');
    const scrollableX = (el: Element | null) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const ox = getComputedStyle(e).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
      return false;
    };
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = (node.textContent ?? "").trim();
      const el = node.parentElement;
      if (!text || !el || hiddenAncestor(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue; // texte réservé aux lecteurs d'écran (1 px)
      const range = document.createRange();
      range.selectNodeContents(node);
      // Une fenêtre modale ouverte recouvre volontairement la page : seul son contenu est contrôlé.
      const modal = document.querySelector("dialog[open]");
      if (modal && !modal.contains(el)) continue;
      const lh = parseFloat(cs.lineHeight); // « normal » : NaN
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue;
        // Le rectangle d'un texte suit la police, pas l'interligne : un interligne serré (leading-none) le fait déborder sur la ligne voisine
        // sans que les caractères se touchent. On le ramène à la hauteur de la ligne, centré.
        const h = Number.isFinite(lh) && lh < r.height ? lh : r.height;
        const top = r.top + (r.height - h) / 2;
        items.push({ l: r.left, t: top, r: r.right, b: top + h, text: text.slice(0, 28), el });
        if (r.right > vw + 1 && !scrollableX(el)) problems.push(`texte coupé à droite (dépasse de ${Math.round(r.right - vw)}px) : « ${text.slice(0, 40)} »`);
        if (r.left < -1 && !scrollableX(el)) problems.push(`texte coupé à gauche : « ${text.slice(0, 40)} »`);
      }
    }
    for (const e of Array.from(document.querySelectorAll("body *"))) {
      const cs = getComputedStyle(e);
      if ((cs.overflowX === "hidden" || cs.overflowX === "clip") && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 1 && (e.textContent ?? "").trim() && !hiddenAncestor(e)) {
        problems.push(`contenu masqué par overflow : <${e.tagName.toLowerCase()} class="${String((e as HTMLElement).className).slice(0, 50)}"> (${e.scrollWidth}px dans ${e.clientWidth}px)`);
      }
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.el === b.el) continue;
        const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ix <= 2 || iy <= 2) continue;
        const small = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t));
        if ((ix * iy) / small > 0.2) problems.push(`recouvrement : « ${a.text} » et « ${b.text} »`);
      }
    }
    return Array.from(new Set(problems));
  });
}
