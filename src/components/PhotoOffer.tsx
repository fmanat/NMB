import Link from "next/link";
import { FORMULAS, formatEur } from "@/config/site";
import { TrackedLink } from "@/components/Tracked";
import { Icon } from "@/components/ui/Icon";

// Offre « analyse photo » (formule B). Chaque ligne décrit ce que le rapport photo contient RÉELLEMENT (src/components/report/MorphoReport.tsx,
// src/lib/morpho.ts) : rien n'est promis que le rapport ne livre pas. Affichée seulement quand la formule photo est accessible.

/** Ce que le rapport photo apporte, en plus du questionnaire. */
export const PHOTO_BENEFITS: { title: string; text: string }[] = [
  { title: "Des mesures estimées, plus seulement déclarées", text: "Longueur et circonférence estimées sur votre photo ; mesure calibrée si une carte au format bancaire est posée à côté." },
  { title: "La courbure en degrés", text: "L'angle et la direction, mesurés sur l'image au lieu d'une case « légère » ou « marquée »." },
  { title: "Quatre indicateurs exclusifs", text: "Symétrie bilatérale, rectitude axiale, conicité distale et indice de typicité, chacun sur 100." },
  { title: "Un compte rendu rédigé", text: "Six rubriques, des points remarquables et une conclusion, avec vos percentiles et votre score. PDF inclus." },
];

/**
 * Bloc de vente de l'analyse photo. `variant` : « result » (juste après un résultat du questionnaire) ou « home » (accueil).
 * `paid` : la formule photo est payante (Plisio) ; sinon elle est gratuite pendant la bêta et le prix n'est pas affiché.
 */
export function PhotoOffer({ variant, paid }: { variant: "result" | "home"; paid: boolean }) {
  const price = formatEur(FORMULAS.B.priceEur);
  const result = variant === "result";
  return (
    <section
      aria-labelledby={`offre-photo-${variant}`}
      className="relative overflow-hidden rounded-[22px] border border-[var(--bm-blue-100)] bg-gradient-to-br from-[var(--bm-blue-050)] via-white to-[#eef4ff] p-6 md:p-9"
      data-photo-offer={variant}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bm-navy-900)] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-white">
          <Icon name="camera" size={14} /> Analyse photo
        </span>
        {result && <span className="t-caption text-[#0f55d1] uppercase tracking-[0.1em]">Allez plus loin</span>}
      </div>
      <h2 id={`offre-photo-${variant}`} className="t-h2 mt-4 max-w-[24ch]">
        {result ? "Votre analyse complète vous attend." : "Allez plus loin avec l'analyse photo."}
      </h2>
      <p className="t-lead text-muted mt-3 max-w-[44rem]">
        {result
          ? "Ce résultat repose sur les valeurs que vous avez déclarées. L'analyse photo les estime sur l'image et calcule ce qu'un questionnaire ne peut pas mesurer."
          : "Le questionnaire compare des valeurs déclarées. L'analyse photo les estime sur l'image et ajoute ce qu'aucun questionnaire ne peut mesurer."}
      </p>
      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        {PHOTO_BENEFITS.map((b) => (
          <li key={b.title} className="flex gap-3 rounded-[14px] bg-white/80 border border-[var(--border)] p-3.5 sm:p-4">
            <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-[var(--bm-success-soft)] text-[#0f6f53]">
              <Icon name="check" size={15} />
            </span>
            <span>
              <span className="block font-semibold">{b.title}</span>
              <span className="block t-small text-muted mt-0.5">{b.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <TrackedLink href="/analyse/photo?f=B" event="analysis_cta_click" kind="upsell_click" className="btn btn-primary btn-block-mobile" data-cta="analyse-photo">
          <span>{result ? "Obtenir mon analyse complète" : "Découvrir l'analyse photo"}</span>
          <Icon name="arrowRight" size={18} />
        </TrackedLink>
        <p className="t-small text-muted">
          {paid ? (
            <>
              <span className="num font-semibold text-foreground">{price}</span> · paiement unique, demandé une fois l&apos;analyse terminée. Photo refusée ou
              illisible : rien à payer.
            </>
          ) : (
            "Gratuit pendant la bêta"
          )}
        </p>
      </div>
      <p className="t-caption text-muted mt-5 max-w-[52rem] leading-[18px]">
        Vérification d&apos;âge par un prestataire tiers avant l&apos;envoi. La photo n&apos;est jamais enregistrée par Bitomètre ; elle est analysée par xAI
        (États-Unis), qui conserve les requêtes 30 jours.{paid ? " Paiement en cryptomonnaie uniquement, par Plisio (Bitcoin, Ethereum, USDT, USDC, Solana, Litecoin)." : ""} Estimations, pas un avis médical.{" "}
        <Link href="/confidentialite" className="underline">Confidentialité</Link>
      </p>
    </section>
  );
}
