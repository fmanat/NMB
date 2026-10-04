import { isPhotoPaidPublic } from "@/lib/payments/policy";
import type { Metadata } from "next";
import Link from "next/link";
import { FORMULAS, REFERENCES, REFERENCE_SAMPLES, REPORT_ACCESS, SITE, formatEur } from "@/config/site";
import { BETA, isFreeBeta, isPhotoBeta } from "@/lib/mode";
import { exampleReport } from "@/lib/exampleReport";
import { f1 } from "@/lib/format";
import { ScanButton } from "@/components/ScanButton";
import { ScannerBand } from "@/components/scanner/ScannerBand";
import { TrackView } from "@/components/TrackView";
import { TrackOnView } from "@/components/Tracked";
import { PhotoOffer } from "@/components/PhotoOffer";
import { Accordion } from "@/components/ui/Accordion";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ReportDashboard } from "@/components/report/ReportDashboard";
import { ResultHero } from "@/components/report/ResultHero";
import { ogImagePath, toJsonLd, webApplication } from "@/lib/structuredData";
import { HomeGuides } from "@/components/content/HomeGuides";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "ruler", title: "Vos mesures", text: "Longueur, circonférence, courbure : quatre questions, une par écran. Environ une minute." },
  { icon: "barChart", title: "Le calcul", text: "Vos valeurs sont placées sur les courbes d'une étude scientifique de référence (Veale et al., 2015)." },
  { icon: "scanLine", title: "Votre résultat", text: "Votre percentile, votre profil, votre score et vos repères, tout de suite, sur un lien privé." },
];

// Accueil statique régénéré toutes les 5 minutes (Next.js sert la page en cache puis la reconstruit en arrière-plan) : le compteur
// d'analyses du bandeau reste à jour sans aucun appel réseau dans le navigateur et sans rendre la page dynamique à chaque visite.
// Valeur littérale obligatoire (Next.js ne lit pas une constante importée) : tests/ticker.test.ts la vérifie.
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: `Calculateur taille pénis : percentile et moyenne | ${SITE.name}` },
  description: isFreeBeta()
    ? "À quel percentile êtes-vous ? Comparez votre longueur et votre circonférence aux données scientifiques de référence. Gratuit, une minute, sans compte."
    : "À quel percentile êtes-vous ? Comparez votre longueur et votre circonférence aux données scientifiques de référence. Une minute, sans compte.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", siteName: SITE.name, locale: "fr_FR", images: [{ url: ogImagePath("accueil"), width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: [ogImagePath("accueil")] },
};

/** Sous le bouton principal : ce que coûte le test (vrai en bêta comme en version payante). */
function CtaNote({ beta, className = "" }: { beta: boolean; className?: string }) {
  return (
    <p className={`t-small text-muted flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      {(beta ? ["Gratuit", "environ 1 minute", "sans compte"] : ["Environ 1 minute", "sans compte", "paiement unique"]).map((t, i) => (
        <span key={t} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="text-[var(--bm-gray-500)]">·</span>}
          {t}
        </span>
      ))}
    </p>
  );
}

export default async function Home() {
  const beta = isFreeBeta();
  const photoBeta = isPhotoBeta(); // bêta photo : la formule photo (B) est proposée ; les libellés disent ce qu'elle fait réellement
  const photoPaid = isPhotoPaidPublic(); // formule photo payante par Plisio : seul le questionnaire est gratuit
  const photoPrice = formatEur(FORMULAS.B.priceEur);
  const ex = exampleReport();
  const L = REFERENCES.erect.length;
  const G = REFERENCES.erect.girth;

  return (
    <>
      <TrackView event="home_view" />
      <TrackOnView event="landing_view" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(webApplication(beta)) }} />

      {/* 1. Hero : une question, une action. Le résultat d'exemple montre tout de suite ce que l'on obtient. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[var(--bm-blue-050)] to-white">
        <div className="container-bm pt-6 pb-12 md:pt-16 md:pb-20 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:items-center">
          <div>
            <h1>
              <span className="t-eyebrow block">Calculateur de taille du pénis</span>
              <span className="t-display block mt-3 md:mt-4">À quel percentile êtes-vous&nbsp;?</span>
            </h1>
            <p className="t-lead text-muted mt-4 md:mt-5 max-w-[32rem]">
              Découvrez exactement où vous vous situez, comparé aux mesures d&apos;une étude scientifique de référence. Pas de jugement : juste des chiffres.
            </p>
            <div className="mt-6 md:mt-8">
              <ScanButton fullOnMobile label="Découvrir mon percentile" />
              <CtaNote beta={beta} className="mt-3 justify-center sm:justify-start" />
            </div>
            <ul className="mt-6 hidden sm:flex flex-wrap gap-x-5 gap-y-2 t-small text-muted">
              <li className="inline-flex items-center gap-1.5"><Icon name="lock" size={16} className="text-accent" /> Lien privé, aucun e-mail</li>
              <li className="inline-flex items-center gap-1.5"><Icon name="barChart" size={16} className="text-accent" /> Méthode publique</li>
              <li className="inline-flex items-center gap-1.5"><Icon name="shieldCheck" size={16} className="text-accent" /> Réservé aux adultes</li>
            </ul>
          </div>
          <div className="lg:pl-4">
            <ResultHero results={ex} example compact />
            <p className="t-caption text-muted mt-3 text-center lg:text-left">
              Exemple calculé par le site sur des valeurs fictives. Le vôtre s&apos;affiche en une minute.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Comment ça marche */}
      <section id="comment-ca-marche" className="section">
        <div className="container-bm">
          <p className="t-eyebrow">Comment ça marche</p>
          <h2 className="t-h2 mt-3 max-w-[28ch]">Trois étapes. Une minute. Votre position exacte.</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {STEPS.map((s, i) => (
              <Card key={s.title} as="li" className="list-none">
                <div className="flex items-center justify-between">
                  <span className="grid place-items-center size-11 rounded-[10px] bg-soft text-accent"><Icon name={s.icon} size={22} /></span>
                  <span className="num font-bold text-[28px] text-[var(--bm-gray-500)]" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="t-h4 mt-5">{s.title}</h3>
                <p className="text-muted mt-2">{s.text}</p>
              </Card>
            ))}
          </ol>
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
            <ScanButton fullOnMobile label="À vous de jouer" />
            <CtaNote beta={beta} />
          </div>
        </div>
      </section>

      {/* 3. Le résultat complet (exemple) : percentile, profil, indicateurs, repères */}
      <section id="exemple" className="section bg-[var(--bm-gray-050)] border-y border-[var(--bm-gray-200)]">
        <div className="container-bm">
          <p className="t-eyebrow">Votre résultat</p>
          <h2 className="t-h2 mt-3 max-w-[30ch]">Bien plus qu&apos;un chiffre.</h2>
          <p className="t-lead text-muted mt-4 max-w-[46rem]">
            Percentile de longueur et de circonférence, profil morphologique, courbes, score et repères de taille. Ci-dessous, un exemple sur des valeurs
            inventées, calculé avec les mêmes formules que votre résultat.
          </p>
          <div className="mt-8">
            <ReportDashboard results={ex} example lead="percentile" />
          </div>
          <div className="mt-8 flex flex-col items-center gap-2">
            <ScanButton fullOnMobile label="Voir mon propre résultat" />
            <CtaNote beta={beta} />
          </div>
        </div>
      </section>

      {/* 4. Analyse photo (produit payant) */}
      {photoBeta && (
        <section id="analyse-photo" className="section">
          <div className="container-bm">
            <PhotoOffer variant="home" paid={photoPaid} />
          </div>
        </section>
      )}

      {/* 5. Les chiffres de référence (tous issus de la configuration, Veale et al. 2015) */}
      <section aria-labelledby="chiffres" className="section bg-[var(--bm-navy-900)] text-white">
        <div className="container-bm">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9fc2ff]">La science derrière le chiffre</p>
          <h2 id="chiffres" className="t-h2 mt-3 max-w-[28ch]">La curiosité est humaine. Les statistiques aussi.</h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { v: `${f1(L.mean)} cm`, l: "Longueur médiane en érection" },
              { v: `${f1(G.mean)} cm`, l: "Circonférence médiane en érection" },
              { v: `${f1(L.mean - L.sd)} à ${f1(L.mean + L.sd)} cm`, l: "Longueur de 2 hommes sur 3 (à un écart-type de la médiane)" },
              { v: REFERENCE_SAMPLES.total.toLocaleString("fr-FR"), l: `Hommes mesurés par des professionnels de santé dans l'étude de référence, dont ${REFERENCE_SAMPLES.erect.length} en érection` },
            ].map((s) => (
              <div key={s.l} className="rounded-[16px] border border-white/10 bg-white/[0.05] p-5">
                <dd className="num text-[30px] leading-[34px] font-bold">{s.v}</dd>
                <dt className="mt-2 text-[14px] leading-[20px] text-[#c9d6ea]">{s.l}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div className="space-y-4 text-[#dbe6f7] leading-relaxed">
              <p>
                Référence : Veale et al., <em>BJU International</em>, 2015, une synthèse de mesures prises par des professionnels de santé, pas des
                déclarations en ligne. Vos valeurs sont placées sur ces courbes par une loi normale : le percentile dit quelle part de la population se
                trouve sous votre valeur.
              </p>
              <p>
                Le score sur 100 est une note de présentation, volontairement indulgente : il n&apos;est jamais présenté comme un percentile. Tout est
                décrit publiquement.
              </p>
              <Link href="/methode" className="inline-flex items-center gap-2 font-semibold text-white underline">
                Lire la méthode <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            <div className="-mx-4 min-[390px]:-mx-5 md:mx-0">
              <ScannerBand ex={ex} />
            </div>
          </div>
        </div>
      </section>

      {/* 6. Confidentialité */}
      <section aria-labelledby="confidentialite" className="section">
        <div className="container-bm">
          <p className="t-eyebrow">Confidentialité</p>
          <h2 id="confidentialite" className="t-h2 mt-3 max-w-[28ch]">Votre résultat ne regarde que vous.</h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              { icon: "users" as const, t: "Aucun compte, aucun e-mail", d: "Votre résultat s'ouvre par un lien privé, impossible à deviner. Rien ne vous identifie." },
              { icon: "trash" as const, t: "Supprimable à tout moment", d: beta ? `Un bouton efface votre rapport. Pendant la bêta, il l'est de toute façon après ${BETA.reportTtlDays} jours au plus.` : `Un bouton efface votre rapport. Sinon, il reste accessible au moins ${REPORT_ACCESS.minYears} ans.` },
              { icon: "lock" as const, t: "Partage sous votre contrôle", d: "Rien n'est public tant que vous ne créez pas une carte de partage, qui ne montre que ce que vous choisissez." },
            ].map((x) => (
              <Card key={x.t} as="li" className="list-none">
                <span className="grid place-items-center size-11 rounded-[10px] bg-soft text-accent"><Icon name={x.icon} size={22} /></span>
                <h3 className="t-h4 mt-4">{x.t}</h3>
                <p className="t-small text-muted mt-2">{x.d}</p>
              </Card>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Repères : pages par centimètre et pages piliers */}
      <HomeGuides />

      {/* 8. FAQ */}
      <section id="faq" className="section">
        <div className="container-bm container-narrow">
          <p className="t-eyebrow">Questions fréquentes</p>
          <h2 className="t-h2 mt-3">Avant de commencer.</h2>
          <div className="mt-8">
            <Accordion question="Qu'est-ce qu'un percentile ?">
              La part de la population de référence qui se trouve sous votre valeur. Au 65e percentile, environ 65 % des hommes de la population de référence
              ont une valeur inférieure à la vôtre, et 35 % une valeur supérieure. Le 50e percentile, c&apos;est la médiane.
            </Accordion>
            <Accordion question="Le score sur 100 est-il un classement ?">
              Non. C&apos;est une note de présentation volontairement indulgente : un profil médian obtient environ 72/100. Pour vous situer, lisez les
              percentiles, qui sont calculés exactement.
            </Accordion>
            <Accordion question={beta ? "Combien ça coûte ?" : "Quels sont les tarifs ?"}>
              {beta && photoPaid
                ? `Le test est gratuit pendant la bêta. L'analyse d'une photo coûte ${photoPrice} TTC, en paiement unique demandé une fois l'analyse terminée, réglé en cryptomonnaie sur la page de Plisio, notre prestataire de paiement.`
                : beta
                  ? "Le service est gratuit pendant la bêta : aucun paiement n'est demandé et aucune donnée de paiement n'est collectée."
                  : `Paiement unique, sans abonnement : ${Object.values(FORMULAS).map((f) => `${f.label} ${formatEur(f.priceEur)}`).join(", ")}, toutes taxes comprises.`}
            </Accordion>
            <Accordion question="Comment bien me mesurer ?">
              Longueur : sur le dessus, de l&apos;os pubien (règle appuyée) jusqu&apos;à l&apos;extrémité. Circonférence : un mètre ruban souple autour du
              milieu de la tige. Le détail, avec les erreurs fréquentes, est sur la page{" "}
              <Link href="/comment-mesurer-son-penis" className="text-accent underline">Comment mesurer son pénis</Link>.
            </Accordion>
            <Accordion question="Que devient mon résultat ?">
              {beta
                ? `Il est accessible par son lien privé, que vous seul connaissez. Pendant la bêta, il est effacé au plus tard après ${BETA.reportTtlDays} jours ; vous pouvez aussi le supprimer à tout moment et le télécharger en PDF.`
                : `Il reste accessible par son lien privé pendant au moins ${REPORT_ACCESS.minYears} ans et téléchargeable en PDF. Vous pouvez le supprimer à tout moment.`}
            </Accordion>
            <Accordion question="Quelle est la précision ?">
              {photoBeta
                ? "Avec le test, les valeurs sont celles que vous déclarez, sans vérification ; avec une photo, elles sont estimées par un modèle d'analyse, ou mesurées sur une carte de référence posée à côté (badge « Taille calibrée »). Dans les deux cas, ce sont des estimations. "
                : "Les valeurs sont déclarées et non vérifiées. "}
              Les percentiles supposent une loi normale et les références de Veale et al. (2015). Le détail figure sur la page{" "}
              <Link href="/methode" className="text-accent underline">Précision et méthode</Link>. Ce n&apos;est pas un avis médical.
            </Accordion>
          </div>
        </div>
      </section>

      {/* 9. Appel final */}
      <section className="pb-16 md:pb-24">
        <div className="container-bm">
          <div className="rounded-[22px] bg-[var(--bm-navy-900)] text-white px-6 py-10 md:px-12 md:py-14 text-center">
            <h2 className="t-h2">Vous voulez savoir où vous vous situez&nbsp;?</h2>
            <p className="mt-3 text-[#c9d6ea] max-w-[34rem] mx-auto">Quatre questions, une minute, et votre percentile s&apos;affiche.</p>
            <div className="mt-7 flex justify-center">
              <ScanButton fullOnMobile label="Découvrir mon percentile" className="!bg-white !text-[var(--bm-navy-900)] hover:!bg-[var(--bm-blue-100)]" />
            </div>
            <p className="t-small text-[#9fb3d1] mt-4">{beta ? "Gratuit · " : ""}{SITE.name} · Réservé aux adultes</p>
          </div>
        </div>
      </section>
    </>
  );
}
