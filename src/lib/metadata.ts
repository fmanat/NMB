// Pages privées (rapport, paiement) : image Open Graph neutre, jamais de score ni de donnée personnelle.
export const PRIVATE_SOCIAL = {
  openGraph: { images: [{ url: "/og/neutre", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" as const, images: ["/og/neutre"] },
};
