"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly aria-label="Lien du défi à envoyer à votre ami" value={url} onFocus={(e) => e.currentTarget.select()} className="num flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            /* le lien reste sélectionnable à la main */
          }
        }}
      >
        {copied ? "Copié" : "Copier"}
      </button>
      <span role="status" className="sr-only">{copied ? "Lien copié dans le presse-papiers" : ""}</span>
    </div>
  );
}
