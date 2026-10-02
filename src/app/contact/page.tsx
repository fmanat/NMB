import { Doc } from "@/components/Doc";
import { SITE } from "@/config/site";

export const metadata = { title: "Contact et signalement" };

export default function Page() {
  return (
    <Doc title="Contact et signalement">
      <p className="mt-4">Pour toute question ou pour signaler un contenu : {SITE.contactEmail}.</p>
    </Doc>
  );
}
