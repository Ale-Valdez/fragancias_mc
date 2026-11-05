import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

type Parser = {
  safeParse(data: unknown): { success: true; data: unknown } | { success: false };
};

export class AdminApiError extends Error {
  constructor(readonly status: number) {
    super("admin_api");
    this.name = "AdminApiError";
  }
}

/** GET autenticado a `/api/admin`. Sin sesión, vuelve al login. */
export async function adminJson(path: string, schema: Parser): Promise<unknown> {
  const session = (await cookies()).get("fmc_session");
  const cookieHeader = (await headers()).get("cookie");
  if (!session || !cookieHeader) redirect("/admin/login");

  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}/api/admin${path}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    throw new AdminApiError(0);
  }

  if (response.status === 401) redirect("/admin/login");
  if (!response.ok) throw new AdminApiError(response.status);

  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AdminApiError(500);
  return parsed.data;
}
