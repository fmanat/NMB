# CLAUDE.md

Cahier des charges complet : [docs/SPEC.md](docs/SPEC.md). Le lire avant tout travail.

## RÃ¨gles de travail
- L'utilisateur n'est pas informaticien : chaque action qui le concerne (crÃ©er un compte, copier une clÃ©, lancer une commande) est expliquÃ©e pas Ã  pas, en franÃ§ais simple.
- Une Ã©tape Ã  la fois (section 16 du cahier des charges). Ã€ la fin de chaque Ã©tape : commit git, puis rÃ©sumÃ© de ce qui fonctionne et de ce qui reste Ã  faire.
- Toute question est posÃ©e sous forme de QCM, avec la recommandation indiquÃ©e.
- Aucun secret dans le code : `.env.example` documentÃ©, `.env` exclu de git.
- Demander avant d'ouvrir un compte ou un service payant.
- Tests automatisÃ©s obligatoires pour les calculs (section 5.3) et le dÃ©blocage du rapport (section 8).
- Moteur d'analyse : API xAI uniquement (section 5). Ne pas utiliser l'API Anthropic pour l'analyse.
- Aucune image explicite dans le code ni dans le dÃ©pÃ´t ; tests avec images neutres et API simulÃ©e.
- Ne pas Ã©crire de code avant validation du plan par l'utilisateur.

@AGENTS.md


