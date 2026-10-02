import { redirect } from "next/navigation";
import { isFreeBeta } from "@/lib/mode";
import { QuestionnairePage } from "../QuestionnairePage";

export const metadata = { title: "Questionnaire", robots: { index: false } };

// Bêta gratuite : le questionnaire est directement sur /analyse. Version payante : protocole A après le choix du protocole.
export default function Page() {
  if (isFreeBeta()) redirect("/analyse");
  return <QuestionnairePage />;
}
