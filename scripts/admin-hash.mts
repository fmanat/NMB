// Prépare l'accès à l'administration : transforme un mot de passe en empreinte à coller dans .env.
//
//   npm run admin:hash -- "votre mot de passe d'au moins 12 caractères"
//
// Le mot de passe lui-même n'est jamais écrit dans .env : seule son empreinte l'est.
// Attention : la commande peut rester dans l'historique de votre terminal ; effacez-la ensuite si besoin.

import { randomBytes } from "node:crypto";
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/admin/auth";

const password = process.argv.slice(2).join(" ");
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Indiquez un mot de passe d'au moins ${MIN_PASSWORD_LENGTH} caractères :\n  npm run admin:hash -- "mon mot de passe"`);
  process.exit(1);
}

console.log("Collez ces deux lignes dans votre fichier .env (puis redémarrez le site) :\n");
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
console.log("\nL'administration est ensuite disponible à l'adresse /admin.");
