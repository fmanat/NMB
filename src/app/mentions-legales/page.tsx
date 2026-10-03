import { COMPANY, HOST } from "@/config/company";
import { Doc } from "@/components/Doc";

export const metadata = { title: "Mentions légales", alternates: { canonical: "/mentions-legales" } };

export default function Page() {
  return (
    <Doc title="Mentions légales">
      <h2>Contact</h2>
      <ul>
        <li>Contact : {COMPANY.contactEmail} (voir aussi la page Contact et signalement)</li>
      </ul>

      <h2>Protection des données</h2>
      <ul>
        <li>Les informations sur les données personnelles figurent dans la politique de confidentialité.</li>
      </ul>

      <h2>Hébergeur</h2>
      <ul>
        <li>Raison sociale : {HOST.legalName}</li>
        <li>Adresse : {HOST.address}</li>
        <li>Lieu d&apos;hébergement des données : {HOST.dataRegion}</li>
      </ul>
    </Doc>
  );
}
