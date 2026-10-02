// Identité de l'éditeur (société de droit anglais, « private limited company »).
// Tant qu'une valeur est un marqueur « [À COMPLÉTER : ...] », le site refuse de s'ouvrir au public (voir src/proxy.ts :
// sans mot de passe de protection, il répond 503). Remplacez chaque marqueur par la valeur réelle, ici, puis reconstruisez.
// L'établissement en France n'est pas encore immatriculé : il n'est volontairement mentionné nulle part.

const todo = (what: string) => `[À COMPLÉTER : ${what}]`;

export const COMPANY = {
  legalName: todo("raison sociale de la Ltd"),
  companiesHouseNumber: todo("numéro Companies House"),
  registeredOffice: todo("adresse du siège social"),
  publicationDirector: todo("nom du directeur de la publication"),
  icoNumber: 'enregistrement en cours', // décision du propriétaire (02/10/2026) : à remplacer par le numéro dès qu'il est délivré
  contactEmail: todo("adresse e-mail de contact"),
} as const;

// Hébergeur (mentions légales). Nom lu sur railway.com/legal/acceptable-use ; adresse à relever sur railway.com/legal.
export const HOST = {
  legalName: 'Railway Corporation (États-Unis)',
  // Source : conditions d'utilisation de Railway (https://railway.com/legal/terms : « Address: 548 Market St Suite 68956, San Francisco, California 94104 »)
  // et accord de traitement des données (https://railway.com/legal/dpa : « Railway Corporation, 548 Market St PMB 68956, San Francisco, California 94104 »), lus le 02/10/2026.
  address: '548 Market St, PMB 68956, San Francisco, California 94104, États-Unis',
  dataRegion: 'Union européenne (région Europe de Railway)',
} as const;

const MARKER = "[À COMPLÉTER";

/** Valeurs de COMPANY qui sont encore des marqueurs. */
export function missingCompanyFields(company: Record<string, string> = { ...COMPANY, hostAddress: HOST.address }): string[] {
  return Object.entries(company)
    .filter(([, v]) => v.includes(MARKER))
    .map(([k]) => k);
}

export const hasCompanyPlaceholders = () => missingCompanyFields().length > 0;
