import { AGE_TOKEN_MINUTES } from "@/config/site";
import { AGE_COOKIE, issueAgeToken } from "@/lib/age/token";
import { getAgeProvider } from "@/lib/providers";

// Retour du prestataire de vérification d'âge. Seule information utilisée : « majeur » ou non.
async function handle(req: Request) {
  let adult = false;
  let returnPath: string | undefined;
  try {
    ({ adult, returnPath } = await getAgeProvider().completeVerification(req));
  } catch {
    adult = false;
  }
  // Redirection limitée à l'écran d'envoi de photo : jamais d'adresse arbitraire.
  const target = returnPath && /^\/analyse\/photo\?f=[BC]$/.test(returnPath) ? returnPath : "/analyse/photo?f=B";
  const headers = new Headers({ location: adult ? target : "/verification-age?refus=1" });
  if (adult) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers.append("set-cookie", `${AGE_COOKIE}=${issueAgeToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AGE_TOKEN_MINUTES * 60}${secure}`);
  }
  return new Response(null, { status: 303, headers });
}

export const GET = handle;
export const POST = handle;
