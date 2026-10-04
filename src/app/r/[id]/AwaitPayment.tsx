"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Retour de la page du prestataire de paiement : la notification signée qui débloque le rapport peut arriver quelques secondes
 * après le visiteur, ou bien plus tard pour une cryptomonnaie (confirmations du réseau). On recharge la page toutes les 3 secondes
 * pendant 1 minute, puis toutes les 20 secondes jusqu'à 20 minutes ; le rapport ne s'ouvre jamais sans cette notification.
 */
export function AwaitPayment() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const MAX = 20 + 57; // 20 × 3 s puis 57 × 20 s : environ 20 minutes
  useEffect(() => {
    if (tries >= MAX) return;
    const t = setTimeout(
      () => {
        router.refresh();
        setTries((n) => n + 1);
      },
      tries < 20 ? 3000 : 20_000,
    );
    return () => clearTimeout(t);
  }, [tries, router, MAX]);
  return (
    <p role="status" className="text-sm text-accent-2">
      {tries < MAX
        ? "Confirmation du paiement en cours… cette page se met à jour toute seule. Pour une cryptomonnaie, comptez de quelques minutes à environ une heure selon le réseau."
        : "Le paiement n'est pas encore confirmé par le prestataire. Rechargez cette page dans quelques minutes : votre rapport s'ouvrira dès la confirmation."}
    </p>
  );
}
