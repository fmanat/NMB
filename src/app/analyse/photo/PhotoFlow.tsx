"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GuidanceDiagram } from "@/components/GuidanceDiagram";
import { UPLOAD } from "@/config/site";
import { solveChallenge } from "@/lib/captcha/altchaClient";

const MAX_PX = UPLOAD.maxPx; // même taille que celle retenue par le serveur (voir docs/DECISIONS.md)
const field = "num mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-lg outline-none focus:border-accent";

type Step = { id: string; label: string; done: boolean };
type FlowEvent =
  | { type: "step"; id: string; label: string }
  | { type: "refused"; message: string }
  | { type: "error"; code: string; message: string }
  | { type: "ready"; reportId: string };

/**
 * Réencodage dans le navigateur avant envoi : JPEG, 1 600 px maximum, métadonnées supprimées
 * (le dessin sur canevas ne conserve ni EXIF ni position GPS). La photo n'est jamais stockée ; seule une vignette floutée
 * s'affiche dans le navigateur, à partir du fichier local.
 */
async function reencode(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_PX / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.88));
}


const ACCEPTED = ["image/jpeg", "image/png"];

/** Pictogrammes des consignes (traits simples, couleur du texte). */
function Icon({ name }: { name: "camera" | "erect" | "light" | "face" }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "camera")
    return (
      <svg {...common} width={40} height={40}>
        <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
    );
  if (name === "erect")
    return (
      <svg {...common}>
        <path d="M12 20V4M7 9l5-5 5 5" />
      </svg>
    );
  if (name === "light")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="9" r="4" />
      <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5M3 3l18 18" />
    </svg>
  );
}

export function PhotoFlow({ formula, captchaMode }: { formula: "B" | "C"; captchaMode: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<"rest" | "erect">("erect");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [message, setMessage] = useState<{ kind: "refused" | "error"; text: string } | null>(null);
  const [captchaOk, setCaptchaOk] = useState(false);

  // Vignette floutée, locale au navigateur : adresse « blob: » libérée au changement de photo et en quittant la page.
  const thumbRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current);
  }, []);

  function choose(f: File | undefined | null) {
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      setMessage({ kind: "error", text: "Format non pris en charge : choisissez une photo JPEG ou PNG." });
      return;
    }
    setMessage(null);
    if (thumbRef.current) URL.revokeObjectURL(thumbRef.current);
    thumbRef.current = URL.createObjectURL(f);
    setThumb(thumbRef.current);
    setFile(f);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!file) {
      setMessage({ kind: "error", text: "Choisissez une photo." });
      return;
    }
    // Une seule case à l'écran : elle vaut les trois consentements attendus par le serveur (majorité, photo de soi, analyse par xAI).
    if (fd.get("consent") === "on") for (const k of ["consent_adult", "consent_mine", "consent_sensitive"]) fd.set(k, "on");
    fd.delete("consent");
    setMessage(null);
    setSteps([]);
    setBusy(true);
    try {
      const blob = await reencode(file);
      fd.delete("photo");
      fd.set("photo", blob, "photo.jpg");
      fd.set("formula", formula);
      if (captchaMode === "simulation" && captchaOk) fd.set("captcha", "simulation-ok");
      if (captchaMode === "altcha") {
        // Captcha à preuve de travail : le navigateur résout un petit défi (quelques secondes au plus), sans tiers ni cookie.
        setSteps([{ id: "captcha", label: "Vérification anti-robot (calcul dans votre navigateur)", done: false }]);
        const challenge = await fetch("/api/captcha/challenge", { cache: "no-store" });
        if (!challenge.ok) {
          setMessage({ kind: "error", text: "La vérification anti-robot est indisponible. Réessayez dans un instant." });
          return;
        }
        fd.set("captcha", await solveChallenge(await challenge.json()));
        setSteps([]);
      }

      const res = await fetch("/api/analyse", { method: "POST", body: fd });
      if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null;
        setMessage({ kind: "error", text: j?.message ?? "Erreur d'envoi. Réessayez." });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as FlowEvent;
          if (ev.type === "step") {
            setSteps((s) => [...s.map((x) => ({ ...x, done: true })), { id: ev.id, label: ev.label, done: false }]);
          } else if (ev.type === "ready") {
            setSteps((s) => s.map((x) => ({ ...x, done: true })));
            router.push(`/r/${ev.reportId}`);
            return;
          } else if (ev.type === "refused") {
            setMessage({ kind: "refused", text: ev.message });
          } else if (ev.type === "error") {
            setMessage({ kind: "error", text: ev.message });
          }
        }
      }
    } catch {
      setMessage({ kind: "error", text: "Impossible de traiter cette image dans votre navigateur. Essayez une photo JPEG ou PNG." });
    } finally {
      setBusy(false);
    }
  }

  const stateBtn = (on: boolean) =>
    `flex-1 min-h-[48px] rounded-[10px] border px-3 text-[15px] font-semibold cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--accent)] ${
      on ? "border-[var(--accent)] bg-[var(--bm-blue-100)] text-[var(--accent)]" : "border-border bg-[var(--surface)] text-foreground"
    }`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Zone d'envoi : élément principal de la page. Sans attribut « capture » : le mobile propose appareil photo ou galerie. */}
      <div>
        <input
          ref={fileRef}
          id="photo-input"
          name="photo"
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          tabIndex={-1}
          aria-label="Photo (JPEG ou PNG)"
          onChange={(e) => choose(e.target.files?.[0])}
        />
        {file ? (
          <div className="flex items-center gap-4 rounded-[14px] border-2 border-[var(--accent)] bg-[var(--bm-blue-050)] p-4" data-photo-chosen>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[var(--bm-gray-200)]">
              {thumb && (
                // Vignette volontairement floutée : elle confirme le choix sans afficher la photo.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" aria-hidden className="h-full w-full scale-125 object-cover blur-md" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{file.name}</p>
              <p className="t-small text-muted">Photo prête pour l&apos;analyse</p>
            </div>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm shrink-0">Changer</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex w-full min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-[var(--accent)] bg-[var(--bm-blue-100)]" : "border-[var(--bm-blue-400)] bg-[var(--bm-blue-050)] hover:bg-[var(--bm-blue-100)]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              choose(e.dataTransfer.files?.[0]);
            }}
            data-photo-dropzone
          >
            <span className="text-[var(--accent)]"><Icon name="camera" /></span>
            <span className="text-lg font-semibold text-foreground">Prendre ou choisir une photo</span>
            <span className="t-small text-muted">
              <span className="hidden md:inline">ou glissez-la ici · </span>JPEG ou PNG
            </span>
          </button>
        )}
        <p className="mt-2 flex items-center justify-center gap-1.5 t-small text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Photo jamais stockée par Bitomètre
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 t-small font-semibold text-foreground">État</legend>
        <div className="flex gap-3">
          <label className={stateBtn(state === "rest")}>
            <input type="radio" name="state" value="rest" checked={state === "rest"} onChange={() => setState("rest")} className="sr-only" />
            <span className="flex h-full items-center justify-center">Au repos</span>
          </label>
          <label className={stateBtn(state === "erect")}>
            <input type="radio" name="state" value="erect" checked={state === "erect"} onChange={() => setState("erect")} className="sr-only" />
            <span className="flex h-full items-center justify-center">En érection</span>
          </label>
        </div>
        {state === "rest" && <p className="mt-2 t-small text-muted">Au repos, la longueur n&apos;est pas classée en percentile.</p>}
      </fieldset>

      <section aria-label="Consignes photo" className="space-y-3">
        <ul className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["erect", "En érection"],
              ["light", "Bien éclairé"],
              ["face", "Sans visage"],
            ] as const
          ).map(([icon, text]) => (
            <li key={icon} className="flex flex-col items-center gap-1.5 rounded-[10px] bg-[var(--bm-gray-100)] px-2 py-3 t-small text-foreground">
              <span className="text-[var(--accent)]"><Icon name={icon} /></span>
              {text}
            </li>
          ))}
        </ul>
        <p className="t-small text-muted">
          Facultatif : une carte au format bancaire posée à côté, verso visible, donne une mesure{" "}
          <span className="badge badge-success whitespace-nowrap">Taille calibrée</span>
        </p>
        <details className="t-small">
          <summary className="cursor-pointer text-[var(--accent)] underline">Voir les conseils</summary>
          <div className="mt-3 space-y-3">
            <GuidanceDiagram />
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>Photo en érection recommandée : elle permet une lecture complète des dimensions (au repos, la longueur n&apos;est pas positionnée par un percentile).</li>
              <li>
                Carte de référence : côté verso visible (numéros masqués), entière, avec ses 4 coins visibles, dans le même plan que le sujet.
              </li>
              <li>Vue de profil ou de dessus, bien éclairée, sujet entier et net.</li>
              <li>Aucun visage ni autre élément identifiant. La photo est réduite et nettoyée de ses métadonnées (position GPS comprise) dans votre navigateur avant l&apos;envoi.</li>
            </ul>
          </div>
        </details>
      </section>

      {formula === "C" && (
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-muted">Longueur déclarée (cm)</span>
            <input name="declared_length" inputMode="decimal" placeholder="ex. 13,5" required className={field} />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Circonférence déclarée (cm)</span>
            <input name="declared_girth" inputMode="decimal" placeholder="ex. 11,8" required className={field} />
          </label>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent" required className="mt-1 accent-[var(--accent)]" />
          <span>J&apos;ai 18 ans ou plus, cette photo est de moi, et j&apos;accepte son analyse par notre prestataire (xAI), qui la conserve 30 jours.</span>
        </label>
        {captchaMode === "simulation" && (
          <label className="flex items-start gap-2 text-muted">
            <input type="checkbox" checked={captchaOk} onChange={(e) => setCaptchaOk(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
            <span>Je ne suis pas un robot (captcha simulé, développement uniquement).</span>
          </label>
        )}
      </div>

      {message && (
        <p role="alert" className={`text-sm ${message.kind === "refused" ? "text-foreground panel p-4" : "text-[var(--bm-error-text)]"}`}>
          {message.text}
          {message.kind === "refused" && <span className="block text-muted mt-1">Aucun paiement n&apos;est demandé. Vous pouvez reprendre la photo et réessayer.</span>}
        </p>
      )}

      {steps.length > 0 && (
        <ol className="panel p-4 space-y-2 text-sm" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className={s.done ? "text-accent" : "text-accent-2 animate-pulse"}>{s.done ? "✓" : "●"}</span>
              <span className={s.done ? "text-muted" : ""}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Bouton toujours visible en bas de l'écran sur mobile (collant), à sa place sur ordinateur. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-[var(--background)] px-4 min-[390px]:-mx-5 min-[390px]:px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:border-0 md:p-0">
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || (captchaMode === "simulation" && !captchaOk)}>
          {busy ? "Analyse en cours…" : "Lancer l'analyse"}
        </button>
        {busy && <p className="mt-2 text-xs text-muted">L&apos;analyse prend en général moins d&apos;une minute. Ne fermez pas cette page.</p>}
      </div>
    </form>
  );
}
