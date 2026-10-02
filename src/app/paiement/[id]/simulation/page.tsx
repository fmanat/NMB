import { notFound } from "next/navigation";
import { Doc } from "@/components/Doc";
import { getPaymentProvider } from "@/lib/payments";
import { simulatePaymentSuccess } from "../../actions";

export const metadata = { title: "Paiement (simulation)", robots: { index: false, follow: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const { id } = await params;
  const { ref } = await searchParams;
  if (getPaymentProvider().id !== "simulation" || process.env.NODE_ENV === "production" || !ref) notFound();
  return (
    <Doc title="Paiement (simulation)">
      <p className="mt-4 border border-accent-2/50 rounded-lg px-3 py-2 !text-accent-2">
        Mode simulation : aucun argent réel n&apos;est débité. Cette page remplace la page du prestataire de paiement.
      </p>
      <form action={simulatePaymentSuccess.bind(null, id, ref)} className="mt-6">
        <button type="submit" className="btn btn-primary btn-block-mobile">Simuler un paiement réussi</button>
      </form>
    </Doc>
  );
}
