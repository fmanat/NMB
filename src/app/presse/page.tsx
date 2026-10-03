import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { isPublished } from "@/lib/seo";
import { evalFigure } from "@/lib/seoFigures";
import { PRESS_CHARTS, type PressChartName } from "@/lib/pressCharts";
import { PRESS_CREDIT, PRESS_CREDIT_HTML } from "@/lib/pressData";
import { ogImagePath } from "@/lib/structuredData";
import { Breadcrumbs } from "@/components/content/ContentBlocks";

// Page presse : graphiques originaux téléchargeables en PNG, chiffres clés et mention de source à reprendre.
// Règle : aucun chiffre qui ne vienne de Veale et al. (2015) ou des calculs du site (lib/seoFigures).

const hidden = () => !isPublished() && process.env.NODE_ENV === "production";

export function generateMetadata(): Metadata {
  if (hidden()) return { robots: { index: false, follow: false } };
  const title = `Presse : graphiques et chiffres sur la taille du pénis | ${SITE.name}`;
  const description = "Graphiques originaux téléchargeables (distribution de la longueur et de la circonférence, tableau des percentiles), chiffres clés sourcés et mention à reprendre.";
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/presse" },
    openGraph: { type: "website", url: "/presse", title, description, images: [{ url: ogImagePath("presse"), width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [ogImagePath("presse")] },
  };
}

const FIGURES: { label: string; value: string }[] = [
  { label: "Longueur moyenne en érection", value: evalFigure("moyenne:erect-length") },
  { label: "Écart-type de la longueur en érection", value: evalFigure("ecart-type:erect-length") },
  { label: "Hommes mesurés en érection (longueur)", value: evalFigure("effectif:erect-length") },
  { label: "Circonférence moyenne en érection", value: evalFigure("moyenne:erect-girth") },
  { label: "Longueur moyenne au repos", value: evalFigure("moyenne:rest-length") },
  { label: "Moitié centrale des longueurs en érection", value: `${evalFigure("quantile:erect-length:25")} à ${evalFigure("quantile:erect-length:75")}` },
  { label: "90 % des longueurs en érection", value: `${evalFigure("quantile:erect-length:5")} à ${evalFigure("quantile:erect-length:95")}` },
  { label: "Part des hommes entre 12 et 14 cm en érection", value: evalFigure("entre:erect-length:12:14") },
];

const CHART_ALT: Record<PressChartName, string> = {
  "distribution-longueur.png": `Courbe de répartition de la longueur du pénis en érection : médiane ${evalFigure("quantile:erect-length:50")}, 10e percentile ${evalFigure("quantile:erect-length:10")}, 90e percentile ${evalFigure("quantile:erect-length:90")}.`,
  "distribution-circonference.png": `Courbe de répartition de la circonférence du pénis en érection : médiane ${evalFigure("quantile:erect-girth:50")}, 10e percentile ${evalFigure("quantile:erect-girth:10")}, 90e percentile ${evalFigure("quantile:erect-girth:90")}.`,
  "tableau-percentiles.png": "Tableau des percentiles de la longueur du pénis en érection, de 10 à 20 cm, avec le nombre d'hommes sur 1 000 qui mesurent moins.",
};

export default function Page() {
  if (hidden()) notFound();
  return (
    <div className="container-bm container-narrow py-8 md:py-12">
      <Breadcrumbs crumbs={[{ name: "Accueil", path: "/" }, { name: "Presse", path: "/presse" }]} />
      <h1 className="t-h1 mt-4 !text-[30px] !leading-[36px] md:!text-[40px] md:!leading-[46px]">Presse : graphiques et chiffres de référence</h1>
      <p className="t-lead text-muted mt-4">
        Graphiques originaux, libres de reprise avec la mention de source ci-dessous. Tous les chiffres viennent de la revue de Veale et al. (BJU International, 2015)
        ou des calculs du site sur ces références.
      </p>

      <section aria-labelledby="mention-titre" className="card !p-5 mt-8">
        <h2 id="mention-titre" className="t-h4">Mention de source à reprendre</h2>
        <p className="mt-3 font-semibold">{PRESS_CREDIT}</p>
        <p className="t-small text-muted mt-3">Version avec lien, à coller dans une page web :</p>
        <pre className="mt-2 overflow-x-auto rounded-[10px] bg-[var(--bm-gray-100)] p-3 text-[13px] leading-5 whitespace-pre-wrap break-all"><code>{PRESS_CREDIT_HTML}</code></pre>
      </section>

      <section aria-labelledby="graphiques-titre" className="mt-10">
        <h2 id="graphiques-titre" className="t-h3">Graphiques téléchargeables</h2>
        <p className="t-small text-muted mt-2">Format PNG, 1 600 × 900 pixels, source intégrée dans l&apos;image.</p>
        <div className="mt-6 space-y-10">
          {(Object.keys(PRESS_CHARTS) as PressChartName[]).map((name) => (
            <figure key={name}>
              {/* eslint-disable-next-line @next/next/no-img-element -- image générée par le site, servie telle quelle pour être téléchargée à l'identique */}
              <img src={`/presse/graphiques/${name}`} alt={CHART_ALT[name]} width={1600} height={900} loading="lazy" className="w-full h-auto rounded-[12px] border border-[var(--border)]" />
              <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="t-small font-semibold">{PRESS_CHARTS[name].title}</span>
                <a href={`/presse/graphiques/${name}`} download className="btn btn-secondary btn-sm">Télécharger le PNG</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="chiffres-titre" className="mt-10">
        <h2 id="chiffres-titre" className="t-h3">Chiffres clés</h2>
        <div className="prose-lab">
          <table>
            <tbody>
              {FIGURES.map((f) => (
                <tr key={f.label}>
                  <th scope="row">{f.label}</th>
                  <td className="num">{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="t-small text-muted mt-3">
          Moyennes, écarts-types et effectifs : Veale et al., BJU International, 2015. Proportions et valeurs aux percentiles : calculées par le site (loi normale
          construite sur ces références), avec les mêmes fonctions que le rapport. Méthode détaillée : <Link href="/methode" className="text-accent underline">Précision et méthode</Link>.
        </p>
      </section>

      <section aria-labelledby="pages-titre" className="mt-10">
        <h2 id="pages-titre" className="t-h3">Pages de référence</h2>
        <ul className="prose-lab mt-3">
          <li><Link href="/taille-moyenne-penis">Taille moyenne du pénis : les chiffres de référence</Link></li>
          <li><Link href="/percentile-penis">Percentile du pénis : définition, calcul et tableau complet</Link></li>
          <li><Link href="/taille-penis-normale">Quelle est la taille normale du pénis ?</Link></li>
          <li><Link href="/a-propos">À propos de Bitomètre : méthode, sources, limites</Link></li>
        </ul>
        <p className="t-small text-muted mt-4">
          Demandes des journalistes : page <Link href="/contact" className="text-accent underline">Contact</Link>. Les résultats du site sont des estimations statistiques, sans valeur médicale. Service réservé aux adultes.
        </p>
      </section>
    </div>
  );
}
