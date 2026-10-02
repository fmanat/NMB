// Seule information publique sur l'éditeur : l'adresse de contact. Aucune identité de société n'est affichée sur le site.

export const COMPANY = {
  contactEmail: "contact@bitometre.com",
} as const;

// Hébergeur (mentions légales). Nom lu sur railway.com/legal/acceptable-use ; adresse à relever sur railway.com/legal.
export const HOST = {
  legalName: 'Railway Corporation (États-Unis)',
  // Source : conditions d'utilisation de Railway (https://railway.com/legal/terms : « Address: 548 Market St Suite 68956, San Francisco, California 94104 »)
  // et accord de traitement des données (https://railway.com/legal/dpa : « Railway Corporation, 548 Market St PMB 68956, San Francisco, California 94104 »), lus le 02/10/2026.
  address: '548 Market St, PMB 68956, San Francisco, California 94104, États-Unis',
  dataRegion: 'Union européenne (région Europe de Railway)',
} as const;
