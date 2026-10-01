import { COMPANY, HOST } from "@/config/company";
import { Doc } from "@/components/Doc";

export const metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <Doc title="Mentions légales" draft>
      <h2>Éditeur du site</h2>
      <p>Le site Bitomètre est édité par une société de droit anglais (« private limited company », Ltd).</p>
      <ul>
        <li>Raison sociale : {COMPANY.legalName}</li>
        <li>Numéro d&apos;immatriculation (Companies House, Royaume-Uni) : {COMPANY.companiesHouseNumber}</li>
        <li>Siège social : {COMPANY.registeredOffice}</li>
        <li>Directeur de la publication : {COMPANY.publicationDirector}</li>
        <li>Contact : {COMPANY.contactEmail} (voir aussi la page Contact et signalement)</li>
      </ul>

      <h2>Protection des données</h2>
      <ul>
        <li>Autorité de protection des données du Royaume-Uni (Information Commissioner&apos;s Office, ICO) : numéro d&apos;enregistrement {COMPANY.icoNumber}</li>
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
