"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { submitQuestionnaire, type FormState } from "./actions";

const choice =
  "flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-4 min-h-[52px] cursor-pointer font-medium transition-colors has-[:checked]:border-accent has-[:checked]:bg-[var(--bm-blue-050)] hover:border-[var(--bm-blue-400)]";

/** Champ numérique avec unité séparée visuellement : [ 15,2            cm ]. L'étiquette est toujours visible. */
function NumberField({ name, label, unit, placeholder, defaultValue, helper }: { name: string; label: string; unit: string; placeholder: string; defaultValue?: string; helper: string }) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} name={name} defaultValue={defaultValue} inputMode="decimal" placeholder={placeholder} required aria-describedby={`${id}-h`} className="num w-full pl-4 pr-14 text-lg" />
        <span className="absolute inset-y-0 right-0 w-12 grid place-items-center text-muted font-semibold border-l border-[var(--border)]" aria-hidden="true">{unit}</span>
      </div>
      <p id={`${id}-h`} className="t-small text-muted mt-1.5">{helper}</p>
    </div>
  );
}

export function QuestionnaireForm({ beta = false }: { beta?: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitQuestionnaire, {});
  const [curvature, setCurvature] = useState("none");
  const v = state.values ?? {};

  return (
    <form action={action} className="card space-y-6 md:!p-8">
      <fieldset key={"s" + v.state} className="space-y-3">
        <legend className="text-sm font-semibold mb-1">État</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={choice}><input type="radio" name="state" value="rest" defaultChecked={v.state !== "erect"} className="accent-[var(--accent)]" /> Au repos</label>
          <label className={choice}><input type="radio" name="state" value="erect" defaultChecked={v.state === "erect"} className="accent-[var(--accent)]" /> En érection</label>
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <NumberField key={"l" + v.length} name="length" label="Longueur (cm)" unit="cm" placeholder="ex. 13,5" defaultValue={v.length} helper="Mesurée sur le dessus, de la base à l'extrémité." />
        <NumberField key={"g" + v.girth} name="girth" label="Circonférence (cm)" unit="cm" placeholder="ex. 11,8" defaultValue={v.girth} helper="Mesurée au milieu, tour complet." />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block font-semibold mb-1.5">Courbure</span>
          <select name="curvature" value={curvature} onChange={(e) => setCurvature(e.target.value)} className="w-full px-4">
            <option value="none">Aucune</option>
            <option value="light">Légère</option>
            <option value="marked">Marquée</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="block font-semibold mb-1.5">Direction</span>
          <select name="direction" disabled={curvature === "none"} className="w-full px-4 disabled:opacity-50 disabled:bg-[var(--bm-gray-100)]">
            <option value="left">Gauche</option>
            <option value="right">Droite</option>
            <option value="up">Vers le haut</option>
            <option value="down">Vers le bas</option>
          </select>
        </label>
      </div>

      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="adult" className="mt-0.5 accent-[var(--accent)]" />
          <span>J&apos;ai 18 ans ou plus.</span>
        </label>
        {beta && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="consent" className="mt-0.5 accent-[var(--accent)]" />
            <span>
              Je consens au traitement des valeurs que je saisis (données sensibles, RGPD art. 9) pour calculer mon rapport, comme
              décrit dans la politique de confidentialité.
            </span>
          </label>
        )}
      </div>

      {state.error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-[var(--bm-error-soft)] px-4 py-3 text-sm font-medium" style={{ color: "var(--bm-error-text)" }} role="alert">
          <Icon name="info" size={18} className="mt-0.5 flex-none" />
          <span>{state.error}</span>
        </p>
      )}

      <div className="space-y-3">
        <button type="submit" className={`btn btn-primary btn-block ${pending ? "btn-loading" : ""}`} disabled={pending} aria-busy={pending}>
          <span>{pending ? "Calcul en cours…" : "Calculer mon rapport"}</span>
          {!pending && <Icon name="arrowRight" size={18} />}
        </button>
        <p className="t-small text-muted">
          {beta ? "Bêta gratuite : le rapport s'affiche immédiatement, sans paiement." : "Le questionnaire est gratuit ; le rapport calculé est ensuite verrouillé jusqu'au paiement."}
        </p>
      </div>
    </form>
  );
}
