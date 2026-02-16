// app/auth/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing_token", url));
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: access, error } = await supabaseAdmin
    .from("partner_access_tokens")
    .select("partner_id, active")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (error || !access?.partner_id) {
    return NextResponse.redirect(new URL("/?error=invalid_token", url));
  }

  // set cookie (httpOnly) - nu se vede în browser JS
  const res = NextResponse.redirect(new URL("/orders", url));
  res.cookies.set("nb_partner_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 an
  });

  return res;
}
