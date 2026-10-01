import { notFound, redirect } from "next/navigation";
import { Doc } from "@/components/Doc";
import { formatEur } from "@/config/site";
import { PRIVATE_SOCIAL } from "@/lib/metadata";
import { getReportView } from "@/lib/view";
import { PayForm } from "./PayForm";

export const metadata = { title: "Paiement", robots: { index: false, follow: false }, ...PRIVATE_SOCIAL };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getReportView(id);
  if (view.status === "not_found") notFound();
  if (view.status === "unlocked" || view.relocked) redirect(`/r/${id}`); // un rapport reverrouillé (remboursement, contestation) ne se repaie pas ici
  return (
    <Doc title="Débloquer mon rapport">
      <div className="mt-6">
        <PayForm reportId={id} price={formatEur(view.priceEur)} />
      </div>
    </Doc>
  );
}
