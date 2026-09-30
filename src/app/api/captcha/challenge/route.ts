import { createChallenge } from "@/lib/captcha/altcha";
import { getCaptcha } from "@/lib/providers";

// Défi du captcha à preuve de travail. Sans objet (404) si un autre captcha est configuré ; jamais mis en cache.
export async function GET() {
  if (getCaptcha().id !== "altcha") return new Response(null, { status: 404 });
  try {
    return Response.json(createChallenge(), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ message: "Captcha indisponible." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
