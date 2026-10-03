"use server";

import { clientIp } from "@/lib/clientIp";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN } from "@/config/site";
import { ADMIN_COOKIE, adminConfigured, issueAdminToken, loginLimiter, verifyPassword } from "@/lib/admin/auth";
import { hashIp } from "@/lib/repo";

export type LoginState = { error?: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  if (!adminConfigured()) return { error: "L'administration n'est pas configurée (voir .env.example : ADMIN_PASSWORD_HASH et ADMIN_SESSION_SECRET)." };

  const h = await headers();
  const ip = clientIp(h);
  const key = hashIp(ip);
  if (loginLimiter.isBlocked(key)) return { error: `Trop de tentatives. Réessayez dans ${ADMIN.windowMinutes} minutes.` };

  const password = String(fd.get("password") ?? "");
  if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)) {
    loginLimiter.registerFailure(key);
    await wait(800); // ralentit les essais successifs
    return { error: "Mot de passe incorrect." };
  }

  loginLimiter.reset(key);
  (await cookies()).set(ADMIN_COOKIE, issueAdminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN.sessionHours * 3600,
    // Tout le site (et non plus /admin seulement) : l'aperçu de la formule photo (PHOTO_BETA=admin) lit cette session sur ses pages.
    path: "/",
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/" });
  redirect("/admin/connexion");
}
