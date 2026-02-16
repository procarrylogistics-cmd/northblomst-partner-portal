// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // lasă public: homepage + auth
  if (path === "/" || path.startsWith("/auth")) return NextResponse.next();

  // protejăm orders (și orice altă pagină privată pe viitor)
  if (path.startsWith("/orders")) {
    const cookie = req.cookies.get("nb_partner_token")?.value;
    if (!cookie) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/orders/:path*"],
};
