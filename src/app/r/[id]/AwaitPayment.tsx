"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Retour de la page du prestataire de paiement : la notification signée qui débloque le rapport peut arriver quelques secondes
 * après le visiteur. On recharge la page toutes les 3 secondes (pendant 1 minute au plus) ; le rapport ne s'ouvre jamais
 * sans cette notification, quoi que dise l'adresse de la page.
 */
export function AwaitPayment() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= 20) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [tries, router]);
  return (
    <p role="status" className="text-sm text-accent-2">
      {tries < 20
        ? "Confirmation du paiement en cours… cette page se met à jour toute seule."
        : "Le paiement n'est pas encore confirmé par le prestataire. Rechargez cette page dans quelques minutes : votre rapport s'ouvrira dès la confirmation."}
    </p>
  );
}
