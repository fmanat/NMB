"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_TOKEN_MINUTES } from "@/config/site";
import { AGE_COOKIE, issueAgeToken } from "@/lib/age/token";
import { adminPreviewBypassesAge } from "@/lib/photoAccess";
import { getAgeProvider } from "@/lib/providers";

const safeReturn = (f: string) => `/analyse/photo?f=${f === "C" ? "C" : "B"}`;

async function setAgeCookie(): Promise<void> {
  const store = await cookies();
  store.set(AGE_COOKIE, issueAgeToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AGE_TOKEN_MINUTES * 60,
    path: "/",
  });
}

export async function startAgeVerification(formula: string): Promise<void> {
  if (await adminPreviewBypassesAge()) {
    await setAgeCookie();
    redirect(safeReturn(formula));
  }
  const { redirectUrl } = await getAgeProvider().startVerification({ returnUrl: safeReturn(formula) });
  redirect(redirectUrl);
}

/** Mode simulation uniquement : joue le rôle du prestataire et délivre le jeton « majeur : oui ». */
export async function simulateAgeSuccess(returnPath: string): Promise<void> {
  if (getAgeProvider().id !== "simulation") throw new Error("Simulation désactivée");
  await setAgeCookie();
  // Redirection limitée à l'écran d'envoi : jamais d'adresse arbitraire.
  redirect(/^\/analyse\/photo\?f=[BC]$/.test(returnPath) ? returnPath : safeReturn("B"));
}
