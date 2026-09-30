# Choix de l'hébergeur (recherche, sans aucune inscription)

Recherche faite dans la session autonome, à partir des conditions publiées. Aucun compte n'a été ouvert, aucun message envoyé. Ce document sert à décider ; il n'est pas un avis juridique.

## Ce dont le site a besoin

- Exécuter Next.js 16 en mode serveur (`npm run build` puis `npm run start`) : le site a des pages dynamiques, des actions serveur et des routes d'API, donc l'hébergement purement statique ne suffit pas.
- Une base PostgreSQL (le code a été testé avec la version 17), de préférence gérée par l'hébergeur (sauvegardes).
- Pouvoir programmer deux commandes : `npm run db:purge` (toutes les heures) et `npm run stats:webhook` (une fois par jour).
- Des serveurs dans l'Union européenne (la politique de confidentialité le promet pour l'hébergement).
- Des conditions qui acceptent ce service : analyse chiffrée de mesures corporelles, réservée aux adultes, sans image explicite.

## Point de vigilance commun

Le service touche à un sujet intime. Il ne contient ni image ni texte pornographique, mais un hébergeur qui applique sa clause « contenu pornographique » de façon large pourrait le juger concerné. **Aucune condition générale ne cite ce type de service.** D'où la recommandation : écrire à l'hébergeur, avant tout paiement, en décrivant le service, et garder sa réponse écrite.

## Comparaison

| | Clever Cloud (France) | OVHcloud (France) | Scaleway (France) | Hetzner (Allemagne) |
|---|---|---|---|---|
| Ce que disent ses conditions sur le contenu | Interdit la pédopornographie, l'incitation au crime, à la haine, au suicide, les jeux d'argent non autorisés, etc. La pornographie « ordinaire » n'est pas citée. Le client est responsable de son contenu et doit pouvoir recevoir des signalements. | Interdit les contenus illicites (pédopornographie, apologie de crimes, haine…). La pornographie « ordinaire » n'est pas citée. | Interdit aussi ce qui est « pornographique, en particulier s'il peut être vu par un mineur ». Formulation large, à interpréter. | Clause 8.2 : interdit « le matériel pornographique ou obscène » et ce qui met en danger la moralité des mineurs. Formulation large ; des déclarations publiques confirment une application stricte. |
| Verdict pour ce service | **Le plus compatible sur le papier** | Compatible sur le papier | **Ambigu** : demander confirmation | **À éviter** |
| Next.js en mode serveur | Oui (application Node.js) | Oui (serveur privé ou hébergement Node) | Oui (conteneurs, serveur) | Oui, mais sur serveur à gérer soi-même |
| PostgreSQL géré | Oui (module PostgreSQL) | Oui (bases managées) | Oui (base managée) | Non trouvé dans les conditions : serveur à administrer soi-même |
| Tâches programmées | Oui : fichier `clevercloud/cron.json` (format cron classique) ; non disponible avec Docker | Oui sur un serveur (tâche système `cron`) | Oui (tâches planifiées de conteneurs, ou cron sur serveur) | Oui sur serveur (`cron`) |
| Travail de mise en place | Faible (déploiement par git) | Moyen | Moyen | Élevé (tout administrer) |

Les conditions consultées : Clever Cloud (conditions générales et politique d'usage acceptable), OVHcloud (conditions de service, version du 17 janvier 2025), Scaleway (conditions du 17 juillet 2024), Hetzner (conditions, clause 8.2). Elles peuvent changer : à relire le jour de la décision. Les tarifs n'ont pas été comparés ici. Les lignes techniques (Next.js, PostgreSQL, tâches) sont vérifiées dans la documentation pour Clever Cloud seulement ; pour les trois autres, elles reposent sur des offres connues et sont à confirmer avant de choisir.

## Recommandation

1. **Clever Cloud**, après avoir obtenu une confirmation écrite que le service est accepté. Raison : conditions les moins larges sur ce point, PostgreSQL géré, tâches programmées par un simple fichier, déploiement simple, pas de serveur à administrer.
2. Si la réponse est négative ou traîne : **OVHcloud** (même niveau de compatibilité sur le papier, plus de travail de mise en place).
3. Scaleway seulement avec une confirmation écrite. Hetzner : non.

## Message type à envoyer (à valider par vous avant envoi)

> Bonjour, je prépare un site francophone réservé aux adultes (vérification d'âge) qui fournit à l'utilisateur une analyse statistique de mesures corporelles qu'il saisit lui-même, ou d'une photo qu'il envoie. La photo est analysée en mémoire par un prestataire d'analyse et n'est jamais stockée par le site. Le site ne diffuse aucune image ni aucun texte explicite. Ce service est-il conforme à vos conditions d'utilisation ? Pouvez-vous le confirmer par écrit ?

## Programmer les tâches : exemple Clever Cloud

Un fichier `clevercloud/cron.json` à la racine du projet, par exemple :

```json
[
  "0 * * * * $ROOT/scripts/cron-purge.sh",
  "30 4 * * * $ROOT/scripts/cron-stats.sh"
]
```

avec deux petits scripts qui lancent `npm run db:purge` et `npm run stats:webhook`. (Règle de Clever Cloud : ne pas appeler `bash` directement dans le fichier, mettre le chemin du script exécutable, et écrire `$ROOT` sans accolades.) **Non créé dans le dépôt** : ce fichier ne sert qu'une fois l'hébergeur choisi ; il sera adapté à celui-ci. Note : les scripts `db:purge` et `stats:webhook` lisent le fichier `.env` ; chez un hébergeur, les réglages sont des variables d'environnement, il faudra ajuster la commande (retirer l'option `--env-file`) à ce moment-là.
