import Link from "next/link";
import type { ReportResults } from "@/lib/reportCore";
import { DIRECTION_FR } from "@/lib/reportCore";
import { f1, rankLabel } from "@/lib/format";
import { profileFor } from "@/lib/profiles";
import { referenceFor } from "@/lib/stats";
import { CountUp } from "./CountUp";
import { PercentileCurve } from "./PercentileCurve";
import { ProfileMark } from "./ProfileCard";

const CURVE_LABEL = { none: "Aucune", light: "Légère", marked: "Marquée" } as const;

/** Le rang en deux morceaux pour l'affichage en grand : « 65e » + « percentile ». Même règle que `rankLabel` (partie entière). */
export function rankParts(p: number): { big: string; small: string; n: number } {
  const label = rankLabel(p);
  if (label.startsWith("au-delà")) return { big: "99e+", small: "percentile", n: 99 };
  if (label.startsWith("sous")) return { big: "<1er", small: "percentile", n: 0 };
  const n = Math.floor(p);
  return { big: n === 1 ? "1er" : `${n}e`, small: "percentile", n };
}

/** Phrase de position, avec la même règle que le reste du site (partie entière, jamais arrondie à la hausse). */
export function aboveSentence(p: number): string {
  if (p >= 99.9) return "Au-delà du 99e percentile : au-dessus de plus de 99 % des hommes de la population de référence.";
  if (p < 1) return "Sous le 1er percentile de la population de référence.";
  return `Au-dessus d'environ ${Math.floor(p)} % des hommes de la population de référence.`;
}

/**
 * Bloc principal du résultat : le percentile en très grand (la réponse à « où suis-je ? »), sa courbe, puis les mesures, le score
 * (évaluation synthétique, présentée séparément et jamais comme un percentile) et le profil. Fond sombre « premium ».
 * Sert au rapport réel (`animate` : le chiffre monte à l'ouverture) et à l'aperçu d'exemple de l'accueil (`example` : marqué comme tel).
 * Reçoit des résultats déjà calculés : aucun calcul statistique ici.
 */
export function ResultHero({ results: r, example = false, animate = false, compact = false }: { results: ReportResults; example?: boolean; animate?: boolean; compact?: boolean }) {
  const state = r.state === "rest" ? "au repos" : "en érection";
  // Dimension mise en avant : la longueur si son percentile existe (rapport photo au repos : non), sinon la circonférence.
  const leadDim: "length" | "girth" = r.length.percentile !== undefined ? "length" : "girth";
  const lead = r[leadDim];
  const p = lead.percentile;
  const ref = referenceFor(r.state, leadDim);
  const parts = p !== undefined ? rankParts(p) : null;
  const profile = r.length.percentile !== undefined && r.girth.percentile !== undefined ? profileFor(r.length.percentile, r.girth.percentile) : null;
  const curve = r.curvature;
  const declared = r.formula === "A";
  const leadName = leadDim === "length" ? "Longueur" : "Circonférence";

  const stats: { label: string; value: string; unit?: string; note: string }[] = [
    { label: "Longueur", value: f1(r.length.value), unit: "cm", note: r.length.percentile !== undefined ? rankLabel(r.length.percentile) : "non positionnée au repos" },
    { label: "Circonférence", value: f1(r.girth.value), unit: "cm", note: r.girth.percentile !== undefined ? rankLabel(r.girth.percentile) : "—" },
    { label: "Courbure", value: f1(curve.angleDeg), unit: "°", note: `${CURVE_LABEL[curve.category]}${curve.direction !== "none" ? ` ${DIRECTION_FR[curve.direction]}` : ""}` },
    { label: "Score", value: String(Math.round(r.score)), unit: "/ 100", note: "évaluation synthétique" },
  ];

  return (
    <section
      aria-label={example ? "Exemple de résultat" : "Votre résultat"}
      className="relative overflow-hidden rounded-[22px] bg-[var(--bm-navy-900)] text-white shadow-[var(--shadow-elevated)]"
      data-result-hero
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(23,105,255,0.45),transparent_70%)]" />
      <div className={`relative ${compact ? "p-5 sm:p-6" : "p-6 md:p-9"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9fc2ff]">
            {example ? "Exemple de résultat" : "Votre résultat"} · {leadName.toLowerCase()} {state}
          </p>
          {example ? (
            <span className="rounded-full border border-[#f5c46b] px-2.5 py-0.5 text-[12px] font-semibold text-[#f5c46b]">Exemple · valeurs fictives</span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-semibold text-[#c9d6ea]">{declared ? "Valeurs déclarées" : "Analyse de photo"}</span>
          )}
        </div>

        {parts && p !== undefined ? (
          <div className="mt-3" role="group" aria-label={`${rankLabel(p)}. ${aboveSentence(p)}`}>
            <p className="flex items-end gap-3 leading-none" aria-hidden="true">
              <span className={`num font-extrabold tracking-[-0.04em] ${compact ? "text-[64px]" : "text-[76px] md:text-[104px]"}`}>
                {animate && parts.big.endsWith("e") && parts.big !== "99e+" ? (
                  <>
                    <CountUp value={parts.n} />e
                  </>
                ) : (
                  parts.big
                )}
              </span>
              <span className={`pb-2 font-semibold uppercase tracking-[0.12em] text-[#9fc2ff] ${compact ? "text-[13px]" : "text-[14px] md:text-[16px] md:pb-4"}`}>{parts.small}</span>
            </p>
            <p className={`mt-2 text-[#dbe6f7] ${compact ? "text-[15px] leading-[22px]" : "text-[17px] leading-[26px] md:text-[19px]"} max-w-[36ch]`}>{aboveSentence(p)}</p>
          </div>
        ) : null}

        <PercentileCurve
          value={lead.value}
          mean={ref.mean}
          sd={ref.sd}
          tone="dark"
          className={compact ? "mt-3" : "mt-5"}
          label={`Courbe de la population de référence, ${leadName.toLowerCase()} ${state} : la partie remplie représente les hommes sous la valeur ${f1(lead.value)} cm.`}
        />

        <dl className={`grid grid-cols-2 gap-2 ${compact ? "mt-3" : "mt-5"} sm:grid-cols-4`}>
          {stats.map((s) => (
            <div key={s.label} className="rounded-[12px] bg-white/[0.06] border border-white/10 px-3 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9fb3d1]">{s.label}</dt>
              <dd className="mt-1">
                <span className="num text-[22px] font-bold leading-none">{s.value}</span>
                {s.unit && <span className="num ml-1 text-[13px] text-[#9fb3d1]">{s.unit}</span>}
                <span className="block text-[12px] text-[#c9d6ea] mt-1">{s.note}</span>
              </dd>
            </div>
          ))}
        </dl>

        {profile && (
          <div className={`flex items-center gap-3 rounded-[12px] bg-white px-3.5 py-3 text-[var(--bm-navy-900)] ${compact ? "mt-3" : "mt-4"}`}>
            <ProfileMark profile={profile} size={9} />
            <p className="text-[14px] leading-[20px]">
              <span className="text-[var(--bm-navy-700)]">Profil : </span>
              <strong className="font-bold">{profile.name}</strong>
            </p>
          </div>
        )}

        {!compact && (
          <p className="mt-4 text-[12.5px] leading-[18px] text-[#9fb3d1]">
            Le percentile dit où vous vous situez ; le score est une note de présentation, volontairement indulgente, qui n&apos;est pas un percentile.{" "}
            <Link href="/methode" className="underline text-[#c9d6ea]">Méthode</Link>
          </p>
        )}
      </div>
    </section>
  );
}
