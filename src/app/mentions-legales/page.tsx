import { Doc } from "@/components/Doc";

export const metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <Doc title="Mentions légales" draft>
      <h2>Éditeur du site</h2>
      <p>
        Le site Bitomètre est édité par une société de droit anglais (« private limited company », Ltd) disposant d&apos;un
        établissement en France.
      </p>
      <ul>
        <li>Raison sociale : ________</li>
        <li>Numéro d&apos;immatriculation (Companies House, Royaume-Uni) : ________</li>
        <li>Siège social (Royaume-Uni) : ________</li>
        <li>Établissement en France : adresse ________ ; SIREN ________</li>
        <li>Directeur de la publication : ________</li>
        <li>Contact : voir la page Contact et signalement</li>
      </ul>

      <h2>Protection des données</h2>
      <ul>
        <li>Autorité de protection des données du Royaume-Uni (Information Commissioner&apos;s Office, ICO) : numéro d&apos;enregistrement ________</li>
        <li>Les informations sur les données personnelles figurent dans la politique de confidentialité.</li>
      </ul>

      <h2>Hébergeur</h2>
      <ul>
        <li>Raison sociale : ________</li>
        <li>Adresse : ________</li>
      </ul>
    </Doc>
  );
}
