"use client";

import { useRef, useState } from "react";
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
 * (le dessin sur canevas ne conserve ni EXIF ni position GPS). La photo n'est jamais affichée ni stockée.
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

export function PhotoFlow({ formula, captchaMode }: { formula: "B" | "C"; captchaMode: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [message, setMessage] = useState<{ kind: "refused" | "error"; text: string } | null>(null);
  const [captchaOk, setCaptchaOk] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ kind: "error", text: "Choisissez une photo." });
      return;
    }
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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">Consignes photo</h2>
        <GuidanceDiagram />
        <ul className="text-sm text-muted list-disc pl-5 space-y-1">
          <li>Une carte au format bancaire posée à côté, côté verso visible (numéros masqués), entière, avec ses 4 coins visibles.</li>
          <li>Vue de profil ou de dessus, bien éclairée, sujet et carte dans le même plan.</li>
          <li>Aucun visage ni autre élément identifiant.</li>
        </ul>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">État</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="state" value="rest" className="accent-[var(--accent)]" /> Au repos</label>
          <label className="flex items-center gap-2"><input type="radio" name="state" value="erect" defaultChecked className="accent-[var(--accent)]" /> En érection</label>
        </div>
      </fieldset>

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

      <label className="block text-sm">
        <span className="text-muted">Photo (JPEG ou PNG)</span>
        <input ref={fileRef} name="photo" type="file" accept="image/jpeg,image/png" required className="mt-1 block w-full text-sm" />
      </label>
      <p className="text-xs text-muted">
        La photo est réduite et nettoyée de ses métadonnées (position GPS comprise) dans votre navigateur avant l&apos;envoi. Elle
        n&apos;est affichée nulle part et jamais stockée par Bitomètre.
      </p>

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_adult" required className="mt-1 accent-[var(--accent)]" /><span>J&apos;ai 18 ans ou plus.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" name="consent_mine" required className="mt-1 accent-[var(--accent)]" /><span>Cette photo est de moi.</span></label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="consent_sensitive" required className="mt-1 accent-[var(--accent)]" />
          <span>
            Je consens au traitement de cette donnée sensible pour l&apos;analyse, et à son envoi à un prestataire situé aux États-Unis
            (SpaceXAI LLC, connue sous le nom xAI) qui la conserve 30 jours pour détecter les abus, sans l&apos;utiliser pour l&apos;entraînement.
          </span>
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

      <button type="submit" className="btn btn-primary btn-block-mobile" disabled={busy || (captchaMode === "simulation" && !captchaOk)}>
        {busy ? "Analyse en cours…" : "Lancer l'analyse"}
      </button>
      {busy && <p className="text-xs text-muted">L&apos;analyse dure en général de 15 à 45 secondes. Ne fermez pas cette page.</p>}
    </form>
  );
}
