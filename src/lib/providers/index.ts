import { createSimulatedVision } from "../vision/simulation";
import type { VisionProvider } from "../vision/types";
import { xaiVision } from "../vision/xai";
import { absentScreening } from "./absent";
import { ageVerifProvider } from "./ageverif";
import { altchaCaptcha } from "./altcha";
import { disabledCaptcha, disabledScreening, simulatedAge, simulatedCaptcha, simulatedScreening } from "./simulated";
import type { AgeVerificationProvider, CaptchaProvider, ImageScreeningProvider } from "./types";

// Pour brancher un vrai prestataire : créer un fichier qui implémente l'interface correspondante,
// l'ajouter ici et renseigner la variable d'environnement (voir .env.example).

export function getVision(): VisionProvider {
  const id = process.env.VISION_PROVIDER ?? "simulation";
  if (id === "xai") return xaiVision;
  if (id === "simulation") return createSimulatedVision();
  throw new Error(`Fournisseur de vision inconnu : ${id}`);
}

export function getAgeProvider(): AgeVerificationProvider {
  const id = process.env.AGE_PROVIDER ?? "simulation";
  if (id === "simulation") return simulatedAge;
  if (id === "ageverif") return ageVerifProvider;
  // Second candidat du propriétaire (docs/PRESTATAIRES.md) : adaptateur NON écrit (documentation publique insuffisante, voir
  // docs/ACTIVATION-PHOTO.md) ; le garde-fou de la bêta photo ne le compte pas comme prestataire prêt.
  if (id === "yoti") throw new Error("Prestataire de vérification d'âge « yoti » : adaptateur pas encore écrit (voir docs/ACTIVATION-PHOTO.md).");
  throw new Error(`Prestataire de vérification d'âge inconnu : ${id}`);
}

/**
 * Filtrage d'empreintes : OPTIONNEL depuis le bloc 6. Variable vide ou absente : aucun filtrage, avec un avertissement journalisé à chaque
 * analyse (jamais présenté comme un contrôle). « simulation » et « off » restent réservés au développement (interdits en production).
 */
export function getScreening(): ImageScreeningProvider {
  const id = (process.env.SCREENING_PROVIDER ?? "").trim();
  if (id === "") return absentScreening;
  if (id === "simulation") return simulatedScreening;
  if (id === "off") return disabledScreening; // désactivé (développement seulement)
  throw new Error(`Prestataire de filtrage d'empreintes inconnu : ${id}`);
}

export function getCaptcha(): CaptchaProvider {
  const id = process.env.CAPTCHA_PROVIDER ?? "simulation";
  if (id === "simulation") return simulatedCaptcha;
  if (id === "altcha") return altchaCaptcha;
  if (id === "off") return disabledCaptcha; // désactivé (développement seulement)
  throw new Error(`Prestataire de captcha inconnu : ${id}`);
}
