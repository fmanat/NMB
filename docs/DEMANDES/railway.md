# Demande à Railway : confirmation écrite que le service est accepté (formules photo)

**Nécessaire pour le passage au payant de la formule A : NON.** La formule A (questionnaire déclaratif, aucune photo) tourne déjà sur Railway et sa politique d'usage ne vise rien de ce type. Cette demande est **recommandée avant l'ouverture des formules photo** (B et C) et, par prudence, avant l'ouverture publique de la bêta : le site traite des données intimes et la politique d'usage de Railway dit elle-même : « If you are unsure whether your use case is allowed, ask us before deploying. » (<https://railway.com/legal/acceptable-use>, lue directement le 01/10/2026).

## Ce que dit la politique d'usage de Railway (lu directement)

- Interdit notamment : « any activity that violates applicable law, exploits or harms minors, promotes terrorism, violent extremism, or human trafficking » ; « creating or distributing nonconsensual intimate imagery or other content used to harass, threaten, or intimidate ».
- **Aucune mention du contenu pour adultes** ni de la pornographie.
- Application : « Railway may investigate any suspected violation … and remove or disable access to any content or resource that violates this Policy » ; elle peut tenir compte des « policies and processes you have in place to prevent or identify and remove any prohibited content or activity ».
- Accord de traitement des données (DPA) publié : <https://railway.com/legal/dpa> (à faire relire par le juriste).

## Canal d'envoi

- **Railway Help Station** (forum d'assistance, connecté à votre compte) : <https://station.railway.com> → « New Post » dans une catégorie de questions de facturation ou de conformité, ou le bouton d'aide (« Help ») du tableau de bord <https://railway.com>.
- Alternative : écrire depuis le tableau de bord (projet « bitometre-test » → Help / Support), car le compte est déjà connu de Railway. Je n'ai pas trouvé d'adresse e-mail de contact publiée sur les pages légales lues : n'envoyez pas à une adresse devinée.
- **Vous** envoyez. Gardez la réponse écrite complète.

## Objet

`Acceptable use confirmation before launch – French-language adults-only statistical body-measurement service (project bitometre-test)`

## Message prêt à copier (anglais)

> Hello Railway team,
>
> Your Acceptable Use Policy says "If you are unsure whether your use case is allowed, ask us before deploying." I would like to ask before we go public.
>
> I operate, on behalf of [À COMPLÉTER : legal name of the Ltd] (private limited company, England and Wales, company no. [À COMPLÉTER : Companies House number]), a website called Bitomètre (bitometre.com), currently deployed as a password-protected test in the project "bitometre-test" (EU region, Amsterdam; services: web, Postgres, two cron jobs).
>
> **What the service is.** A French-language site, **for adults only**, that provides a statistical analysis of body measurements (length, girth, curvature, symmetry) compared with a published scientific reference, with a score and a short deadpan comment. It does **not** display, publish or store any sexually explicit image or text, and never generates an image of the user's body.
>
> **What users submit.** At launch (a free beta): the user types in their own measurements in a questionnaire. No photograph, no account, no e-mail address. The report is computed by our own code; it is stored in our Postgres database and deleted automatically after at most 90 days (or immediately when the user deletes it).
>
> **Later offers (not live).** The user may upload a photograph of their own anatomy next to a bank card for scale. It is processed **in memory only** on the web service, sent to a third-party AI provider for analysis, and **never written to disk, to the database or to logs** by our application. Before upload we will require age verification by a third-party provider, a captcha, and hash-matching against databases of known illegal images; any match is destroyed and handled according to the law. These offers will not be enabled without telling you first.
>
> **Please confirm in writing:**
> 1. That this use case (including, later, in-memory processing of user-submitted photographs of the user's own intimate anatomy, never stored) is allowed under your Acceptable Use Policy and Terms of Service.
> 2. Whether there is any additional condition you would want us to meet (for example an abuse contact, a takedown procedure, or age-gating).
> 3. What happens operationally in case of a complaint about the site: do you notify us first and give us time to respond before suspending any service or the database?
> 4. Whether the Data Processing Addendum (https://railway.com/legal/dpa) applies automatically to our account and whether any of our data (database, logs) is processed outside the EU, including by support or operations staff.
> 5. Which backup options exist for the Postgres service in the EU region (we want daily backups and point-in-time recovery before accepting any payment) and where backups are stored.
>
> Thank you,
>
> [À COMPLÉTER : name of the director]
> Director, [À COMPLÉTER : legal name of the Ltd]
> [À COMPLÉTER : contact e-mail]

## Informations à joindre

- Nom du projet : `bitometre-test` (identifiant : `4ca505f5-7eb6-4e8d-8ba7-6d6a4b782683`), région Amsterdam.
- Adresse de test protégée : voir `RAILWAY_TEST_URL` dans `.env` (identifiants sur demande seulement, jamais dans le message).
- Si Railway le demande : `docs/RAILWAY.md` (architecture), politique de confidentialité de la bêta (`/confidentialite`).

## Questions appelant une réponse écrite

Les cinq questions du message. Décisive : la 1 (acceptation écrite) et la 3 (préavis avant suspension).
