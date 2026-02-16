import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// IMPORTANT: if you had a matcher before, keep it simple.
// You can even delete config completely, but this is safe:
export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
