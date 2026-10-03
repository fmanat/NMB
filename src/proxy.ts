import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminTokenValid } from "@/lib/admin/auth";
import { decideAccess } from "@/lib/siteGate";

// Voir src/lib/siteGate.ts pour les règles. Tourne avant chaque requête (pages, API, fichiers statiques).
export function proxy(request: NextRequest) {
  // Session d'administration : seule l'aperçu de la formule photo (PHOTO_BETA=admin) en dépend. Le proxy tourne en Node.js (Next 16).
  const adminSession = isAdminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value);
  const d = decideAccess(request.nextUrl.pathname, request.headers.get("authorization"), process.env, adminSession);
  switch (d.action) {
    case "unauthorized":
      return new NextResponse("Accès protégé : identifiants requis.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Bitometre (test)", charset="UTF-8"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
      });
    case "not_found":
      // Réécriture vers une page inexistante : même 404 que n'importe quelle adresse inconnue.
      return NextResponse.rewrite(new URL("/_introuvable", request.url), { status: 404 });
    default: {
      const res = NextResponse.next();
      if (d.protectedSite) res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  }
}

export const config = { matcher: "/:path*" };
