import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

const BEARER_SYNC_ROUTES = new Set([
  "/api/sync/workers",
  "/api/sync/admins",
  "/api/sync/worker-devices",
  "/api/sync/clock-ins",
  "/api/sync/heartbeat",
]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (BEARER_SYNC_ROUTES.has(pathname.replace(/\/$/, ""))) {
    return NextResponse.next();
  }

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|ico|webp)$).*)",
  ],
};
