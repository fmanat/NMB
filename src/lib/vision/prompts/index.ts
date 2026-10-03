// Version de prompts EN SERVICE (photo-report/2). Pour en changer : écrire photo-report-vN.ts puis ne modifier que ce fichier.
// La version 1 (photo-report/1 : trois observations et un verdict) a été retirée ; elle reste dans l'historique git.
// Ré-exports nommés (et non « export * ») : les scripts lancés par tsx (modules ESM important du TypeScript compilé en CommonJS)
// ne voient pas les ré-exports en étoile.
export {
  PROMPT_VERSION_V2 as PROMPT_VERSION,
  PROMPT_VISION_V2,
  SYSTEM_TEXT_V2,
  SYSTEM_VISION_V2,
  TARGET_SCHEMA_VERSION_V2 as TARGET_SCHEMA_VERSION,
  textPrompt,
  valuesBlock,
} from "./photo-report-v2";
