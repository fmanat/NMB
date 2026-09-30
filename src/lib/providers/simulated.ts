import { assertNotProduction } from "./guard";
import type { AgeVerificationProvider, CaptchaProvider, ImageScreeningProvider } from "./types";

export const simulatedAge: AgeVerificationProvider = {
  id: "simulation",
  async startVerification({ returnUrl }) {
    assertNotProduction("vérification d'âge");
    return { redirectUrl: `/verification-age/simulation?retour=${encodeURIComponent(returnUrl)}` };
  },
  async completeVerification() {
    assertNotProduction("vérification d'âge");
    return { adult: true };
  },
};

export const simulatedScreening: ImageScreeningProvider = {
  id: "simulation",
  async screen() {
    assertNotProduction("filtrage d'empreintes");
    return { blocked: false };
  },
};

export const SIMULATED_CAPTCHA_TOKEN = "simulation-ok";

export const simulatedCaptcha: CaptchaProvider = {
  id: "simulation",
  async verify(token) {
    assertNotProduction("captcha");
    return token === SIMULATED_CAPTCHA_TOKEN;
  },
};
