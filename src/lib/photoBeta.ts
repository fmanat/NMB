// Bêta de la formule photo (bloc 6 de la session de nuit 4) : variable PHOTO_BETA, désactivée par défaut, valeur reconnue « on » uniquement.
// Fonctions PURES (reçoivent l'environnement), testées par tests/photo-beta.test.ts. Aucun import du reste du site.
//
// Règles :
//  - PHOTO_BETA n'a d'effet qu'en bêta gratuite (FREE_BETA=on) : formule B seule, gratuite ; C, paiement et CGV restent masqués ;
//  - GARDE-FOU DE PRODUCTION : en NODE_ENV=production, la formule photo refuse de s'activer tant qu'un prestataire RÉEL de vérification
//    d'âge PRÊT n'est configuré (AGE_PROVIDER = ageverif avec ses variables obligatoires ; « yoti » ne compte PAS tant que son adaptateur
//    n'est pas écrit et validé en réel : bloc 8), ni tant qu'un fournisseur simulé
//    (vision, captcha, filtrage) est réglé ; PHOTO_BETA est alors traitée comme désactivée et un avertissement est journalisé au démarrage ;
//  - hors production (développement, tests), les fournisseurs simulés restent utilisables.

export type Env = Record<string, string | undefined>;

/**
 * Prestataires RÉELS DE VÉRIFICATION D'ÂGE PRÊTS (adaptateur écrit, testé avec des réponses simulées) et leurs variables obligatoires.
 * Seuls ceux-là comptent pour activer la bêta photo en production.
 */
export const AGE_PROVIDER_REQUIRED_VARS: Readonly<Record<string, readonly string[]>> = {
  ageverif: ["AGEVERIF_CLIENT_ID", "AGEVERIF_CLIENT_SECRET", "AGE_TOKEN_SECRET", "SITE_URL"],
};
export const REAL_AGE_PROVIDERS: readonly string[] = Object.keys(AGE_PROVIDER_REQUIRED_VARS);

/**
 * Prestataires connus mais NON PRÊTS : jamais comptés comme « prestataire réel prêt », même avec toutes leurs variables.
 * Yoti : adaptateur non écrit (la documentation publique lue au bloc 8 ne suffit pas à l'écrire sans deviner : voir docs/ACTIVATION-PHOTO.md).
 * Retirer une entrée d'ici seulement quand l'adaptateur existe ET a été validé sur le mode test du prestataire.
 */
export const NOT_READY_AGE_PROVIDERS: Readonly<Record<string, string>> = {
  yoti: "adaptateur Yoti non écrit (documentation insuffisante : retour de la page hébergée et structure du résultat non précisés) : il ne compte pas comme prestataire réel prêt",
};

/**
 * Toutes les variables propres à un prestataire de vérification d'âge, documentées dans .env.example, README.md et docs/ACTIVATION-PHOTO.md
 * (un test compare cette liste aux trois documents). `reserved` = noms réservés, que le code ne lit pas encore.
 */
export const AGE_PROVIDER_VARS: Readonly<Record<string, { required: readonly string[]; optional: readonly string[]; reserved: boolean }>> = {
  ageverif: { required: ["AGEVERIF_CLIENT_ID", "AGEVERIF_CLIENT_SECRET"], optional: ["AGEVERIF_CHALLENGES"], reserved: false },
  yoti: { required: ["YOTI_CLIENT_SDK_ID", "YOTI_API_KEY"], optional: [], reserved: true },
};

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
    const required = Object.hasOwn(AGE_PROVIDER_REQUIRED_VARS, provider) ? AGE_PROVIDER_REQUIRED_VARS[provider] : undefined;
    if (!required) {
      const notReady = Object.hasOwn(NOT_READY_AGE_PROVIDERS, provider) ? NOT_READY_AGE_PROVIDERS[provider] : undefined;
      reasons.push(
        notReady
          ? `AGE_PROVIDER=${provider} : ${notReady} (prestataires prêts : ${REAL_AGE_PROVIDERS.join(", ")}).`
          : `AGE_PROVIDER=« ${provider || "(vide)"} » : un prestataire réel de vérification d'âge prêt est exigé en production (${REAL_AGE_PROVIDERS.join(", ")}).`,
      );
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

// ---------------------------------------------------------------------------------------------------------------------------
// Mode APERÇU (PHOTO_BETA=admin) : la formule photo n'est visible qu'avec une session d'administration valide, pour que le propriétaire
// voie le parcours en ligne avant l'ouverture au public. Le public ne voit rien (404 sur tous les chemins photo, comme sans PHOTO_BETA).
//  - Mêmes garde-fous de production que PHOTO_BETA=on (vision xAI avec clé, captcha ALTCHA avec clé, filtrage jamais simulé), SAUF le
//    prestataire de vérification d'âge : s'il est réel et prêt, il est utilisé ; sinon la session d'administration en tient lieu,
//    avec un écran qui le dit (« aperçu administrateur »). Ce n'est jamais présenté comme une vérification d'âge.
//  - Exige FREE_BETA=on (rapport gratuit, marqué bêta), comme PHOTO_BETA=on.
// ---------------------------------------------------------------------------------------------------------------------------

export type PhotoPreviewDecision = {
  /** PHOTO_BETA=admin dans la configuration. */
  requested: boolean;
  /** Aperçu réellement ouvert aux sessions d'administration. */
  active: boolean;
  reasons: string[];
  /** Un prestataire réel de vérification d'âge est prêt : il est utilisé même en aperçu (sinon : session d'administration). */
  realAgeProvider: boolean;
};

/** Prestataire réel de vérification d'âge configuré avec toutes ses variables obligatoires. */
export function realAgeProviderReady(env: Env = process.env): boolean {
  const provider = env.AGE_PROVIDER ?? "";
  const required = Object.hasOwn(AGE_PROVIDER_REQUIRED_VARS, provider) ? AGE_PROVIDER_REQUIRED_VARS[provider] : undefined;
  return Boolean(required && required.every((v) => filled(env, v)));
}

export function photoPreviewDecision(env: Env = process.env): PhotoPreviewDecision {
  const requested = env.PHOTO_BETA === "admin";
  const realAgeProvider = realAgeProviderReady(env);
  if (!requested) return { requested: false, active: false, reasons: [], realAgeProvider };
  const reasons: string[] = [];
  if (env.FREE_BETA !== "on") reasons.push("FREE_BETA n'est pas « on » : l'aperçu de la formule photo n'existe que dans la bêta gratuite.");
  if (env.NODE_ENV === "production") {
    if (env.VISION_PROVIDER !== "xai") reasons.push("VISION_PROVIDER doit être « xai » en production.");
    else if (!filled(env, "XAI_API_KEY")) reasons.push("XAI_API_KEY manquante.");
    if (env.CAPTCHA_PROVIDER !== "altcha") reasons.push("CAPTCHA_PROVIDER doit être « altcha » en production.");
    else if (!filled(env, "ALTCHA_HMAC_KEY")) reasons.push("ALTCHA_HMAC_KEY manquante.");
    if (env.SCREENING_PROVIDER === "simulation" || env.SCREENING_PROVIDER === "off") {
      reasons.push("SCREENING_PROVIDER « simulation » ou « off » est interdit en production (laisser vide : filtrage absent, avec avertissement).");
    }
    if (!filled(env, "ADMIN_PASSWORD_HASH") || !filled(env, "ADMIN_SESSION_SECRET")) reasons.push("Administration non configurée (ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET) : aucune session ne pourrait ouvrir l'aperçu.");
    if (!filled(env, "AGE_TOKEN_SECRET")) reasons.push("AGE_TOKEN_SECRET manquant.");
  }
  return { requested, active: reasons.length === 0, reasons, realAgeProvider };
}

export const isPhotoPreviewActive = (env: Env = process.env): boolean => photoPreviewDecision(env).active;

/** Filtrage d'empreintes non configuré (SCREENING_PROVIDER vide ou absente). */
export const isScreeningAbsent = (env: Env = process.env): boolean => !filled(env, "SCREENING_PROVIDER");

export const SCREENING_ABSENT_WARNING =
  "Filtrage d'empreintes non configuré (SCREENING_PROVIDER vide) : les photos sont analysées sans comparaison avec les bases d'images déjà répertoriées. Aucun libellé du site ne doit prétendre le contraire.";

/** Avertissements à journaliser au démarrage du serveur (liste vide : rien à signaler). */
export function startupWarnings(env: Env = process.env): string[] {
  const out: string[] = [];
  const d = photoBetaDecision(env);
  if (d.requested && !d.active) out.push(`PHOTO_BETA=on ignorée (formule photo désactivée) : ${d.reasons.join(" ")}`);
  const p = photoPreviewDecision(env);
  if (p.requested && !p.active) out.push(`PHOTO_BETA=admin ignorée (aperçu désactivé) : ${p.reasons.join(" ")}`);
  if (p.active && !p.realAgeProvider) out.push("PHOTO_BETA=admin : aperçu réservé aux sessions d'administration ; aucun prestataire réel de vérification d'âge n'est prêt, la session d'administration en tient lieu (jamais ouvert au public).");
  // Le filtrage ne concerne que les formules photo : hors bêta gratuite (version payante), en bêta photo active ou en aperçu.
  const photoFlowExists = env.FREE_BETA !== "on" || d.active || p.active;
  if (photoFlowExists && isScreeningAbsent(env)) out.push(SCREENING_ABSENT_WARNING);
  return out;
}
