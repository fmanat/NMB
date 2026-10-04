"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AGE_GATE } from "@/config/site";
import { buttonClass, type ButtonVariant } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

// Première barrière d'âge. L'année reste sur cet appareil (localStorage) et n'est jamais envoyée.
// Elle ne remplace pas la vérification par prestataire exigée pour les formules photo (étape 3).
export function ScanButton({
  label = "Découvrir mon percentile",
  variant = "primary",
  fullOnMobile = false,
  small = false,
  className = "",
}: {
  label?: string;
  variant?: ButtonVariant;
  fullOnMobile?: boolean;
  small?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [year, setYear] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  // Le contenu de la fenêtre n'existe dans la page que lorsqu'elle est ouverte (une seule fenêtre à la fois, pas de champs cachés dans chaque page).
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => {
      setError("");
      setIsOpen(false);
    };
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  useEffect(() => {
    if (isOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isOpen]);

  function start() {
    try {
      if (localStorage.getItem(AGE_GATE.storageKey) === "1") {
        router.push("/analyse");
        return;
      }
    } catch {
      // stockage indisponible : on affiche la fenêtre
    }
    setIsOpen(true);
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
      <button type="button" className={buttonClass({ variant, fullOnMobile, small, className })} onClick={start}>
        <span>{label}</span>
        <Icon name="arrowRight" size={18} />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="age-gate-title"
        className="m-auto w-[min(92vw,26rem)] rounded-[18px] border border-border bg-surface text-foreground p-6 shadow-[var(--shadow-modal)] backdrop:bg-[rgba(16,33,63,0.45)]"
      >
        {isOpen && (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id="age-gate-title" className="t-h4">Contrôle d&apos;accès</h2>
            <button type="button" aria-label="Fermer" onClick={() => dialogRef.current?.close()} className="grid place-items-center size-11 -m-2 rounded-[10px] text-muted hover:bg-[var(--bm-gray-100)]">
              <Icon name="close" size={20} />
            </button>
          </div>
          <label className="block text-sm">
            <span className="font-medium">Année de naissance</span>
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="AAAA"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
              className="num mt-1.5 w-full px-3.5 text-lg"
            />
          </label>
          <p className="t-small text-muted">Votre année est stockée localement sur cet appareil et n&apos;est jamais transmise.</p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            <span>
              J&apos;ai 18 ans ou plus. Je comprends que l&apos;envoi de contenus impliquant des mineurs est un délit pénal.
            </span>
          </label>
          {error && <p className="text-sm font-medium" style={{ color: "var(--bm-error-text)" }} role="alert">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass({ variant: "secondary", small: true })}>
              Annuler
            </button>
            <button type="submit" className={buttonClass({ small: true })} disabled={!confirmed || year.length !== 4}>
              Continuer
            </button>
          </div>
        </form>
        )}
      </dialog>
    </>
  );
}
