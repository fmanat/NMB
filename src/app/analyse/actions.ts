"use server";

import { clientIp } from "@/lib/clientIp";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { RATE_LIMIT } from "@/config/site";
import { recordEvent } from "@/lib/funnel";
import { isFreeBeta } from "@/lib/mode";
import { attachFriend, CHALLENGE_COOKIE } from "@/lib/challenge";
import { buildQuestionnaireReport, isOutOfReferenceRange, questionnaireSchema } from "@/lib/report";
import { countRecentByIp, createReport, hashIp } from "@/lib/repo";

export type FormState = { error?: string; values?: Record<string, string> };

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").trim().replace(",", "."));

export async function submitQuestionnaire(_prev: FormState, fd: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const k of ["state", "length", "girth", "curvature", "direction"]) values[k] = String(fd.get(k) ?? "");
  if (fd.get("adult") !== "on") return { error: "Vous devez confirmer avoir 18 ans ou plus.", values };
  // Bêta gratuite : consentement explicite (RGPD, art. 9) au traitement des valeurs saisies, mentionné dans la politique de confidentialité.
  if (isFreeBeta() && fd.get("consent") !== "on") return { error: "Vous devez consentir au traitement des valeurs saisies pour obtenir votre rapport.", values };

  const parsed = questionnaireSchema.safeParse({
    state: fd.get("state"),
    length: num(fd.get("length")),
    girth: num(fd.get("girth")),
    curvature: fd.get("curvature"),
    direction: fd.get("curvature") === "none" ? "none" : fd.get("direction"),
  });
  if (!parsed.success) {
    return { error: "Vérifiez les valeurs saisies : longueur et circonférence en centimètres, dans des plages plausibles.", values };
  }

  if (isOutOfReferenceRange(parsed.data)) {
    return {
      error: "Une des valeurs saisies sort de la plage que ce protocole peut traiter. Vérifiez votre mesure (en centimètres, état correctement indiqué) et réessayez.",
      values,
    };
  }

  const h = await headers();
  const ip = clientIp(h);
  const ipHash = hashIp(ip);
  if ((await countRecentByIp(ipHash)) >= RATE_LIMIT.maxPerWindow) {
    return { error: `Limite atteinte : ${RATE_LIMIT.maxPerWindow} analyses par période de ${RATE_LIMIT.windowHours} h.`, values };
  }

  const id = await createReport({
    formula: "A",
    input: parsed.data,
    results: buildQuestionnaireReport(parsed.data),
    ipHash,
    freeBeta: isFreeBeta(), // bêta gratuite : rapport débloqué sans paiement
  });
  await recordEvent("questionnaire_done");
  const challenge = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (challenge) await attachFriend(challenge, id); // défi d'un ami : le rapport devient celui de l'ami
  redirect(`/r/${id}`);
}
