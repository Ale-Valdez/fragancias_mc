export type AdminIssue = {
  path: string;
  message: string;
};

type MutateResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; issues: AdminIssue[]; error: string | null };

function readIssues(body: unknown): AdminIssue[] {
  if (!body || typeof body !== "object" || !("issues" in body)) return [];
  const issues = body.issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];
    const path = "path" in issue && typeof issue.path === "string" ? issue.path : "";
    const message = "message" in issue && typeof issue.message === "string" ? issue.message : "";
    return path || message ? [{ path, message }] : [];
  });
}

function readError(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  return typeof body.error === "string" ? body.error : null;
}

/** Mutación autenticada a `/api/admin` a través del rewrite de Next. */
export async function adminMutate(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<MutateResult> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  try {
    const response = await fetch(`/api/admin${path}`, {
      method,
      credentials: "include",
      headers: body === undefined || isForm ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });

    if (response.status === 401) {
      return { ok: false, status: 401, issues: [], error: "unauthorized" };
    }

    const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        issues: readIssues(payload),
        error: readError(payload),
      };
    }
    return { ok: true, status: response.status, body: payload };
  } catch {
    return { ok: false, status: 0, issues: [], error: "network" };
  }
}
