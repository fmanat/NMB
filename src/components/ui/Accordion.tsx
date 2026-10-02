import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Accordéon natif (<details>) : accessible au clavier et sans JavaScript, fermé par défaut. */
export function Accordion({ question, children, open }: { question: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="accordion" open={open}>
      <summary>
        <span>{question}</span>
        <Icon name="chevronDown" size={20} className="chevron" />
      </summary>
      <div className="accordion-body">{children}</div>
    </details>
  );
}
