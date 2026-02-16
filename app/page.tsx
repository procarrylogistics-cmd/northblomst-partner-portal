import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = (searchParams?.token ?? "").trim();


  if (!token) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Northblomst Partner Portal</h1>
        <p>Missing token. Please use the link you received.</p>
      </main>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tokenRow, error: tokenErr } = await supabase
    .from("partner_access_tokens")
    .select("partner_id")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (tokenErr || !tokenRow?.partner_id) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Northblomst Partner Portal</h1>
        <p>Invalid or revoked token.</p>
      </main>
    );
  }

  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("id,name,email,pickup_address_line1,pickup_postal_code,pickup_city,trackpod_shipper_name")
    .eq("id", tokenRow.partner_id)
    .maybeSingle();

  if (partnerErr || !partner?.id) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Northblomst Partner Portal</h1>
        <p>Partner not found.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Northblomst Partner Portal</h1>

      <div style={{ marginTop: 20, padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, maxWidth: 720 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{partner.name ?? "Partner"}</div>
        <div style={{ marginTop: 6, opacity: 0.85 }}>{partner.email ?? ""}</div>
        <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{partner.trackpod_shipper_name ?? ""}</div>
        <div style={{ marginTop: 6, opacity: 0.75 }}>
          {partner.pickup_address_line1 ?? ""}, {partner.pickup_postal_code ?? ""} {partner.pickup_city ?? ""}
        </div>

        <Link
          href={`/orders?token=${encodeURIComponent(token)}`}
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "8px 16px",
            background: "white",
            color: "black",
            borderRadius: 8,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Open Orders →
        </Link>
      </div>
    </main>
  );
}
