"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AGE_GATE } from "@/config/site";

// Première barrière d'âge. L'année reste sur cet appareil (localStorage) et n'est jamais envoyée.
// Elle ne remplace pas la vérification par prestataire exigée pour les formules photo (étape 3).
export function ScanButton({ label = "Lancer l'analyse" }: { label?: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [year, setYear] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => setError("");
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  function start() {
    try {
      if (localStorage.getItem(AGE_GATE.storageKey) === "1") {
        router.push("/analyse");
        return;
      }
    } catch {
      // stockage indisponible : on affiche la fenêtre
    }
    dialogRef.current?.showModal();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const y = Number(year);
    const now = new Date().getFullYear();
    if (!/^\d{4}$/.test(year) || y < 1900 || y > now) {
      setError("Saisissez une année valide au format AAAA.");
      return;
    }
    if (now - y < AGE_GATE.minAge) {
      setError("Ce service est réservé aux personnes majeures.");
      return;
    }
    try {
      localStorage.setItem(AGE_GATE.storageKey, "1");
    } catch {
      // sans stockage, la fenêtre s'affichera à nouveau la prochaine fois
    }
    dialogRef.current?.close();
    router.push("/analyse");
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={start}>
        {label}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(92vw,26rem)] rounded-xl border border-border bg-surface text-foreground p-6 backdrop:bg-black/70"
      >
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-lg font-semibold">Contrôle d&apos;accès</h2>
          <label className="block text-sm">
            <span className="text-muted">Année de naissance</span>
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="AAAA"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
              className="num mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-lg outline-none focus:border-accent"
            />
          </label>
          <p className="text-xs text-muted">
            Votre année est stockée localement sur cet appareil et n&apos;est jamais transmise.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              J&apos;ai 18 ans ou plus. Je comprends que l&apos;envoi de contenus impliquant des mineurs est un
              délit pénal.
            </span>
          </label>
          {error && <p className="text-sm text-accent-2">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={!confirmed || year.length !== 4}>
              Continuer
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
