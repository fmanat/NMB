import type { ReactNode } from "react";

/** Carte standard (fond blanc, bordure fine, rayon 14 px). `selected` : bordure et fond bleutés ; `soft` : synthèse ; `hover` : survol. */
export function Card({ children, selected, soft, hover, as: Tag = "div", className = "" }: { children: ReactNode; selected?: boolean; soft?: boolean; hover?: boolean; as?: "div" | "section" | "article" | "li" | "aside"; className?: string }) {
  const cls = ["card", selected ? "card-selected" : "", soft ? "card-soft" : "", hover ? "card-hover" : "", className].filter(Boolean).join(" ");
  return <Tag className={cls}>{children}</Tag>;
}
