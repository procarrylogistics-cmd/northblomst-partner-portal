import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

type Partner = {
  id: string;
  name: string;
  email: string;
  trackpod_shipper_name: string;
  pickup_address_line1: string;
  pickup_postal_code: string;
};

export default async function Home({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  if (!token) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Northblomst Partner Portal</h1>
        <p>Access denied</p>
      </main>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 🔹 1. Validăm token
  const { data: tokenRow } = await supabase
    .from("partner_access_tokens")
    .select("partner_id")
    .eq("token", token)
    .eq("active", true)
    .single();

  if (!tokenRow) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Northblomst Partner Portal</h1>
        <p>Invalid or expired token</p>
      </main>
    );
  }

  // 🔹 2. Luăm partenerul corect
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", tokenRow.partner_id)
    .single();

  if (!partner) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Northblomst Partner Portal</h1>
        <p>No partner found</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>Northblomst Partner Portal</h1>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18 }}>
          {partner.name}
        </div>

        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {partner.email}
        </div>

        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {partner.pickup_address_line1}, {partner.pickup_postal_code}
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
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Open Orders →
        </Link>
      </div>
    </main>
  );
}
