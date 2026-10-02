import { redirect } from "next/navigation";
import { isFreeBeta, isPhotoBeta } from "@/lib/mode";
import { QuestionnairePage } from "../QuestionnairePage";

export const metadata = { title: "Questionnaire", robots: { index: false } };

// Bêta gratuite : le questionnaire est directement sur /analyse (sauf en bêta photo, où /analyse propose le choix A ou B).
// Version payante : protocole A après le choix du protocole.
export default function Page() {
  if (isFreeBeta() && !isPhotoBeta()) redirect("/analyse");
  return <QuestionnairePage />;
}
