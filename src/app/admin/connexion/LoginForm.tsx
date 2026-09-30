"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="panel p-5 space-y-4">
      <label className="block text-sm">
        <span className="text-muted">Mot de passe</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-lg outline-none focus:border-accent"
        />
      </label>
      {state.error && <p className="text-sm text-accent-2" role="alert">{state.error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Vérification…" : "Se connecter"}
      </button>
    </form>
  );
}
