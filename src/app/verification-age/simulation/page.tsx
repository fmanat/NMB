import { notFound } from "next/navigation";
import { Doc } from "@/components/Doc";
import { getAgeProvider } from "@/lib/providers";
import { simulateAgeSuccess } from "../actions";

export const metadata = { title: "Vérification d'âge (simulation)", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const { retour } = await searchParams;
  if (getAgeProvider().id !== "simulation" || process.env.NODE_ENV === "production") notFound();
  return (
    <Doc title="Vérification d'âge (simulation)">
      <p className="mt-4 border border-accent-2/50 rounded-lg px-3 py-2 !text-accent-2">
        Mode simulation : aucune vérification réelle n&apos;est effectuée. Cette page remplace la page du prestataire.
      </p>
      <form action={simulateAgeSuccess.bind(null, retour ?? "")} className="mt-6">
        <button type="submit" className="btn-primary">Simuler une vérification réussie</button>
      </form>
    </Doc>
  );
}
