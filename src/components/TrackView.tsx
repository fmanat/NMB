"use client";

import { useEffect, useRef } from "react";

// Signale une étape du parcours au serveur (mesure d'audience anonyme : aucun cookie, aucune adresse IP, aucun identifiant).
// `once` : ne l'envoie qu'une fois par onglet et par clé (sessionStorage), pour ne pas compter les rechargements.
export function TrackView({ event, once }: { event: "home_view" | "questionnaire_start" | "report_view" | "locked_preview"; once?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (once) {
      try {
        const key = `ev:${event}:${once}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        // stockage indisponible : on envoie quand même
      }
    }
    const body = JSON.stringify({ k: event });
    try {
      if (!navigator.sendBeacon?.("/api/e", new Blob([body], { type: "application/json" }))) throw new Error("beacon");
    } catch {
      fetch("/api/e", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit" }).catch(() => {});
    }
  }, [event, once]);
  return null;
}
