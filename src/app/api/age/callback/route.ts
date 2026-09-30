import { AGE_TOKEN_MINUTES } from "@/config/site";
import { AGE_COOKIE, issueAgeToken } from "@/lib/age/token";
import { getAgeProvider } from "@/lib/providers";

// Retour du prestataire de vérification d'âge. Seule information utilisée : « majeur » ou non.
async function handle(req: Request) {
  let adult = false;
  try {
    adult = (await getAgeProvider().completeVerification(req)).adult;
  } catch {
    adult = false;
  }
  const headers = new Headers({ location: adult ? "/analyse/photo?f=B" : "/verification-age?refus=1" });
  if (adult) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers.append("set-cookie", `${AGE_COOKIE}=${issueAgeToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AGE_TOKEN_MINUTES * 60}${secure}`);
  }
  return new Response(null, { status: 303, headers });
}

export const GET = handle;
export const POST = handle;
