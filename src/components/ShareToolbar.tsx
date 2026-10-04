"use client";

import { useEffect, useState } from "react";
import { beacon, track } from "@/lib/track";
import { Icon } from "@/components/ui/Icon";

/**
 * Partage en un geste : partage natif du téléphone (si disponible), messageries, X, copie du lien et, pour une carte, image à télécharger.
 * Le lien partagé est public par construction (carte ou défi) : il ne révèle que ce que l'utilisateur a choisi. Aucun script tiers :
 * les boutons de messagerie sont de simples liens d'ouverture.
 */
export function ShareToolbar({ url, text, image, imageName, linkLabel = "Lien à partager", countShare = true }: { url: string; text: string; image?: string; imageName?: string; linkLabel?: string; countShare?: boolean }) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- détection d'une capacité du navigateur, connue seulement après le montage
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const shared = () => {
    track("share_click");
    if (countShare) beacon("share_click"); // compteur interne : partages de cartes seulement
  };
  const enc = encodeURIComponent;
  const links = [
    { name: "WhatsApp", href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { name: "X", href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}` },
  ];

  return (
    <div className="space-y-3" data-share-toolbar>
      {canShare && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={async () => {
            try {
              await navigator.share({ title: "Bitomètre", text, url });
              track("share_native");
              shared();
            } catch {
              // partage annulé : rien à faire
            }
          }}
        >
          <Icon name="share" size={18} />
          <span>Partager</span>
        </button>
      )}
      <div className="grid grid-cols-3 gap-2">
        {links.map((l) => (
          <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" onClick={shared} className="btn btn-secondary btn-sm !px-2">
            {l.name}
          </a>
        ))}
      </div>
      <div className="flex gap-2">
        <input readOnly aria-label={linkLabel} value={url} onFocus={(e) => e.currentTarget.select()} className="num flex-1 min-w-0 rounded-[10px] border border-border bg-background px-3 text-sm" />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              track("share_copy");
              shared();
            } catch {
              /* le lien reste sélectionnable à la main */
            }
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={16} />
          <span>{copied ? "Copié" : "Copier"}</span>
        </button>
        <span role="status" className="sr-only">{copied ? "Lien copié dans le presse-papiers" : ""}</span>
      </div>
      {image && (
        <a href={image} download={imageName} onClick={() => track("share_download")} className="btn btn-tertiary btn-sm w-full justify-center">
          <Icon name="download" size={16} />
          <span>Télécharger l&apos;image (format story)</span>
        </a>
      )}
    </div>
  );
}
