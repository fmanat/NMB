// Exécuté UNE fois au démarrage de chaque instance du serveur Next.js (convention `instrumentation.ts`, voir node_modules/next/dist/docs).
// Journalise les avertissements de configuration de la formule photo : PHOTO_BETA=on refusée par le garde-fou de production,
// filtrage d'empreintes non configuré. Aucune donnée personnelle, aucun secret.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startupWarnings } = await import("./lib/photoBeta");
    for (const w of startupWarnings()) console.warn(JSON.stringify({ event: "startup_warning", message: w }));
    // Paiement Plisio configuré : diagnostic réseau en arrière-plan (ne retarde pas le démarrage).
    if ((process.env.PLISIO_SECRET_KEY ?? "").trim() !== "") {
      const { probePlisio } = await import("./lib/payments/plisioProbe");
      void probePlisio().catch(() => {});
    }
  }
}
