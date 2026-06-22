import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 : ex-"middleware". Contrôle optimiste (présence du cookie bc_session) ;
// la vérification réelle (signature HMAC + apps[]) se fait côté page/route
// via getSession() — cf. src/lib/auth.ts.
// Si le cookie est absent, l'utilisateur est redirigé vers le hub SSO.

const BC_SESSION = "bc_session";
const OPEN = ["/api/auth", "/api/cron", "/api/justificatifs"];
const HUB_URL = process.env.HUB_URL ?? "https://hub.bleucitron.app";

function publicOrigin(req: NextRequest): string {
  const fwd = (req.headers.get("x-forwarded-host") ?? "").split(",")[0].trim();
  const raw = (fwd || req.headers.get("host") || "").toLowerCase();
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return raw ? `${proto}://${raw}` : req.nextUrl.origin;
}

export function proxy(req: NextRequest) {
  if (!process.env.SSO_SECRET) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!req.cookies.has(BC_SESSION)) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const from = encodeURIComponent(`${publicOrigin(req)}${pathname}`);
    return NextResponse.redirect(`${HUB_URL}?from=${from}`);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
