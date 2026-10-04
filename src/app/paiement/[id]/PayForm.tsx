"use client";

import { useActionState } from "react";
import { REPORT_ACCESS } from "@/config/site";
import { pay, type PayState } from "../actions";

export function PayForm({ reportId, price, crypto = false }: { reportId: string; price: string; crypto?: boolean }) {
  const [state, action, pending] = useActionState<PayState, FormData>(pay.bind(null, reportId), {});
  return (
    <form action={action} className="panel p-5 space-y-4">
      <p className="text-sm text-muted">Paiement unique, sans abonnement. Rapport accessible pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.</p>
      <p className="num t-data-xl">{price}</p>
      {crypto && (
        <p className="text-sm text-muted">
          Paiement en cryptomonnaie (BTC, ETH, LTC, SOL, ou USDT et USDC sur Ethereum, Tron ou Solana) sur la page de paiement de Plisio, notre prestataire. Le rapport
          s&apos;ouvre dès que Plisio confirme le paiement complet : selon la monnaie, de quelques minutes à environ une heure.
        </p>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="waiver" className="mt-1 accent-[var(--accent)]" />
        <span>Je demande l&apos;accès immédiat à mon rapport, je renonce à mon droit de rétractation et je reconnais le perdre dès que l&apos;accès commence.</span>
      </label>
      {state.error && <p className="text-sm text-[var(--bm-error-text)]" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Redirection…" : `Payer ${price}`}
      </button>
    </form>
  );
}
