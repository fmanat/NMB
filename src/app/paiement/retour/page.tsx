import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { PAY_COOKIE, returnTarget } from "@/lib/payments/return";

export const metadata = { title: "Retour de paiement", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ echec?: string }> }) {
  const { echec } = await searchParams;
  const target = returnTarget((await cookies()).get(PAY_COOKIE)?.value, echec === "1");
  if (target) redirect(target);
  return (
    <Doc title="Retour de paiement">
      <p className="mt-4">
        Nous n&apos;avons pas pu vous ramener automatiquement à votre rapport. Retrouvez-le avec son lien privé (celui de vos favoris). Si
        votre paiement a abouti, le rapport s&apos;ouvre dès que la confirmation du prestataire de paiement nous est parvenue, en général
        en quelques secondes.
      </p>
    </Doc>
  );
}
