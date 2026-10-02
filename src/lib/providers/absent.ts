import { SCREENING_ABSENT_WARNING } from "../photoBeta";
import type { ImageScreeningProvider } from "./types";

/**
 * Filtrage d'empreintes NON CONFIGURÉ (SCREENING_PROVIDER vide) : le contrôle est absent. Autorisé en production depuis le bloc 6
 * (décision : docs/DECISIONS.md), mais chaque analyse journalise un avertissement : rien ne doit laisser croire qu'un filtrage a eu lieu.
 * Il ne bloque jamais et ne prétend rien reconnaître.
 */
export const absentScreening: ImageScreeningProvider = {
  id: "none",
  async screen() {
    console.warn(JSON.stringify({ event: "screening_absent", message: SCREENING_ABSENT_WARNING }));
    return { blocked: false };
  },
};
