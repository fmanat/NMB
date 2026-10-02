// Version de prompts EN SERVICE. Pour en changer : écrire photo-report-vN.ts puis ne modifier que ce fichier.
// Ré-exports nommés (et non « export * ») : les scripts lancés par tsx (modules ESM important du TypeScript compilé en CommonJS)
// ne voient pas les ré-exports en étoile.
export {
  PROMPT_RECEVABILITE,
  PROMPT_REPERAGE,
  PROMPT_VERSION,
  SYSTEM_COMMENT,
  SYSTEM_VISION,
  TARGET_SCHEMA_VERSION,
  commentPrompt,
} from "./photo-report-v1";
