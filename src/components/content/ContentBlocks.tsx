import Link from "next/link";
import { REFERENCE_SOURCE } from "@/config/site";
import { f1 } from "@/lib/format";
import { CM_SIZES, cmSlug, existingSlugs } from "@/lib/seo";
import { outOfCalculatorRange, perThousandBelow, rankLabel, rawPercentile, seriesRef, shownPercentile, type Series } from "@/lib/seoFigures";
import { valueAtPercentile } from "@/lib/stats";
import { frInt, frNumber } from "@/lib/ticker";
import { snap } from "@/lib/tryIt";
import { ScanButton } from "@/components/ScanButton";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { DistributionChart } from "@/components/report/DistributionChart";
import { TryItLoader } from "@/components/try/TryItLoader";
import { toJsonLd, breadcrumbList, type Crumb } from "@/lib/structuredData";

// Blocs des pages de contenu. Tous les chiffres viennent des fonctions de calcul du site (lib/seoFigures, lib/stats) :
// aucun chiffre statistique écrit à la main. Rendus par le serveur ; seul le calculateur s'exécute dans le navigateur.

/** Fil d'Ariane visible et son balisage BreadcrumbList. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="t-small text-muted">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {crumbs.map((c, i) => (
            <li key={c.path} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">›</span>}
              {i < crumbs.length - 1 ? (
                <Link href={c.path} className="underline hover:text-foreground">{c.name}</Link>
              ) : (
                <span aria-current="page" className="text-foreground">{c.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbList(crumbs)) }} />
    </>
  );
}

/** Mini-calculateur « Essayez » des pages de contenu (même simulation locale que l'accueil, version compacte). */
export function MiniCalculator({ cm }: { cm?: number | null }) {
  const girth = snap("girth", seriesRef("erect-girth").mean);
  const initial = cm ? { state: "erect" as const, length: cm, girth } : undefined;
  return (
    <section aria-labelledby="essayez-titre" className="mt-10">
      <h2 id="essayez-titre" className="t-h3">{cm ? `Essayez : ${cm} cm, et vos autres valeurs` : "Essayez avec vos valeurs"}</h2>
      <p className="t-small text-muted mt-2">
        Mêmes références et mêmes calculs que le rapport, exécutés dans votre navigateur : rien n&apos;est enregistré ni envoyé.
        {cm ? " La circonférence est préremplie à la valeur médiane de référence : ajustez-la." : ""}
      </p>
      <noscript>
        <p className="t-small text-muted mt-2">La simulation demande JavaScript. Le questionnaire, lui, fonctionne sans.</p>
      </noscript>
      <div className="mt-5">
        <TryItLoader initial={initial} compact idPrefix="essai" />
      </div>
    </section>
  );
}

/** Réponse immédiate d'une page par centimètre : percentile et « sur 1 000 hommes ». */
export function CmAnswer({ cm }: { cm: number }) {
  const s: Series = "erect-length";
  const raw = rawPercentile(s, cm);
  const shown = shownPercentile(s, cm);
  const ref = seriesRef(s);
  const out = outOfCalculatorRange(s, cm);
  const below = perThousandBelow(s, cm);
  return (
    <Card as="section" className="!p-5 md:!p-6 mt-6" >
      <h2 className="sr-only">En bref</h2>
      <p className="t-eyebrow">{cm} cm en érection</p>
      <p className="num text-[28px] leading-[34px] md:text-[34px] md:leading-[40px] font-bold mt-2 text-accent">{rankLabel(raw)}</p>
      <p className="mt-2 font-semibold">
        Sur 1 000 hommes de la population de référence, environ {frInt(below)} mesurent moins de {cm} cm.
      </p>
      <p className="t-small text-muted mt-3">
        Percentile {f1(shown)} pour une longueur en érection de {cm} cm (loi normale, moyenne {frNumber(ref.mean)} cm, écart-type {frNumber(ref.sd)} cm,{" "}
        {REFERENCE_SOURCE}).
        {out ? " Cette valeur se situe au-delà de la plage que le calculateur du site positionne : l'estimation n'est donnée qu'à titre indicatif." : ""}
      </p>
      <div className="mt-4">
        <DistributionChart label={`Longueur en érection, repère à ${cm} cm`} value={cm} mean={ref.mean} sd={ref.sd} marker="Repère" />
      </div>
    </Card>
  );
}

/** Courbe de la population de référence, sans repère individuel : repères aux 10e, 50e et 90e percentiles (valeurs calculées). */
export function ReferenceCurve({ series, title }: { series: Series; title: string }) {
  const r = seriesRef(series);
  const W = 320;
  const H = 130;
  const top = 18;
  const base = H - 30;
  const lo = r.mean - 3.5 * r.sd;
  const hi = r.mean + 3.5 * r.sd;
  const x = (v: number) => ((v - lo) / (hi - lo)) * W;
  const pdf = (v: number) => Math.exp(-0.5 * ((v - r.mean) / r.sd) ** 2);
  const pts = Array.from({ length: 71 }, (_, i) => {
    const v = lo + ((hi - lo) * i) / 70;
    return `${x(v).toFixed(1)},${(base - pdf(v) * (base - top)).toFixed(1)}`;
  });
  const marks = [10, 50, 90].map((p) => ({ p, v: valueAtPercentile(p, r.mean, r.sd) }));
  const band = `M${x(marks[0].v).toFixed(1)},${base} ` +
    Array.from({ length: 41 }, (_, i) => {
      const v = marks[0].v + ((marks[2].v - marks[0].v) * i) / 40;
      return `L${x(v).toFixed(1)},${(base - pdf(v) * (base - top)).toFixed(1)}`;
    }).join(" ") + ` L${x(marks[2].v).toFixed(1)},${base} Z`;
  return (
    <figure className="mt-6 max-w-[560px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={`${title} : courbe de la population de référence. 10e percentile ${f1(marks[0].v)} cm, médiane ${f1(marks[1].v)} cm, 90e percentile ${f1(marks[2].v)} cm.`}>
        <path d={`M0,${base} L${pts.join(" L")} L${W},${base} Z`} fill="var(--bm-blue-050)" />
        <path d={band} fill="var(--bm-blue-400)" fillOpacity="0.3" />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--bm-blue-400)" strokeWidth="2" />
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--border)" />
        {marks.map((m) => (
          <g key={m.p}>
            <line x1={x(m.v)} x2={x(m.v)} y1={top} y2={base} stroke={m.p === 50 ? "var(--accent)" : "var(--bm-gray-500)"} strokeWidth={m.p === 50 ? 2 : 1} strokeDasharray={m.p === 50 ? undefined : "3 3"} />
            <text x={x(m.v)} y={base + 13} fontSize="10.5" textAnchor="middle" fill="var(--bm-navy-700)" className="num">{`${f1(m.v)} cm`}</text>
            <text x={x(m.v)} y={base + 25} fontSize="9.5" textAnchor="middle" fill="var(--muted)">{m.p === 50 ? "médiane" : `${m.p}e perc.`}</text>
          </g>
        ))}
      </svg>
      <figcaption className="t-caption text-muted mt-2">
        {title}. Zone foncée : 80 % des hommes de la population de référence, entre le 10e et le 90e percentile. Loi normale, {REFERENCE_SOURCE}.
      </figcaption>
    </figure>
  );
}

/** Lignes du tableau des percentiles (calculées) : longueur en érection 10 à 20 cm, circonférence 9 à 15 cm. */
export function percentileRows(series: Series, from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const cm = from + i;
    const raw = rawPercentile(series, cm);
    return { cm, shown: shownPercentile(series, cm), rank: rankLabel(raw), perThousand: perThousandBelow(series, cm) };
  });
}

/** Tableaux des percentiles, chaque ligne de longueur renvoyant vers la page du centimètre. */
export function PercentileTables() {
  const len = percentileRows("erect-length", 10, 20);
  const exists = existingSlugs();
  const girth = percentileRows("erect-girth", 9, 15);
  return (
    <div className="mt-6 space-y-8">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px]">
          <caption className="text-left t-small text-muted mb-2">Longueur en érection : part de la population de référence en dessous de chaque valeur</caption>
          <thead>
            <tr><th scope="col">Longueur</th><th scope="col">Percentile</th><th scope="col">Sur 1 000 hommes, mesurent moins</th></tr>
          </thead>
          <tbody>
            {len.map((r) => (
              <tr key={r.cm}>
                <th scope="row">{exists.has(cmSlug(r.cm)) ? <Link href={`/${cmSlug(r.cm)}`}>{r.cm} cm</Link> : `${r.cm} cm`}</th>
                <td className="num">{f1(r.shown)}</td>
                <td className="num">{frInt(r.perThousand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px]">
          <caption className="text-left t-small text-muted mb-2">Circonférence en érection : part de la population de référence en dessous de chaque valeur</caption>
          <thead>
            <tr><th scope="col">Circonférence</th><th scope="col">Percentile</th><th scope="col">Sur 1 000 hommes, mesurent moins</th></tr>
          </thead>
          <tbody>
            {girth.map((r) => (
              <tr key={r.cm}>
                <th scope="row">{r.cm} cm</th>
                <td className="num">{f1(r.shown)}</td>
                <td className="num">{frInt(r.perThousand)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="t-caption text-muted">
        Percentiles calculés par le site (loi normale, {REFERENCE_SOURCE}), affichés avec une décimale et bornés entre 0,1 et 99,9.
      </p>
    </div>
  );
}

/** Les 11 pages par centimètre, avec leur rang. `current` : taille de la page affichée (mise en évidence). */
export function SizeLinks({ current, title = "Où vous situez-vous ?", bare = false }: { current?: number | null; title?: string; bare?: boolean }) {
  const exists = existingSlugs();
  const sizes = CM_SIZES.filter((n) => exists.has(cmSlug(n)));
  if (sizes.length === 0) return null;
  return (
    <nav aria-labelledby={bare ? undefined : "tailles-titre"} aria-label={bare ? "Tailles en centimètres" : undefined} className={bare ? "" : "mt-10"}>
      {!bare && (
        <>
          <h2 id="tailles-titre" className="t-h3">{title}</h2>
          <p className="t-small text-muted mt-2">Longueur en érection : choisissez une taille pour voir sa position dans la population de référence.</p>
        </>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 md:grid-cols-4">
        {sizes.map((n) => (
          <li key={n}>
            <Link
              href={`/${cmSlug(n)}`}
              aria-current={n === current ? "page" : undefined}
              className={`flex min-h-[48px] flex-col justify-center rounded-[10px] border px-3 py-2 no-underline hover:border-[var(--accent)] ${n === current ? "border-[var(--accent)] bg-[var(--bm-blue-050)]" : "border-[var(--border)] bg-white"}`}
            >
              <span className="num font-semibold text-foreground">{n} cm</span>
              <span className="t-caption text-muted">{rankLabel(rawPercentile("erect-length", n))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Tailles voisines d'une page par centimètre. */
export function NeighborSizes({ cm }: { cm: number }) {
  const exists = existingSlugs();
  const prev = exists.has(cmSlug(cm - 1)) ? cm - 1 : null;
  const next = exists.has(cmSlug(cm + 1)) ? cm + 1 : null;
  return (
    <nav aria-label="Tailles voisines" className="mt-8 grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link href={`/${cmSlug(prev)}`} className="card card-hover !p-4 no-underline">
          <span className="t-caption text-muted">‹ Taille précédente</span>
          <span className="block num font-semibold text-foreground mt-1">{prev} cm : {rankLabel(rawPercentile("erect-length", prev))}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link href={`/${cmSlug(next)}`} className="card card-hover !p-4 no-underline sm:text-right">
          <span className="t-caption text-muted">Taille suivante ›</span>
          <span className="block num font-semibold text-foreground mt-1">{next} cm : {rankLabel(rawPercentile("erect-length", next))}</span>
        </Link>
      ) : <span />}
    </nav>
  );
}

/** Comment vérifier sa mesure : liste courte, renvoi vers le guide complet. */
export function MeasureCheck() {
  return (
    <section aria-labelledby="verifier-titre" className="mt-10">
      <h2 id="verifier-titre" className="t-h3">Vérifier sa mesure en quatre points</h2>
      <ul className="mt-4 space-y-2">
        {[
          "Mesurer en érection complète, debout, le pénis tenu à l'horizontale.",
          "Poser une règle rigide sur le dessus, contre le pubis, en appuyant jusqu'à l'os.",
          "Lire la valeur à l'extrémité, sans compter le prépuce au-delà du gland.",
          "Recommencer deux ou trois fois, à des moments différents, et retenir la valeur la plus fréquente.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3">
            <Icon name="checkCircle" size={18} className="mt-0.5 flex-none text-accent" />
            <span className="text-muted">{t}</span>
          </li>
        ))}
      </ul>
      <p className="t-small mt-4">
        <Link href="/comment-mesurer-son-penis" className="text-accent underline">Le guide complet de la mesure</Link>
      </p>
    </section>
  );
}

/** Appel à l'action vers le questionnaire. */
export function QuestionnaireCta({ cm }: { cm?: number | null }) {
  return (
    <aside className="card !p-6 mt-10 text-center">
      <p className="t-h4">{cm ? `Situer ${cm} cm avec vos autres mesures` : "Situer vos propres mesures"}</p>
      <p className="t-small text-muted mt-2 max-w-[36rem] mx-auto">
        Le questionnaire combine longueur, circonférence et courbure dans un rapport chiffré : percentiles, courbes et repères. Environ une minute, aucun compte.
      </p>
      <div className="mt-5 flex justify-center">
        <ScanButton label="Remplir le questionnaire" />
      </div>
    </aside>
  );
}
