import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminTokenValid } from "./admin/auth";
import { isPhotoAvailable, isPhotoPreview } from "./mode";
import { photoPreviewDecision } from "./photoBeta";

// Accès à la formule photo pour la requête en cours (pages et routes serveur) : bêta photo publique, ou aperçu réservé à une session
// d'administration (PHOTO_BETA=admin). Lit le cookie de session d'administration ; rend la page dynamique.

export async function hasAdminSession(): Promise<boolean> {
  return isAdminTokenValid((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function photoAccess(): Promise<{ available: boolean; preview: boolean }> {
  const admin = await hasAdminSession();
  return { available: isPhotoAvailable(admin), preview: isPhotoPreview(admin) };
}

/**
 * Aperçu administrateur (PHOTO_BETA=admin) SANS prestataire réel prêt : la session d'administration tient lieu de vérification d'âge.
 * Vrai seulement pour une session d'administration valide, en aperçu ; jamais pour le public.
 */
export async function adminPreviewBypassesAge(): Promise<boolean> {
  return isPhotoPreview(await hasAdminSession()) && !photoPreviewDecision().realAgeProvider;
}
