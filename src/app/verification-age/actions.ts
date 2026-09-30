"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_TOKEN_MINUTES } from "@/config/site";
import { AGE_COOKIE, issueAgeToken } from "@/lib/age/token";
import { getAgeProvider } from "@/lib/providers";

const safeReturn = (f: string) => `/analyse/photo?f=${f === "C" ? "C" : "B"}`;

export async function startAgeVerification(formula: string): Promise<void> {
  const { redirectUrl } = await getAgeProvider().startVerification({ returnUrl: safeReturn(formula) });
  redirect(redirectUrl);
}

/** Mode simulation uniquement : joue le rôle du prestataire et délivre le jeton « majeur : oui ». */
export async function simulateAgeSuccess(returnPath: string): Promise<void> {
  if (getAgeProvider().id !== "simulation") throw new Error("Simulation désactivée");
  const store = await cookies();
  store.set(AGE_COOKIE, issueAgeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AGE_TOKEN_MINUTES * 60,
    path: "/",
  });
  // Redirection limitée à l'écran d'envoi : jamais d'adresse arbitraire.
  redirect(/^\/analyse\/photo\?f=[BC]$/.test(returnPath) ? returnPath : safeReturn("B"));
}
