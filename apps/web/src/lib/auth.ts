import { authUserSchema, type AuthUser } from "@fmc/shared";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/** Usuario de la cookie `fmc_session`, o null si no hay sesión válida. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = (await cookies()).get("fmc_session");
  if (!session) return null;

  const cookieHeader = (await headers()).get("cookie");
  if (!cookieHeader) return null;

  try {
    const response = await fetch(`${API_INTERNAL_URL}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    const parsed = authUserSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
});

/** Sesión obligatoria. Sin usuario, vuelve al login. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}
