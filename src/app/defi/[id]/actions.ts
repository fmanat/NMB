"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CHALLENGE_COOKIE, getInvite } from "@/lib/challenge";

/** Mémorise le défi pendant 24 h (durée de vie d'un rapport non payé) puis envoie vers le choix du protocole. */
export async function acceptChallenge(challengeId: string): Promise<void> {
  const invite = await getInvite(challengeId);
  if (!invite?.available) redirect(`/defi/${challengeId}`);
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, challengeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 3600,
    path: "/",
  });
  redirect("/analyse");
}
