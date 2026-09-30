"use client";

import { useActionState } from "react";
import { REPORT_ACCESS } from "@/config/site";
import { pay, type PayState } from "../actions";

export function PayForm({ reportId, price }: { reportId: string; price: string }) {
  const [state, action, pending] = useActionState<PayState, FormData>(pay.bind(null, reportId), {});
  return (
    <form action={action} className="panel p-5 space-y-4">
      <p className="text-sm text-muted">Paiement unique, sans abonnement. Rapport accessible pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.</p>
      <p className="num text-3xl text-accent-2">{price}</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="waiver" className="mt-1 accent-[var(--accent)]" />
        <span>Je demande l&apos;accès immédiat à mon rapport, je renonce à mon droit de rétractation et je reconnais le perdre dès que l&apos;accès commence.</span>
      </label>
      {state.error && <p className="text-sm text-accent-2" role="alert">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Redirection…" : `Payer ${price}`}
      </button>
    </form>
  );
}
