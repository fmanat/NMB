import { Icon } from "@/components/ui/Icon";

/** Indicateur d'étapes du parcours : terminé (bleu + coche), actif (bleu), à venir (gris). `current` commence à 0. */
export function ProgressStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <nav aria-label="Étapes du parcours">
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex-1 flex flex-col items-center relative" aria-current={active ? "step" : undefined}>
              {i > 0 && <span className={`absolute top-4 right-1/2 w-full h-[2px] ${i <= current ? "bg-accent" : "bg-[var(--border)]"}`} aria-hidden="true" />}
              <span
                className={`relative z-10 grid place-items-center size-8 rounded-full border-2 text-[14px] font-semibold num ${
                  done || active ? "bg-accent border-accent text-white" : "bg-[var(--surface)] border-[var(--border)] text-muted"
                }`}
              >
                {done ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <span className={`mt-2 text-center t-caption ${active ? "text-foreground font-semibold" : "text-muted"}`}>
                {s}
                <span className="sr-only">{done ? " (terminé)" : active ? " (étape en cours)" : " (à venir)"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
