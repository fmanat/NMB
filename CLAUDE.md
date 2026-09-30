# CLAUDE.md

Cahier des charges complet : [docs/SPEC.md](docs/SPEC.md), source de référence unique. Le lire avant tout travail.

## Règles de travail
- L'utilisateur n'est pas informaticien : chaque action qui le concerne (créer un compte, copier une clé, lancer une commande) est expliquée pas à pas, en français simple.
- Une étape à la fois (section 16 du cahier des charges). À la fin de chaque étape : commit git, envoi sur GitHub (dépôt privé fmanat/NMB), puis résumé de ce qui fonctionne et de ce qui reste à faire.
- Toute question est posée sous forme de QCM, avec la recommandation indiquée.
- Aucun secret dans le code : `.env.example` documenté, `.env` exclu de git.
- Demander avant d'ouvrir un compte ou un service payant.
- Tests automatisés obligatoires pour les calculs (section 5.3) et le déblocage du rapport (section 8).
- Moteur d'analyse : API xAI uniquement (section 5). Ne pas utiliser l'API Anthropic pour l'analyse.
- Aucune image explicite dans le code ni dans le dépôt ; tests avec images neutres et API simulée.
- Photos personnelles de test : uniquement dans `photos-test/` (ignoré par git). Ne jamais les ouvrir ni les afficher : lire seulement le texte renvoyé par les scripts. Les supprimer après usage.
- Les libellés du site restent vrais : ne jamais présenter le service autrement qu'il n'est (pas de « cloaking » auprès des prestataires), ne jamais prêter plus de pouvoir au filtrage d'empreintes (section 5) ni à la vérification d'âge que ce qu'ils font réellement.
- Contenus SEO (`content/seo/<slug>.md`) : rédigés par l'utilisateur, collés un par un. Je ne réécris pas leur texte. À chaque page collée : créer le fichier tel quel, lancer `npm run seo:check -- --urls`, vérifier que chaque URL de source répond, vérifier (en lisant la source) que chaque chiffre cité y figure, et signaler tout écart. Ne jamais corriger un chiffre sans le dire à l'utilisateur. Format et règles : `content/seo/README.md`.
- Écriture de fichiers sous Windows : toujours en UTF-8 (utiliser les outils d'écriture, pas de relecture/réécriture PowerShell sans `-Encoding utf8`).

@AGENTS.md
