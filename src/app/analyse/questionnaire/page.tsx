import { Doc } from "@/components/Doc";
import { QuestionnaireForm } from "../QuestionnaireForm";

export const metadata = { title: "Questionnaire", robots: { index: false } };

export default function Page() {
  return (
    <Doc title="Protocole A : questionnaire">
      <div className="mt-6">
        <QuestionnaireForm />
      </div>
    </Doc>
  );
}
