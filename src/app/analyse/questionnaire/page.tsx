import { redirect } from "next/navigation";
import { isFreeBeta } from "@/lib/mode";
import { photoAccess } from "@/lib/photoAccess";
import { QuestionnairePage } from "../QuestionnairePage";

export const metadata = { title: "Questionnaire", robots: { index: false } };

// Bêta gratuite : le questionnaire est directement sur /analyse (sauf en bêta photo, où /analyse propose le choix A ou B).
// Version payante : protocole A après le choix du protocole.
export default async function Page() {
  if (isFreeBeta() && !(await photoAccess()).available) redirect("/analyse");
  return <QuestionnairePage />;
}
