import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fmc_session";

/**
 * Corte optimista: sin cookie no se llega a renderizar el panel.
 * Una cookie presente igual se valida en el layout contra `/api/auth/me`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) return NextResponse.next();

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
