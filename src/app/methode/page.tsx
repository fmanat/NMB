import Link from "next/link";
import { Doc } from "@/components/Doc";
import { REFERENCES, SCORE } from "@/config/site";

export const metadata = { title: "Précision et méthode" };

export default function Page() {
  const w = SCORE.weights;
  return (
    <Doc title="Précision et méthode" draft>
      <h2>Ce que le service mesure</h2>
      <p>
        Les valeurs sont des estimations statistiques. Elles ne constituent ni un diagnostic ni un avis médical. La
        circonférence est déduite de la largeur en supposant une section circulaire ; c&apos;est une hypothèse, pas une
        mesure directe. La marge d&apos;erreur annoncée n&apos;est jamais inférieure à ± 10 %.
      </p>
      <h2>Percentiles</h2>
      <p>
        Les percentiles sont calculés par loi normale à partir des moyennes et écarts-types publiés par Veale et al.
        (BJU International, 2015). Au repos : longueur {REFERENCES.flaccid.length.mean} cm (σ{" "}
        {REFERENCES.flaccid.length.sd}), circonférence {REFERENCES.flaccid.girth.mean} cm (σ{" "}
        {REFERENCES.flaccid.girth.sd}). En érection : longueur {REFERENCES.erect.length.mean} cm (σ{" "}
        {REFERENCES.erect.length.sd}), circonférence {REFERENCES.erect.girth.mean} cm (σ {REFERENCES.erect.girth.sd}).
        Les percentiles sont affichés tels quels.
      </p>
      <h2>Score global : une note calibrée, pas un percentile</h2>
      <p>
        Le score sur 100 est une note de présentation. Il est calculé ainsi :{" "}
        <code>
          score = {SCORE.floor} + {SCORE.span} × P^{SCORE.exponent}
        </code>
        , borné entre {SCORE.floor} et {SCORE.ceiling}. P est la moyenne pondérée de quatre composantes ramenées entre 0
        et 1 : percentile de longueur ({w.length * 100} %), percentile de circonférence ({w.girth * 100} %), symétrie (
        {w.symmetry * 100} %) et rectitude ({w.straightness * 100} %).
      </p>
      <p>
        Cette formule est volontairement indulgente : un profil médian obtient environ 72/100. Le score ne doit donc pas
        être lu comme un classement. Pour situer une mesure dans la population, reportez-vous aux percentiles.
      </p>
      <h2>Mesures estimées à partir d&apos;une photo</h2>
      <p>
        Le modèle d&apos;analyse ne mesure rien : il repère des points (coins de la carte de référence, base et extrémité, ligne
        médiane, bords). Tous les calculs sont faits par notre code : position et inclinaison de l&apos;appareil déduites de la carte
        au format bancaire (85,60 × 53,98 mm), sous l&apos;hypothèse d&apos;un sujet posé sur la même surface que la carte, longueur le long de la ligne médiane, largeurs, circonférence estimée = π × largeur
        maximale, courbure (angle entre les segments proximal et distal), symétrie (écart entre demi-largeurs gauche et droite,
        100 = identiques) et conicité (largeur sous le gland / largeur à la base).
      </p>
      <p>
        La marge d&apos;erreur de chaque mesure dépend de la confiance du repérage, de la taille de la carte dans l&apos;image et de
        l&apos;inclinaison de l&apos;appareil ; elle n&apos;est jamais inférieure à ± 10 %. Une photo trop inclinée (plus de 50°) ou où
        la carte est trop petite est refusée, car la précision serait insuffisante. La précision du calcul a été vérifiée sur des
        prises de vue simulées ; elle n&apos;a pas encore été validée sur un grand nombre de photos réelles de référence.
      </p>
      <h2>Traitement de la photo</h2>
      <p>
        Bitomètre ne stocke jamais la photo : elle est traitée en mémoire pendant l&apos;analyse, et n&apos;est
        enregistrée ni dans notre base ni dans nos journaux. Elle est envoyée au prestataire d&apos;analyse (SpaceXAI LLC, connue sous le nom xAI, États-Unis),
        qui conserve les requêtes 30 jours pour détecter les abus. Voir la{" "}
        <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>
    </Doc>
  );
}
