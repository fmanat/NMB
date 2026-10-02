/**
 * Vérification d'âge par prestataire tiers : le site ne reçoit qu'un « majeur : oui », sans aucune donnée d'identité (cahier des charges,
 * section 7). Ne pas écrire « double anonymat » sans preuve écrite du prestataire : AgeVerif connaît le site qui le sollicite (client_id), voir docs/PRESTATAIRES.md.
 */
export interface AgeVerificationProvider {
  id: string;
  /** Adresse où envoyer l'utilisateur pour qu'il prouve sa majorité. */
  startVerification(args: { returnUrl: string }): Promise<{ redirectUrl: string }>;
  /** Interprète le retour du prestataire. Ne renvoie que l'information « majeur » ou non. */
  /** `returnPath` : écran où renvoyer l'utilisateur (le prestataire le restitue dans un `state` signé), sinon l'écran par défaut. */
  completeVerification(req: Request): Promise<{ adult: boolean; returnPath?: string }>;
}

/**
 * Comparaison d'empreintes avec des bases d'images déjà répertoriées (type PhotoDNA ou Safer).
 * Elle ne reconnaît QUE des images connues : ni nouvelles images, ni âge. Elle ne remplace pas la vérification d'âge.
 */
export interface ImageScreeningProvider {
  id: string;
  screen(jpeg: Buffer): Promise<{ blocked: boolean }>;
}

/** Captcha respectueux de la vie privée, vérifié côté serveur. */
export interface CaptchaProvider {
  id: string;
  verify(token: string | null, ip: string): Promise<boolean>;
}
