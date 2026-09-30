import { Doc } from "@/components/Doc";

export const metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <Doc title="Mentions légales" draft>
      <ul className="mt-6">
        <li>Éditeur : ________</li>
        <li>Siège : ________</li>
        <li>SIREN : ________</li>
        <li>Directeur de la publication : ________</li>
        <li>Hébergeur : ________</li>
        <li>Contact : voir la page Contact et signalement</li>
      </ul>
    </Doc>
  );
}
