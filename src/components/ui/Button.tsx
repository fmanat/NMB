import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

type Common = {
  variant?: ButtonVariant;
  /** Flèche à droite (« Démarrer mon analyse → »). */
  arrow?: boolean;
  /** Pleine largeur sur mobile (CTA principal). */
  fullOnMobile?: boolean;
  small?: boolean;
  /** État de chargement : le bouton garde sa largeur et ne réagit plus. */
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

export function buttonClass({ variant = "primary", fullOnMobile, small, loading, className }: Omit<Common, "children" | "arrow">): string {
  return ["btn", `btn-${variant}`, fullOnMobile ? "btn-block-mobile" : "", small ? "btn-sm" : "", loading ? "btn-loading" : "", className ?? ""].filter(Boolean).join(" ");
}

/** Bouton (ou lien d'apparence bouton si `href`). Ne gère que l'interaction et l'apparence. */
export function Button(props: Common & ({ href: string } | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>))) {
  const { variant, arrow, fullOnMobile, small, loading, className, children, ...rest } = props;
  const cls = buttonClass({ variant, fullOnMobile, small, loading, className });
  const content = (
    <>
      <span>{children}</span>
      {arrow && <Icon name="arrowRight" size={18} />}
    </>
  );
  if ("href" in rest && rest.href !== undefined) return <Link href={rest.href} className={cls}>{content}</Link>;
  const { href: _h, ...btn } = rest as ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
  void _h;
  return (
    <button type="button" {...btn} className={cls} disabled={btn.disabled || loading} aria-busy={loading || undefined}>
      {content}
    </button>
  );
}
