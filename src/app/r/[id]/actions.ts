"use server";

import { redirect } from "next/navigation";
import { ChallengeError, createChallenge, withdraw } from "@/lib/challenge";
import { recordEvent } from "@/lib/funnel";
import { createCard, deleteCard, ShareError, type CardOptions } from "@/lib/share";

const back = (id: string, page: string, error?: string) => `/r/${id}/${page}${error ? `?erreur=${encodeURIComponent(error)}` : ""}`;

export async function createShareCard(reportId: string, fd: FormData): Promise<void> {
  const mode = String(fd.get("mode") ?? "score");
  const options: CardOptions = {
    mode: mode === "percentiles" || mode === "landmark" ? mode : "score",
    percentiles: (["length", "girth"] as const).filter((k) => fd.get(`p_${k}`) === "on"),
    landmark: String(fd.get("landmark") ?? ""),
  };
  let cardId: string;
  try {
    cardId = await createCard(reportId, options);
  } catch (e) {
    if (e instanceof ShareError) redirect(back(reportId, "partager", e.message));
    throw e;
  }
  await recordEvent("card_created");
  redirect(`/c/${cardId}`);
}

export async function removeShareCard(reportId: string, cardId: string): Promise<void> {
  await deleteCard(reportId, cardId);
  redirect(back(reportId, "partager"));
}

export async function startChallenge(reportId: string): Promise<void> {
  try {
    await createChallenge(reportId);
  } catch (e) {
    if (e instanceof ChallengeError) redirect(back(reportId, "defi", e.message));
    throw e;
  }
  redirect(back(reportId, "defi"));
}

export async function withdrawFromChallenge(reportId: string): Promise<void> {
  await withdraw(reportId);
  redirect(back(reportId, "defi"));
}
