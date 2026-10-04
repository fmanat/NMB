"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LIMITS, MAX_SIGMA } from "@/config/site";
import { DIRECTION_FR, OUT_OF_RANGE_MESSAGE } from "@/lib/reportCore";
import { referenceFor, type BodyState } from "@/lib/stats";
import { track, type TrackEvent } from "@/lib/track";
import { Icon } from "@/components/ui/Icon";
import { submitQuestionnaire, type FormState } from "./actions";

// Test en quatre écrans, une question par écran : état, dimensions, courbure, validation. Tous les champs restent dans UN seul formulaire
// (mêmes noms qu'avant : state, length, girth, curvature, direction, adult, consent) envoyé à la même action serveur ; les écrans
// inactifs sont seulement masqués. Sans JavaScript, une feuille de style <noscript> réaffiche tous les écrans : le formulaire classique.
// Aucune attente simulée : l'écran « Calcul en cours » ne s'affiche que pendant le vrai traitement par le serveur.

type Curv = "none" | "light" | "marked";
type Dir = "left" | "right" | "up" | "down";
const STEP_NAMES = ["État", "Dimensions", "Courbure", "Validation"] as const;
const STEP_EVENTS: TrackEvent[] = ["test_step_1", "test_step_2", "test_step_3", "test_step_4"];
const DIRS: Dir[] = ["left", "right", "up", "down"];
const CURVES: { v: Curv; label: string; hint: string }[] = [
  { v: "none", label: "Aucune", hint: "Droit, ou presque" },
  { v: "light", label: "Légère", hint: "Une courbe visible mais discrète" },
  { v: "marked", label: "Marquée", hint: "Une courbe nette" },
];

const parse = (s: string) => Number(s.trim().replace(",", "."));

/** Erreur d'un champ de dimension, avec les mêmes règles que le serveur (plage du schéma, puis MAX_SIGMA écarts-types). */
function dimError(dim: "length" | "girth", raw: string, state: BodyState | ""): string | null {
  const name = dim === "length" ? "la longueur" : "la circonférence";
  if (raw.trim() === "") return `Indiquez ${name} en centimètres.`;
  const n = parse(raw);
  if (!Number.isFinite(n) || n < LIMITS[dim].min || n > LIMITS[dim].max) return `Vérifiez ${name} : une valeur en centimètres, par exemple ${dim === "length" ? "13,5" : "11,8"}.`;
  if (state) {
    const ref = referenceFor(state, dim);
    if (Math.abs(n - ref.mean) / ref.sd > MAX_SIGMA) return OUT_OF_RANGE_MESSAGE;
  }
  return null;
}

function Choice({ name, value, checked, onPick, title, hint, big = false }: { name: string; value: string; checked: boolean; onPick: () => void; title: string; hint?: string; big?: boolean }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-4 rounded-[16px] border-2 bg-[var(--surface)] px-5 transition-colors ${big ? "min-h-[84px]" : "min-h-[60px]"} ${
        checked ? "border-accent bg-[var(--bm-blue-050)]" : "border-[var(--border)] hover:border-[var(--bm-blue-400)]"
      } has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--bm-blue-400)]`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={() => {}} onClick={onPick} className="size-5 flex-none accent-[var(--accent)]" />
      <span className="min-w-0">
        <span className={`block font-semibold ${big ? "text-[19px]" : "text-[17px]"}`}>{title}</span>
        {hint && <span className="block t-small text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function DimField({ id, name, label, value, onChange, helper, error, placeholder }: { id: string; name: string; label: string; value: string; onChange: (v: string) => void; helper: string; error: string | null; placeholder: string }) {
  const bump = (d: number) => {
    const n = parse(value);
    const base = Number.isFinite(n) && value.trim() !== "" ? n : parse(placeholder.replace("ex. ", ""));
    onChange(String(Math.round((base + d) * 10) / 10).replace(".", ","));
  };
  return (
    <div>
      <label htmlFor={id} className="block font-semibold mb-2">{label}</label>
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => bump(-0.5)} className="wz-js grid w-14 flex-none place-items-center rounded-[12px] border border-[var(--border)] text-[22px] font-semibold hover:bg-[var(--bm-gray-050)]" aria-label={`${label} : moins 0,5 cm`}>
          −
        </button>
        <div className="relative flex-1">
          <input
            id={id}
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            aria-describedby={`${id}-h${error ? ` ${id}-e` : ""}`}
            aria-invalid={error ? true : undefined}
            className="num w-full !h-[64px] pl-3 pr-11 text-center !text-[28px] font-bold placeholder:text-[20px] placeholder:font-medium"
          />
          <span className="absolute inset-y-0 right-0 w-12 grid place-items-center text-muted font-semibold" aria-hidden="true">cm</span>
        </div>
        <button type="button" onClick={() => bump(0.5)} className="wz-js grid w-14 flex-none place-items-center rounded-[12px] border border-[var(--border)] text-[22px] font-semibold hover:bg-[var(--bm-gray-050)]" aria-label={`${label} : plus 0,5 cm`}>
          +
        </button>
      </div>
      <p id={`${id}-h`} className="t-small text-muted mt-2">{helper}</p>
      {error && (
        <p id={`${id}-e`} className="t-small font-medium mt-1.5" style={{ color: "var(--bm-error-text)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function QuestionnaireForm({ beta = false }: { beta?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitQuestionnaire, {});
  const init = state.values ?? {};
  const [step, setStep] = useState(0);
  const [bodyState, setBodyState] = useState<BodyState | "">((init.state as BodyState) || "");
  const [length, setLength] = useState(init.length ?? "");
  const [girth, setGirth] = useState(init.girth ?? "");
  const [curvature, setCurvature] = useState<Curv>(((init.curvature as Curv) || "none"));
  const [direction, setDirection] = useState<Dir | "">((init.direction as Dir) || "");
  const [showErrors, setShowErrors] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const tracked = useRef(new Set<number>());

  useEffect(() => {
    if (tracked.current.has(step)) return;
    tracked.current.add(step);
    track(STEP_EVENTS[step]);
  }, [step]);

  // Erreur renvoyée par le serveur (limite de débit, valeur refusée) : l'envoi part de l'écran de validation, où elle s'affiche.

  const go = (n: number) => {
    setStep(n);
    setShowErrors(false);
    requestAnimationFrame(() => {
      const el = top.current;
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 84; // sous l'en-tête fixe
        if (y < window.scrollY) window.scrollTo({ top: Math.max(0, y) });
      }
      top.current?.querySelector<HTMLElement>("[data-step-title]")?.focus({ preventScroll: true });
    });
  };
  const autoNext = (n: number) => setTimeout(() => go(n), 160);

  const lenErr = dimError("length", length, bodyState);
  const girthErr = dimError("girth", girth, bodyState);
  const curveLabel = `${CURVES.find((c) => c.v === curvature)!.label}${curvature !== "none" && direction ? ` ${DIRECTION_FR[direction]}` : ""}`;

  const panel = (i: number) => `wz-step ${step === i ? "" : "hidden"}`;

  return (
    <div ref={top} className="scroll-mt-24">
      <noscript>
        <style>{`.wz-step{display:block!important}.wz-js{display:none!important}`}</style>
      </noscript>

      {/* Progression */}
      <div className="wz-js mb-6" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1.5 -ml-1 px-1 py-2 t-small font-semibold text-muted hover:text-foreground">
              <Icon name="arrowRight" size={16} className="rotate-180" /> Retour
            </button>
          ) : (
            <span />
          )}
          <p className="t-small font-semibold text-muted num">
            Étape {step + 1} sur {STEP_NAMES.length}
            <span className="sr-only"> : {STEP_NAMES[step]}</span>
          </p>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {STEP_NAMES.map((n, i) => (
            <span key={n} className={`h-1.5 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-[var(--bm-gray-300)]"}`} />
          ))}
        </div>
      </div>

      <form action={action} className="card md:!p-8" onSubmit={() => track("test_complete")} noValidate>
        {/* 1. État */}
        <fieldset className={panel(0)}>
          <legend data-step-title tabIndex={-1} className="t-h2 !text-[26px] !leading-[30px] md:!text-[32px] md:!leading-[36px] outline-none">
            Dans quel état mesurez-vous&nbsp;?
          </legend>
          <p className="text-muted mt-2">Chaque état a sa propre population de référence.</p>
          <div className="mt-6 grid gap-3">
            <Choice name="state" value="erect" big checked={bodyState === "erect"} onPick={() => { setBodyState("erect"); autoNext(1); }} title="En érection" hint="La comparaison la plus courante" />
            <Choice name="state" value="rest" big checked={bodyState === "rest"} onPick={() => { setBodyState("rest"); autoNext(1); }} title="Au repos" hint="Sans érection" />
          </div>
        </fieldset>

        {/* 2. Dimensions */}
        <fieldset className={panel(1)}>
          <legend data-step-title tabIndex={-1} className="t-h2 !text-[26px] !leading-[30px] md:!text-[32px] md:!leading-[36px] outline-none">
            Mesurons vos dimensions.
          </legend>
          <p className="text-muted mt-2">En centimètres, au millimètre près si vous pouvez.</p>
          <div className="mt-6 space-y-6">
            <DimField id="f-length" name="length" label="Longueur (cm)" value={length} onChange={setLength} placeholder="ex. 13,5" helper="Sur le dessus, de l'os pubien (règle appuyée) jusqu'à l'extrémité." error={showErrors ? lenErr : null} />
            <DimField id="f-girth" name="girth" label="Circonférence (cm)" value={girth} onChange={setGirth} placeholder="ex. 11,8" helper="Le tour complet, au milieu de la tige, avec un mètre ruban souple (ou une ficelle, puis une règle)." error={showErrors ? girthErr : null} />
          </div>
          <p className="t-small mt-5">
            <Link href="/comment-mesurer-son-penis" target="_blank" className="text-accent underline">Comment bien mesurer ?</Link>{" "}
            <span className="text-muted">(s&apos;ouvre dans un nouvel onglet)</span>
          </p>
          <button
            type="button"
            className="wz-js btn btn-primary btn-block mt-6"
            onClick={() => {
              if (!bodyState) return go(0);
              if (lenErr || girthErr) return setShowErrors(true);
              go(2);
            }}
          >
            <span>Continuer</span>
            <Icon name="arrowRight" size={18} />
          </button>
        </fieldset>

        {/* 3. Courbure */}
        <fieldset className={panel(2)}>
          <legend data-step-title tabIndex={-1} className="t-h2 !text-[26px] !leading-[30px] md:!text-[32px] md:!leading-[36px] outline-none">
            Et la courbure&nbsp;?
          </legend>
          <p className="text-muted mt-2">Une estimation à l&apos;œil suffit.</p>
          <div className="mt-6 grid gap-3">
            {CURVES.map((c) => (
              <Choice
                key={c.v}
                name="curvature"
                value={c.v}
                checked={curvature === c.v}
                onPick={() => {
                  setCurvature(c.v);
                  if (c.v === "none") {
                    setDirection("");
                    autoNext(3);
                  }
                }}
                title={c.label}
                hint={c.hint}
              />
            ))}
          </div>
          {curvature !== "none" && (
            <fieldset className="mt-6">
              <legend className="font-semibold mb-3">Dans quelle direction&nbsp;?</legend>
              <div className="grid grid-cols-2 gap-3">
                {DIRS.map((d) => (
                  <Choice key={d} name="direction" value={d} checked={direction === d} onPick={() => { setDirection(d); autoNext(3); }} title={DIRECTION_FR[d].replace(/^vers (la |le )?/, "").replace(/^./, (x) => x.toUpperCase())} />
                ))}
              </div>
            </fieldset>
          )}
          {curvature === "none" && <input type="hidden" name="direction" value="none" />}
          <button type="button" className="wz-js btn btn-secondary btn-block mt-6" onClick={() => (curvature !== "none" && !direction ? setShowErrors(true) : go(3))}>
            <span>Continuer</span>
            <Icon name="arrowRight" size={18} />
          </button>
          {showErrors && curvature !== "none" && !direction && (
            <p className="t-small font-medium mt-2" style={{ color: "var(--bm-error-text)" }}>Choisissez la direction de la courbure.</p>
          )}
        </fieldset>

        {/* 4. Validation */}
        <fieldset className={panel(3)}>
          <legend data-step-title tabIndex={-1} className="t-h2 !text-[26px] !leading-[30px] md:!text-[32px] md:!leading-[36px] outline-none">
            Votre résultat est prêt à être calculé.
          </legend>
          <ul className="wz-js mt-5 divide-y divide-[var(--border)] rounded-[14px] border border-[var(--border)]">
            {[
              { k: "État", v: bodyState === "erect" ? "En érection" : bodyState === "rest" ? "Au repos" : "—", s: 0 },
              { k: "Dimensions", v: `${length || "—"} cm · ${girth || "—"} cm`, s: 1 },
              { k: "Courbure", v: curveLabel, s: 2 },
            ].map((r) => (
              <li key={r.k} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block t-caption uppercase tracking-[0.08em] text-muted">{r.k}</span>
                  <span className="block font-semibold num">{r.v}</span>
                </span>
                <button type="button" onClick={() => go(r.s)} className="t-small font-semibold text-accent underline px-2 py-2">
                  Modifier<span className="sr-only"> : {r.k.toLowerCase()}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="space-y-3 mt-6">
            <label className="flex items-start gap-3 text-[15px] leading-[22px] cursor-pointer">
              <input type="checkbox" name="adult" className="mt-0.5 size-5 flex-none accent-[var(--accent)]" />
              <span>J&apos;ai 18 ans ou plus.</span>
            </label>
            {beta && (
              <label className="flex items-start gap-3 text-[15px] leading-[22px] cursor-pointer">
                <input type="checkbox" name="consent" className="mt-0.5 size-5 flex-none accent-[var(--accent)]" />
                <span>
                  Je consens au traitement des valeurs que je saisis (données sensibles, RGPD art. 9) pour calculer mon rapport, comme décrit dans la{" "}
                  <Link href="/confidentialite" target="_blank" className="underline">politique de confidentialité</Link>.
                </span>
              </label>
            )}
          </div>

          {state.error && (
            <p className="mt-5 flex items-start gap-2 rounded-[10px] bg-[var(--bm-error-soft)] px-4 py-3 text-sm font-medium" style={{ color: "var(--bm-error-text)" }} role="alert">
              <Icon name="info" size={18} className="mt-0.5 flex-none" />
              <span>{state.error}</span>
            </p>
          )}

          <div className="mt-6 space-y-3">
            <button type="submit" className={`btn btn-primary btn-block !min-h-[58px] !text-[17px] ${pending ? "btn-loading" : ""}`} disabled={pending} aria-busy={pending}>
              <span>{pending ? "Calcul en cours…" : "Révéler mon percentile"}</span>
              {!pending && <Icon name="arrowRight" size={18} />}
            </button>
            <p className="t-small text-muted text-center">
              {beta ? "Gratuit · résultat immédiat · aucun compte" : "Le questionnaire est gratuit ; le rapport calculé est ensuite verrouillé jusqu'au paiement."}
            </p>
          </div>
        </fieldset>
      </form>

      {/* Pendant le vrai calcul serveur seulement (aucune durée imposée) : les trois opérations réellement effectuées. */}
      {pending && (
        <div className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-[var(--bm-navy-900)]/95 px-6 text-white" role="status" aria-live="polite">
          <div className="max-w-sm text-center">
            <span className="mx-auto block size-12 rounded-full border-4 border-white/20 border-t-white animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <p className="mt-6 text-[22px] font-bold">Calcul de votre résultat…</p>
            <ul className="mt-4 space-y-1.5 text-[15px] text-[#c9d6ea]">
              <li>Comparaison à la population de référence</li>
              <li>Calcul de vos percentiles</li>
              <li>Attribution de votre profil</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
