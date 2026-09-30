"use client";

import { useActionState, useState } from "react";
import { submitQuestionnaire, type FormState } from "./actions";

const field = "num mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-lg outline-none focus:border-accent";

export function QuestionnaireForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(submitQuestionnaire, {});
  const [curvature, setCurvature] = useState("none");
  const v = state.values ?? {};

  return (
    <form action={action} className="panel p-5 space-y-5">
      <fieldset key={"s" + v.state} className="space-y-2">
        <legend className="text-sm text-muted">État</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="state" value="rest" defaultChecked={v.state !== "erect"} className="accent-[var(--accent)]" /> Au repos</label>
          <label className="flex items-center gap-2"><input type="radio" name="state" value="erect" defaultChecked={v.state === "erect"} className="accent-[var(--accent)]" /> En érection</label>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-muted">Longueur (cm)</span>
          <input name="length" defaultValue={v.length} key={"l" + v.length} inputMode="decimal" placeholder="ex. 13,5" required className={field} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Circonférence (cm)</span>
          <input name="girth" defaultValue={v.girth} key={"g" + v.girth} inputMode="decimal" placeholder="ex. 11,8" required className={field} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          <span className="text-muted">Courbure</span>
          <select name="curvature" value={curvature} onChange={(e) => setCurvature(e.target.value)} className={field}>
            <option value="none">Aucune</option>
            <option value="light">Légère</option>
            <option value="marked">Marquée</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Direction</span>
          <select name="direction" disabled={curvature === "none"} className={field + " disabled:opacity-40"}>
            <option value="left">Gauche</option>
            <option value="right">Droite</option>
            <option value="up">Vers le haut</option>
            <option value="down">Vers le bas</option>
          </select>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="adult" className="mt-1 accent-[var(--accent)]" />
        <span>J&apos;ai 18 ans ou plus.</span>
      </label>

      {state.error && <p className="text-sm text-accent-2" role="alert">{state.error}</p>}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Calcul en cours…" : "Calculer mon rapport"}
      </button>
      <p className="text-xs text-muted">
        Le questionnaire est gratuit ; le rapport calculé est ensuite verrouillé jusqu&apos;au paiement.
      </p>
    </form>
  );
}
