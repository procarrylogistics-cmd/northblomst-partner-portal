// app/orders/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import OrdersTable from "./OrdersTable.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRole);

type OrderRow = {
  id: string;
  shopify_order_number: string | null;
  partner_status: string | null;
  delivery_postal_code: string | null;
  created_at: string | null;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { token?: string; days?: string };
}) {
  const token = (searchParams?.token ?? "").trim();
  const days = Number(searchParams?.days ?? "7");

  if (!token) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Orders</h1>
        <p>Missing token.</p>
      </main>
    );
  }

  // 🔐 1) validate token
  const { data: tokenRow } = await supabase
    .from("partner_access_tokens")
    .select("partner_id")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (!tokenRow?.partner_id) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Orders</h1>
        <p>Invalid token.</p>
      </main>
    );
  }

  const partnerId = tokenRow.partner_id;

  // 👤 2) load partner
  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,email,pickup_address_line1,pickup_postal_code")
    .eq("id", partnerId)
    .maybeSingle();

  // 📅 3) days filter
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, shopify_order_number, partner_status, delivery_postal_code, created_at"
    )
    .eq("partner_id", partnerId)
    .gte("created_at", fromDate.toISOString())
    .order("created_at", { ascending: false });

  const rows = (orders ?? []) as OrderRow[];

  return (
    <main style={{ padding: 40 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link
          href={`/?token=${encodeURIComponent(token)}`}
          style={{ textDecoration: "none" }}
        >
          ← Back
        </Link>
        <h1 style={{ margin: 0 }}>Orders</h1>
      </div>

      {/* Partner card */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          maxWidth: 900,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 20 }}>
          {partner?.name}
        </div>
        <div style={{ opacity: 0.8 }}>{partner?.email}</div>
        <div style={{ opacity: 0.8 }}>
          {partner?.pickup_address_line1},{" "}
          {partner?.pickup_postal_code}
        </div>
      </div>

      {/* Days filter */}
      <div style={{ marginTop: 20 }}>
        {[1, 3, 7, 14, 30].map((d) => (
          <Link
            key={d}
            href={`/orders?token=${encodeURIComponent(
              token
            )}&days=${d}`}
            style={{
              marginRight: 10,
              padding: "6px 12px",
              borderRadius: 8,
              border:
                d === days
                  ? "1px solid white"
                  : "1px solid rgba(255,255,255,0.2)",
              textDecoration: "none",
            }}
          >
            {d}d
          </Link>
        ))}
      </div>

      <OrdersTable orders={rows} token={token} />

      <div style={{ marginTop: 14, opacity: 0.7 }}>
        Showing {rows.length} order(s).
      </div>
    </main>
  );
}
