"use client";

import { withdrawFromChallenge } from "../actions";

export function WithdrawButton({ id }: { id: string }) {
  return (
    <form
      action={withdrawFromChallenge.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm("Retirer mon rapport de la comparaison ? Vous et votre ami ne verrez plus la comparaison.")) e.preventDefault();
      }}
    >
      <button type="submit" className="panel px-4 py-2 text-sm text-accent-2 hover:border-accent-2">Retirer mon rapport de la comparaison</button>
    </form>
  );
}
