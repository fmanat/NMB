import { verifySolution } from "../captcha/altcha";
import type { CaptchaProvider } from "./types";

/** Captcha à preuve de travail auto-hébergé (voir src/lib/captcha/altcha.ts). L'adresse IP n'est volontairement pas utilisée. */
export const altchaCaptcha: CaptchaProvider = {
  id: "altcha",
  async verify(token) {
    return verifySolution(token);
  },
};
