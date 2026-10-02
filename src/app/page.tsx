import Link from "next/link";
import { FORMULAS, REPORT_ACCESS, SITE, formatEur } from "@/config/site";
import { BETA, isFreeBeta } from "@/lib/mode";
import { exampleReport } from "@/lib/exampleReport";
import { ScanButton } from "@/components/ScanButton";
import { ScannerBand } from "@/components/scanner/ScannerBand";
import { TrackView } from "@/components/TrackView";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { TrustBadge } from "@/components/ui/TrustBadge";
import { ReportDashboard } from "@/components/report/ReportDashboard";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "ruler", title: "Saisir", text: "Vous indiquez votre longueur et votre circonférence en centimètres, et la courbure approximative. Environ une minute." },
  { icon: "barChart", title: "Comparer", text: "Le site compare vos valeurs à une étude de référence publiée (Veale et al., BJU International, 2015) et calcule vos percentiles." },
  { icon: "scanLine", title: "Découvrir", text: "Vous obtenez un rapport chiffré : score, percentiles, courbes, repères de taille. Il reste accessible par son lien privé." },
];

const MEASURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "ruler", title: "Longueur", text: "Votre valeur en centimètres, son percentile et sa position sur la courbe de la population de référence." },
  { icon: "activity", title: "Circonférence", text: "Même lecture : valeur, percentile, courbe. Valeurs de référence au repos ou en érection, selon l'état indiqué." },
  { icon: "scanLine", title: "Courbure", text: "Un angle en degrés sur une échelle de 0° à 30°, avec sa direction." },
  { icon: "barChart", title: "Score global", text: "Une note sur 100, volontairement indulgente. Ce n'est pas un classement : les percentiles, eux, sont exacts." },
];

export default function Home() {
  const beta = isFreeBeta();
  const ex = exampleReport();

  return (
    <>
      <TrackView event="home_view" />

      {/* Hero : le sujet est dit dans le titre et le sous-titre ; un rapport rempli est visible avant de se lancer */}
      <section className="bg-gradient-to-b from-[var(--bm-blue-050)] to-white">
        {/* Mobile : texte, rapport d'exemple compact, puis boutons (le bouton principal reste visible sans défilement à 390 px).
            Ordinateur : texte et boutons à gauche, rapport d'exemple complet à droite. */}
        <div className="container-bm pt-6 pb-10 md:pt-16 md:pb-20 grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:gap-x-14 lg:gap-y-0 lg:content-center">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="t-eyebrow">Science · Données · Statistiques</p>
            <h1 className="t-display mt-3 md:mt-4">Votre profil morphologique en données.</h1>
            <p className="t-lead text-muted mt-3 md:mt-5 max-w-[34rem]">
              Longueur, circonférence, courbure : un rapport statistique chiffré, comparé à une étude de référence.
              <span className="hidden sm:inline">{" "}{beta ? "Gratuit pendant la bêta, sans compte, en une minute." : "Sans compte, paiement unique."}</span>
            </p>
          </div>

          {/* Bandeau « scanner » (dérogation de charte : 3D et fond sombre pour ce seul bandeau) : cylindre abstrait balayé par un plan,
              entouré des valeurs du rapport d'exemple (fictives, marquées « Exemple »). Mobile : pleine largeur entre le texte et le bouton
              (le bouton principal reste visible sans défilement à 390 px). Ordinateur : colonne de droite. Le rapport complet est plus bas (#exemple). */}
          <div className="-mx-4 min-[390px]:-mx-5 md:mx-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-center">
            <ScannerBand ex={ex} />
          </div>

          <div className="lg:col-start-1 lg:row-start-2 lg:self-start lg:mt-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ScanButton fullOnMobile />
              <Button href="#exemple" variant="secondary" fullOnMobile>Voir un exemple de rapport</Button>
            </div>
            <p className="t-small text-muted mt-4">
              Service réservé aux adultes. Résultats statistiques, pas un avis médical.
            </p>
          </div>
        </div>
      </section>

      {/* Preuves de confiance : uniquement des affirmations vraies */}
      <section aria-label="Garanties" className="border-y border-[var(--bm-gray-200)] bg-white">
        <div className="container-bm py-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <TrustBadge icon="users" title="Aucun compte">Pas d&apos;e-mail demandé. Votre rapport s&apos;ouvre par un lien privé.</TrustBadge>
          <TrustBadge icon="lock" title="Connexion chiffrée">Les échanges avec le site sont chiffrés (HTTPS).</TrustBadge>
          <TrustBadge icon="barChart" title="Méthode publique">Formule, références et marges d&apos;erreur sont décrites sur la page Méthode.</TrustBadge>
          {beta ? (
            <TrustBadge icon="checkCircle" title="Gratuit pendant la bêta">Aucun paiement demandé.</TrustBadge>
          ) : (
            <TrustBadge icon="checkCircle" title="Aucun abonnement">Paiement unique, sans engagement.</TrustBadge>
          )}
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment-ca-marche" className="section">
        <div className="container-bm">
          <p className="t-eyebrow">Comment ça marche</p>
          <h2 className="t-h2 mt-3 max-w-[28ch]">Trois étapes, un rapport chiffré.</h2>
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
        </div>
      </section>

      {/* Exemple de rapport complet */}
      <section id="exemple" className="section bg-[var(--bm-gray-050)] border-y border-[var(--bm-gray-200)]">
        <div className="container-bm">
          <div className="flex flex-wrap items-center gap-3">
            <p className="t-eyebrow">Exemple de rapport</p>
            <Badge tone="warning">Exemple · valeurs fictives</Badge>
          </div>
          <h2 className="t-h2 mt-3 max-w-[30ch]">Voici ce que contient votre rapport.</h2>
          <p className="t-lead text-muted mt-4 max-w-[46rem]">
            Les mesures ci-dessous sont inventées pour l&apos;illustration ; les calculs (percentiles, score, repères) sont ceux du site. Avec vos valeurs,
            vous obtenez les mêmes éléments.
          </p>
          <div className="mt-8">
            <ReportDashboard results={ex} example />
          </div>
          <div className="mt-8 text-center">
            <ScanButton label="Obtenir mon rapport" />
          </div>
        </div>
      </section>

      {/* Ce que mesure le rapport */}
      <section className="section">
        <div className="container-bm">
          <p className="t-eyebrow">Ce que mesure le rapport</p>
          <h2 className="t-h2 mt-3 max-w-[28ch]">Quatre indicateurs, une même lecture.</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {MEASURES.map((m) => (
              <Card key={m.title} as="li" className="list-none">
                <span className="grid place-items-center size-11 rounded-[10px] bg-soft text-accent"><Icon name={m.icon} size={22} /></span>
                <h3 className="t-h4 mt-4">{m.title}</h3>
                <p className="t-small text-muted mt-2">{m.text}</p>
              </Card>
            ))}
          </ul>
          <p className="t-small text-muted mt-6 max-w-[52rem]">
            Les valeurs sont celles que vous déclarez : elles ne sont pas vérifiées. Les percentiles reposent sur une loi normale et les références de Veale et al. (2015) ;
            la marge d&apos;erreur d&apos;une estimation n&apos;est jamais inférieure à ± 10 %.{" "}
            <Link href="/methode" className="text-accent underline">Lire la méthode</Link>.
          </p>
        </div>
      </section>

      {/* Offres hors bêta */}
      {!beta && (
        <section className="section bg-[var(--bm-gray-050)] border-y border-[var(--bm-gray-200)]">
          <div className="container-bm">
            <p className="t-eyebrow">Protocoles</p>
            <h2 className="t-h2 mt-3">Trois protocoles, paiement unique.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {Object.values(FORMULAS).map((f) => (
                <Card key={f.id}>
                  <p className="t-caption text-accent uppercase tracking-[0.08em]">Protocole {f.id}</p>
                  <h3 className="t-h4 mt-2">{f.label}</h3>
                  <p className="num t-data-l mt-3">{formatEur(f.priceEur)}</p>
                </Card>
              ))}
            </div>
            <p className="t-small text-muted mt-4">
              Paiement unique, sans abonnement, rapport accessible par son lien privé pendant au moins {REPORT_ACCESS.minYears} ans et téléchargeable en PDF à tout moment.
            </p>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="section">
        <div className="container-bm container-narrow">
          <p className="t-eyebrow">Questions fréquentes</p>
          <h2 className="t-h2 mt-3">Avant de commencer.</h2>
          <div className="mt-8">
            <Accordion question="Que calcule exactement Bitomètre ?">
              À partir des valeurs que vous saisissez, le site calcule votre position par rapport à une population de référence (percentiles), une note sur 100,
              et des repères de taille. Ce sont des estimations statistiques : ni un diagnostic, ni un avis médical.
            </Accordion>
            <Accordion question="Le score sur 100 est-il un classement ?">
              Non. C&apos;est une note de présentation volontairement indulgente : un profil médian obtient environ 72/100. Pour vous situer, lisez les percentiles, qui sont exacts.
            </Accordion>
            <Accordion question={beta ? "Combien ça coûte ?" : "Quels sont les tarifs ?"}>
              {beta
                ? "Le service est gratuit pendant la bêta : aucun paiement n'est demandé et aucune donnée de paiement n'est collectée."
                : `Paiement unique, sans abonnement : ${Object.values(FORMULAS).map((f) => `${f.label} ${formatEur(f.priceEur)}`).join(", ")}, toutes taxes comprises.`}
            </Accordion>
            <Accordion question="Que devient mon rapport ?">
              {beta
                ? `Il est accessible par son lien privé, que vous seul connaissez. Pendant la bêta, il est effacé au plus tard après ${BETA.reportTtlDays} jours ; vous pouvez aussi le supprimer à tout moment et le télécharger en PDF.`
                : `Il reste accessible par son lien privé pendant au moins ${REPORT_ACCESS.minYears} ans et téléchargeable en PDF. Vous pouvez le supprimer à tout moment.`}
            </Accordion>
            <Accordion question="Faut-il un compte ou une adresse e-mail ?">
              Non. Il n&apos;y a ni compte ni e-mail : le lien privé de votre rapport est le seul moyen d&apos;y accéder. Enregistrez-le dans vos favoris.
            </Accordion>
            <Accordion question="Quelle est la précision ?">
              Les valeurs sont déclarées et non vérifiées. Les percentiles supposent une loi normale et les références de Veale et al. (2015). Le détail figure sur la page{" "}
              <Link href="/methode" className="text-accent underline">Précision et méthode</Link>.
            </Accordion>
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section className="pb-16 md:pb-24">
        <div className="container-bm">
          <div className="rounded-[18px] bg-[var(--bm-navy-900)] text-white px-6 py-10 md:px-12 md:py-14 text-center">
            <h2 className="t-h2">Prêt à voir votre rapport ?</h2>
            <p className="mt-3 text-[#c9d6ea] max-w-[34rem] mx-auto">
              {beta ? `Gratuit pendant la bêta. Une minute, aucun compte.` : `Une minute, aucun compte.`} Votre rapport s&apos;affiche tout de suite.
            </p>
            <div className="mt-7 flex justify-center">
              <ScanButton fullOnMobile label="Démarrer mon analyse" className="!bg-white !text-[var(--bm-navy-900)] hover:!bg-[var(--bm-blue-100)]" />
            </div>
            <p className="t-small text-[#9fb3d1] mt-4">{SITE.name} · Réservé aux adultes</p>
          </div>
        </div>
      </section>
    </>
  );
}
