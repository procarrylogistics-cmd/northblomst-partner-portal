// app/orders/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Partner = {
  id: string;
  name: string | null;
  email: string | null;
  trackpod_shipper_name: string | null;
  pickup_address_line1: string | null;
  pickup_postal_code: string | null;
  pickup_city: string | null;
};

type PartnerAccessToken = {
  partner_id: string;
  token: string;
  active: boolean;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main style={{ padding: 24, color: "white" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Orders</h1>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Missing token. Please use the link you received.
        </p>
      </main>
    );
  }

  // 1) Find partner_id by token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("partner_access_tokens")
    .select("partner_id, token, active")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle<PartnerAccessToken>();

  if (tokenErr) {
    return (
      <main style={{ padding: 24, color: "white" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Orders</h1>
        <p style={{ marginTop: 10, color: "#ff7777" }}>
          Token lookup error: {tokenErr.message}
        </p>
      </main>
    );
  }

  if (!tokenRow) {
    return (
      <main style={{ padding: 24, color: "white" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Orders</h1>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Invalid or inactive token.
        </p>
      </main>
    );
  }

  const partnerId = tokenRow.partner_id;

  // 2) Load partner
  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select(
      "id,name,email,trackpod_shipper_name,pickup_address_line1,pickup_postal_code,pickup_city"
    )
    .eq("id", partnerId)
    .maybeSingle<Partner>();

  if (partnerErr) {
    return (
      <main style={{ padding: 24, color: "white" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Orders</h1>
        <p style={{ marginTop: 10, color: "#ff7777" }}>
          Partner load error: {partnerErr.message}
        </p>
      </main>
    );
  }

  if (!partner) {
    return (
      <main style={{ padding: 24, color: "white" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Orders</h1>
        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Partner not found for this token.
        </p>
      </main>
    );
  }

  // NOTE:
  // We haven't built orders table usage yet.
  // For now, we show a placeholder "Orders will appear here".
  return (
    <main style={{ padding: 24, color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Orders</h1>
        <Link
          href={`/?token=${encodeURIComponent(token)}`}
          style={{
            marginLeft: "auto",
            color: "white",
            opacity: 0.85,
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontWeight: 700 }}>{partner.name ?? "Partner"}</div>
        <div style={{ opacity: 0.85, marginTop: 6 }}>
          {partner.email ?? ""}
        </div>
        <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
          {partner.trackpod_shipper_name ?? ""}
        </div>
        <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>
          {partner.pickup_address_line1 ?? ""},{" "}
          {partner.pickup_postal_code ?? ""} {partner.pickup_city ?? ""}
        </div>
      </div>

      <div style={{ marginTop: 18, opacity: 0.8 }}>
        Orders will appear here (next step: connect Shopify → Supabase orders).
      </div>
    </main>
  );
}
