import { createSimulatedVision } from "../vision/simulation";
import type { VisionProvider } from "../vision/types";
import { xaiVision } from "../vision/xai";
import { simulatedAge, simulatedCaptcha, simulatedScreening } from "./simulated";
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
  throw new Error(`Prestataire de vérification d'âge inconnu : ${id}`);
}

export function getScreening(): ImageScreeningProvider {
  const id = process.env.SCREENING_PROVIDER ?? "simulation";
  if (id === "simulation") return simulatedScreening;
  throw new Error(`Prestataire de filtrage d'empreintes inconnu : ${id}`);
}

export function getCaptcha(): CaptchaProvider {
  const id = process.env.CAPTCHA_PROVIDER ?? "simulation";
  if (id === "simulation") return simulatedCaptcha;
  throw new Error(`Prestataire de captcha inconnu : ${id}`);
}
