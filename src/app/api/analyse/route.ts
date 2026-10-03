import { clientIp } from "@/lib/clientIp";
import { cookies } from "next/headers";
import { UPLOAD } from "@/config/site";
import { AGE_COOKIE, isAgeTokenValid } from "@/lib/age/token";
import { attachFriend, CHALLENGE_COOKIE } from "@/lib/challenge";
import { runAnalysis, type FlowInput } from "@/lib/analyseFlow";
import { isPhotoBeta } from "@/lib/mode";
import { getCaptcha, getScreening, getVision } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 180; // l'analyse par le modèle peut durer près d'une minute

const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").trim().replace(",", "."));
const checked = (v: FormDataEntryValue | null) => v === "on" || v === "true";

/**
 * Reçoit la photo (déjà réencodée par le navigateur), la traite en mémoire et répond en flux :
 * une ligne JSON par événement (étape réellement exécutée, refus, erreur, rapport prêt).
 * La photo n'est jamais écrite sur disque, en base ni dans les journaux.
 */
export async function POST(req: Request) {
  const declaredSize = Number(req.headers.get("content-length") ?? 0);
  if (declaredSize > UPLOAD.maxBytes + 200_000) {
    return Response.json({ type: "error", code: "image", message: "Image trop lourde (8 Mo maximum)." }, { status: 413 });
  }

  const fd = await req.formData();
  const file = fd.get("photo");
  const formula = fd.get("formula") === "C" ? "C" : "B";
  const state = fd.get("state") === "rest" ? "rest" : "erect";
  // Bêta photo : formule B seule, gratuite (rapport débloqué sans paiement) ; la formule C n'existe pas.
  const photoBeta = isPhotoBeta();
  if (photoBeta && formula === "C") return new Response(null, { status: 404 });

  const store = await cookies();
  const challengeId = store.get(CHALLENGE_COOKIE)?.value;
  const input: FlowInput = {
    formula,
    state,
    consents: { adult: checked(fd.get("consent_adult")), mine: checked(fd.get("consent_mine")), sensitive: checked(fd.get("consent_sensitive")) },
    ageTokenValid: isAgeTokenValid(store.get(AGE_COOKIE)?.value),
    captchaToken: typeof fd.get("captcha") === "string" ? (fd.get("captcha") as string) : null,
    ip: clientIp(req.headers),
    photo: file instanceof File && file.size > 0 && file.size <= UPLOAD.maxBytes ? Buffer.from(await file.arrayBuffer()) : null,
    declared:
      formula === "C"
        ? { length: num(fd.get("declared_length")), girth: num(fd.get("declared_girth")) }
        : undefined,
    freeBeta: photoBeta,
  };

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      let open = true;
      try {
        for await (const event of runAnalysis(input, { vision: getVision(), screening: getScreening(), captcha: getCaptcha() })) {
          if (event.type === "ready" && challengeId && !event.partial) await attachFriend(challengeId, event.reportId); // un rapport partiel ne relève pas un défi
          if (!open) continue; // le client est parti : on laisse le traitement se terminer (commentaire rédigé)
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            open = false;
          }
        }
      } catch {
        if (open) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify({ type: "error", code: "provider", message: "Erreur inattendue. Réessayez." }) + "\n"));
          } catch {
            /* ignoré */
          }
        }
      } finally {
        input.photo = null; // la mémoire de la photo est libérée
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
