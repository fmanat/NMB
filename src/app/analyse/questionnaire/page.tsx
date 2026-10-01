import { Doc } from "@/components/Doc";
import { TrackView } from "@/components/TrackView";
import { isFreeBeta } from "@/lib/mode";
import { QuestionnaireForm } from "../QuestionnaireForm";

export const metadata = { title: "Questionnaire", robots: { index: false } };

export default function Page() {
  return (
    <Doc title="Protocole A : questionnaire">
      <TrackView event="questionnaire_start" />
      <div className="mt-6">
        <QuestionnaireForm beta={isFreeBeta()} />
      </div>
    </Doc>
  );
}
