// Bêta de la formule photo (bloc 6 de la session de nuit 4) : variable PHOTO_BETA, désactivée par défaut, valeur reconnue « on » uniquement.
// Fonctions PURES (reçoivent l'environnement), testées par tests/photo-beta.test.ts. Aucun import du reste du site.
//
// Règles :
//  - PHOTO_BETA n'a d'effet qu'en bêta gratuite (FREE_BETA=on) : formule B seule, gratuite ; C, paiement et CGV restent masqués ;
//  - GARDE-FOU DE PRODUCTION : en NODE_ENV=production, la formule photo refuse de s'activer tant qu'un prestataire RÉEL de vérification
//    d'âge n'est pas configuré (AGE_PROVIDER = ageverif ou yoti, avec ses variables obligatoires), ni tant qu'un fournisseur simulé
//    (vision, captcha, filtrage) est réglé ; PHOTO_BETA est alors traitée comme désactivée et un avertissement est journalisé au démarrage ;
//  - hors production (développement, tests), les fournisseurs simulés restent utilisables.

export type Env = Record<string, string | undefined>;

/** Variables obligatoires par prestataire réel de vérification d'âge. Yoti : adaptateur à écrire (bloc 8) ; noms réservés dès maintenant. */
export const AGE_PROVIDER_REQUIRED_VARS: Readonly<Record<string, readonly string[]>> = {
  ageverif: ["AGEVERIF_CLIENT_ID", "AGEVERIF_CLIENT_SECRET", "AGE_TOKEN_SECRET", "SITE_URL"],
  yoti: ["YOTI_CLIENT_SDK_ID", "YOTI_KEY_PEM", "AGE_TOKEN_SECRET", "SITE_URL"],
};
export const REAL_AGE_PROVIDERS: readonly string[] = Object.keys(AGE_PROVIDER_REQUIRED_VARS);

/** PHOTO_BETA demandée (valeur exactement « on »). Ne dit pas si elle est effectivement active : voir photoBetaDecision. */
export const isPhotoBetaRequested = (env: Env = process.env): boolean => env.PHOTO_BETA === "on";

export type PhotoBetaDecision = {
  /** PHOTO_BETA=on dans la configuration. */
  requested: boolean;
  /** La formule photo est réellement ouverte (bêta gratuite + garde-fous satisfaits). */
  active: boolean;
  /** Raisons du refus (vide si active, ou si non demandée). Journalisées au démarrage, jamais affichées aux visiteurs. */
  reasons: string[];
};

const filled = (env: Env, name: string) => typeof env[name] === "string" && env[name]!.trim() !== "";

/** Décision pure : la bêta photo est-elle active, et sinon pourquoi. */
export function photoBetaDecision(env: Env = process.env): PhotoBetaDecision {
  const requested = isPhotoBetaRequested(env);
  if (!requested) return { requested: false, active: false, reasons: [] };
  const reasons: string[] = [];
  if (env.FREE_BETA !== "on") reasons.push("FREE_BETA n'est pas « on » : la bêta de la formule photo n'existe que dans la bêta gratuite.");
  if (env.NODE_ENV === "production") {
    const provider = env.AGE_PROVIDER ?? "";
    const required = AGE_PROVIDER_REQUIRED_VARS[provider];
    if (!required) {
      reasons.push(`AGE_PROVIDER=« ${provider || "(vide)"} » : un prestataire réel de vérification d'âge est exigé en production (${REAL_AGE_PROVIDERS.join(", ")}).`);
    } else {
      const missing = required.filter((v) => !filled(env, v));
      if (missing.length) reasons.push(`AGE_PROVIDER=${provider} : variables manquantes : ${missing.join(", ")}.`);
    }
    if (env.VISION_PROVIDER !== "xai") reasons.push("VISION_PROVIDER doit être « xai » en production.");
    else if (!filled(env, "XAI_API_KEY")) reasons.push("XAI_API_KEY manquante.");
    if (env.CAPTCHA_PROVIDER !== "altcha") reasons.push("CAPTCHA_PROVIDER doit être « altcha » en production.");
    else if (!filled(env, "ALTCHA_HMAC_KEY")) reasons.push("ALTCHA_HMAC_KEY manquante.");
    if (env.SCREENING_PROVIDER === "simulation" || env.SCREENING_PROVIDER === "off") {
      reasons.push("SCREENING_PROVIDER « simulation » ou « off » est interdit en production (laisser vide : filtrage absent, avec avertissement).");
    }
  }
  return { requested, active: reasons.length === 0, reasons };
}

export const isPhotoBetaActive = (env: Env = process.env): boolean => photoBetaDecision(env).active;

/** Filtrage d'empreintes non configuré (SCREENING_PROVIDER vide ou absente). */
export const isScreeningAbsent = (env: Env = process.env): boolean => !filled(env, "SCREENING_PROVIDER");

export const SCREENING_ABSENT_WARNING =
  "Filtrage d'empreintes non configuré (SCREENING_PROVIDER vide) : les photos sont analysées sans comparaison avec les bases d'images déjà répertoriées. Aucun libellé du site ne doit prétendre le contraire.";

/** Avertissements à journaliser au démarrage du serveur (liste vide : rien à signaler). */
export function startupWarnings(env: Env = process.env): string[] {
  const out: string[] = [];
  const d = photoBetaDecision(env);
  if (d.requested && !d.active) out.push(`PHOTO_BETA=on ignorée (formule photo désactivée) : ${d.reasons.join(" ")}`);
  // Le filtrage ne concerne que les formules photo : hors bêta gratuite (version payante) ou en bêta photo active.
  const photoFlowExists = env.FREE_BETA !== "on" || d.active;
  if (photoFlowExists && isScreeningAbsent(env)) out.push(SCREENING_ABSENT_WARNING);
  return out;
}
