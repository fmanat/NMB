import { redirect } from "next/navigation";
import { isFreeBeta } from "@/lib/mode";
import { photoAccess } from "@/lib/photoAccess";
import { QuestionnairePage } from "../QuestionnairePage";

export const metadata = { title: "Questionnaire", robots: { index: false } };

// Bêta gratuite : le test est directement sur /analyse. Seule exception : l'aperçu administrateur, dont /analyse garde l'écran de choix
// et renvoie ici pour le questionnaire. Version payante : protocole A après le choix du protocole.
export default async function Page() {
  if (isFreeBeta()) {
    const { available, preview } = await photoAccess();
    if (!preview) redirect("/analyse");
    return <QuestionnairePage photo={available} />;
  }
  return <QuestionnairePage />;
}
