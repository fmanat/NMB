// Supprime proprement une photo de photos-test/ (écrasement puis suppression) et vérifie qu'il ne reste rien. Voir docs/TEST-PHOTO.md.
//   npm run photo:supprimer -- photos-test/ma-photo.jpg
//   npm run photo:supprimer -- --tout        (vide photos-test/)
//   npm run photo:supprimer -- --verifier    (compte ce qui reste, ne supprime rien)
import { projectRoot, runDeleteCli } from "./lib/photoTest";

process.exit(runDeleteCli(process.argv.slice(2), { root: projectRoot(), out: (line) => console.log(line) }));
