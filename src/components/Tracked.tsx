"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { beacon, track, type BeaconKind, type TrackEvent } from "@/lib/track";

/** Lien qui signale son clic (Umami et, si indiqué, compteur interne) avant de naviguer. */
export function TrackedLink({
  href,
  event,
  kind,
  className,
  children,
  ...rest
}: { href: string; event: TrackEvent; kind?: BeaconKind; className?: string; children: ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        track(event);
        if (kind) beacon(kind);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}

/** Signale un événement Umami une fois à l'affichage (par onglet et par clé si `once` est fourni). */
export function TrackOnView({ event, once }: { event: TrackEvent; once?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (once) {
      try {
        const key = `tr:${event}:${once}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // stockage indisponible : on envoie quand même
      }
    }
    track(event);
  }, [event, once]);
  return null;
}
