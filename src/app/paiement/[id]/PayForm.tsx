"use client";

import Link from "next/link";
import { useActionState } from "react";
import { track } from "@/lib/track";
import { pay, type PayState } from "../actions";

export function PayForm({ reportId, price, crypto = false, termsHref }: { reportId: string; price: string; crypto?: boolean; termsHref: string }) {
  const [state, action, pending] = useActionState<PayState, FormData>(pay.bind(null, reportId), {});
  return (
    <form action={action} onSubmit={() => track("purchase_start")} className="panel p-5 md:p-6 space-y-5">
      <div className="text-center">
        <p className="num t-data-xl !text-[var(--foreground)]">{price}</p>
        <p className="mt-2 t-small text-muted">
          <svg className="mr-1.5 inline -mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          {/* Le moyen de paiement (cryptomonnaie) est dit avant le clic : le client ne doit pas s'attendre à une carte bancaire. */}
          {crypto ? "Paiement sécurisé en cryptomonnaie par notre prestataire" : "Paiement sécurisé par notre prestataire"}
        </p>
      </div>
      {crypto && (
        <details className="rounded-[10px] border border-[var(--border)] px-4 py-3 t-small">
          <summary className="cursor-pointer font-semibold">Comment payer en cryptomonnaie ?</summary>
          <div className="mt-2 space-y-2 text-muted">
            <p>
              La page de paiement de Plisio s&apos;ouvre : choisissez une monnaie (Bitcoin, Ethereum, USDT, USDC, Solana, Litecoin), puis envoyez le
              montant indiqué depuis votre portefeuille, en scannant le QR code ou en copiant l&apos;adresse.
            </p>
            <p>
              Pas encore de portefeuille ? Une application de portefeuille de cryptomonnaie permet généralement d&apos;en acheter par carte bancaire avant
              d&apos;envoyer le paiement ; comptez ses frais et un délai lors de la première utilisation.
            </p>
            <p>Votre rapport se débloque dès que le réseau confirme le paiement, en général en quelques minutes.</p>
          </div>
        </details>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="waiver" className="mt-1 accent-[var(--accent)]" />
        <span>Je demande l&apos;accès immédiat à mon rapport, je renonce à mon droit de rétractation et je reconnais le perdre dès que l&apos;accès commence.</span>
      </label>
      <p className="t-small text-muted">
        Voir les <Link href={termsHref} className="underline">{termsHref === "/cgv" ? "conditions générales de vente" : "conditions d’utilisation"}</Link>.
      </p>
      {state.error && <p className="text-sm text-[var(--bm-error-text)]" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Redirection…" : `Payer ${price}`}
      </button>
    </form>
  );
}
