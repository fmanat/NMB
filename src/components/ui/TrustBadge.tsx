import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Preuve de confiance : icône, titre court, une ligne d'explication. N'afficher que des affirmations vraies. */
export function TrustBadge({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-none grid place-items-center size-10 rounded-[10px] bg-soft text-accent">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <p className="font-semibold leading-tight">{title}</p>
        {children && <p className="t-small text-muted mt-1">{children}</p>}
      </div>
    </div>
  );
}
