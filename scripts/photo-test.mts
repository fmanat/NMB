// Test de la formule photo sur VOTRE photo, en local. Voir docs/TEST-PHOTO.md.
//   npm run photo:test -- photos-test/ma-photo.jpg --etat erection --longueur 14,2 --circonference 12,1 --supprimer
//   npm run photo:test -- --simulation        (essai à blanc, aucun coût)
// N'affiche que du texte. La clé xAI est lue dans .env par ce script (jamais affichée) ; rien n'est écrit en base.
import { projectRoot, runPhotoTestCli } from "./lib/photoTest";

const root = projectRoot();
const code = await runPhotoTestCli(process.argv.slice(2), {
  root,
  out: (line) => console.log(line),
  loadEnv: () => {
    try {
      process.loadEnvFile(`${root}/.env`);
      return true;
    } catch {
      return false;
    }
  },
});
process.exit(code);
