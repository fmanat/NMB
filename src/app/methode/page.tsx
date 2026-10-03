import Link from "next/link";
import { Doc } from "@/components/Doc";
import { ProfileTable } from "@/components/report/ProfileTable";
import { REFERENCES, SCORE } from "@/config/site";
import { isFreeBeta, isPhotoBeta } from "@/lib/mode";
import { HIGH_FROM, LOW_BELOW } from "@/lib/profiles";

export const metadata = { title: "Précision et méthode", alternates: { canonical: "/methode" } };

export default function Page() {
  const w = SCORE.weights;
  // Bêta gratuite : questionnaire seulement, rien sur les protocoles photo ; bêta photo active : les sections photo s'affichent.
  const beta = isFreeBeta() && !isPhotoBeta();
  return (
    <Doc title="Précision et méthode">
      <h2>Ce que le service mesure</h2>
      <p>
        Les valeurs sont des estimations statistiques. Elles ne constituent ni un diagnostic ni un avis médical. La
        circonférence est déduite de la largeur en supposant une section circulaire ; c&apos;est une hypothèse, pas une
        mesure directe.
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
      <h2 id="profils">Profils morphologiques</h2>
      <p>
        Chaque rapport est rangé dans l&apos;une des neuf cases d&apos;une grille de trois lignes sur trois colonnes, d&apos;après deux nombres
        seulement : le percentile de longueur et le percentile de circonférence du rapport. Rien d&apos;autre n&apos;entre en compte (ni le score, ni
        la courbure). Le seuil bas est {LOW_BELOW} et le seuil haut est {HIGH_FROM}, appliqués de la même façon aux deux mesures : un percentile
        inférieur à {LOW_BELOW} est dans la première classe, de {LOW_BELOW} (inclus) à {HIGH_FROM} (exclu) dans la classe centrale, et {HIGH_FROM} ou
        plus dans la dernière. Le percentile est d&apos;abord arrondi à une décimale, comme dans le rapport.
      </p>
      <p>
        Ces profils sont un clin d&apos;œil, pas une classification médicale : aucune case n&apos;est meilleure ou moins bonne qu&apos;une autre, et le
        site ne dit pas à quelle fréquence chaque profil se rencontre. Sur la carte de partage, le profil n&apos;apparaît que si vous cochez l&apos;option.
      </p>
      <div className="mt-4">
        <ProfileTable />
      </div>
      {!beta && (
        <>
        <h2>Mesures estimées à partir d&apos;une photo</h2>
        <p>
          L&apos;analyse d&apos;une photo se fait en deux appels au modèle d&apos;analyse. Le premier, avec la photo, contrôle sa recevabilité
          (une seule personne, aucun visage, sujet conforme, image originale, aucun doute sur la majorité, qualité suffisante) et renvoie des
          estimations : état, longueur, circonférence à mi-tige, courbure, symétrie, proportions du gland et conicité, ainsi que des
          observations descriptives. Le second, sans la photo, rédige le rapport à partir de ces observations et des valeurs calculées par le
          site ; il ne calcule rien, et le site vérifie le texte (vocabulaire, valeurs citées, structure) avant de l&apos;afficher.
        </p>
        <p>
          Si une carte au format bancaire (85,60 × 53,98 mm) est posée à côté, entière et lisible, le modèle repère aussi des points (coins
          de la carte, base, extrémité, ligne médiane, bords) et c&apos;est notre code qui calcule la longueur et la circonférence (position et
          inclinaison de l&apos;appareil déduites de la carte, circonférence = π × largeur maximale) : le rapport porte alors le badge « Taille
          calibrée ». Sans carte, ou si la photo est trop inclinée pour un calcul fiable, la longueur et la circonférence sont les estimations
          visuelles du modèle. Dans les deux cas, ce sont des estimations ; leur écart avec des mesures à la règle n&apos;a été vérifié que sur
          un petit nombre de photos.
        </p>
        <p>
          Tous les autres chiffres sont calculés par le site : percentiles (au repos, seule la circonférence est positionnée), Indice de
          rectitude axiale (100 à 0°, 0 à partir de 45°), Coefficient de symétrie bilatérale, Index de conicité distale (100 pour une
          largeur constante), Indice de typicité (moyenne de 100 − 2 × |percentile − 50| : « morphotype classique » à partir de 70,
          « distinctif » de 40 à 69, « singulier » en dessous) et score global. Si l&apos;analyse échoue pour une raison technique (photo
          difficile à lire, panne ou réponse invalide du modèle après une seconde tentative), un rapport partiel est affiché : il ne contient
          que les valeurs de référence de la population et vous invite à reprendre la photo.
        </p>
        <h2>Traitement de la photo</h2>
        <p>
          Bitomètre ne stocke jamais la photo : elle est traitée en mémoire pendant l&apos;analyse, et n&apos;est
          enregistrée ni dans notre base ni dans nos journaux. Elle est envoyée au prestataire d&apos;analyse (SpaceXAI LLC, connue sous le nom xAI, États-Unis),
          qui conserve les requêtes 30 jours pour détecter les abus. Voir la{" "}
          <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
        </p>
        </>
      )}
    </Doc>
  );
}
