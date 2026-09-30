/** Les fournisseurs simulés ne doivent jamais tourner en production : le site ne doit pas démarrer sans les vrais. */
export function assertNotProduction(name: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Le fournisseur simulé « ${name} » est interdit en production : branchez un vrai prestataire.`);
  }
}
