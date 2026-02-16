// app/orders/page.tsx
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

type OrderRow = {
  id: string;
  order_no: string | null;
  status: string | null;
  delivery_name: string | null;
  delivery_address_line1: string | null;
  delivery_postal_code: string | null;
  delivery_city: string | null;
  delivery_time_from: string | null;
  delivery_time_to: string | null;
  created_at: string | null;
};

export const dynamic = "force-dynamic";

function AdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function OrdersPage() {
  const token = cookies().get("nb_partner_token")?.value;

  if (!token) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Northblomst Partner Portal</h1>
        <p style={{ opacity: 0.8 }}>
          Missing access token. Please open your partner link again.
        </p>
      </main>
    );
  }

  const supabase = AdminSupabase();

  // 1) Validate token -> partner_id
  const { data: access, error: accessErr } = await supabase
    .from("partner_access_tokens")
    .select("partner_id, active")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (accessErr || !access?.partner_id) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Northblomst Partner Portal</h1>
        <p style={{ color: "#ff6b6b" }}>
          Invalid token or inactive access. Please contact support.
        </p>
      </main>
    );
  }

  const partnerId = access.partner_id as string;

  // 2) Load partner info (optional, but nice)
  const { data: partner } = await supabase
    .from("partners")
    .select("name, email, trackpod_shipper_name, pickup_address_line1, pickup_postal_code, pickup_city")
    .eq("id", partnerId)
    .maybeSingle();

  // 3) Fetch ONLY this partner's orders
  // IMPORTANT: This assumes orders table has column `partner_id` (uuid)
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select(
      "id, order_no, status, delivery_name, delivery_address_line1, delivery_postal_code, delivery_city, delivery_time_from, delivery_time_to, created_at"
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (ordersErr) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1>Northblomst Partner Portal</h1>
        <p style={{ color: "#ff6b6b" }}>
          Could not load orders for this partner.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", opacity: 0.8 }}>
          {ordersErr.message}
        </pre>
        <p style={{ opacity: 0.8 }}>
          If your <b>orders</b> table does not have <code>partner_id</code>, tell me and we switch filter logic.
        </p>
      </main>
    );
  }

  const list = (orders ?? []) as OrderRow[];

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Orders</h1>
        <span style={{ opacity: 0.7 }}>
          {partner?.name ? `for ${partner.name}` : ""}
        </span>
      </div>

      <div style={{ marginTop: 10, opacity: 0.85 }}>
        <div>
          <b>Shipper:</b> {partner?.trackpod_shipper_name ?? "-"}
        </div>
        <div>
          <b>Pickup:</b>{" "}
          {[
            partner?.pickup_address_line1,
            partner?.pickup_postal_code,
            partner?.pickup_city,
          ]
            .filter(Boolean)
            .join(", ") || "-"}
        </div>
      </div>

      <div style={{ marginTop: 18, opacity: 0.8 }}>
        Showing last {list.length} orders
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {list.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.8 }}>
            No orders yet for this partner.
          </div>
        ) : (
          list.map((o) => (
            <div
              key={o.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>
                  {o.order_no ? `Order #${o.order_no}` : "Order"}
                </div>
                <div style={{ opacity: 0.8 }}>{o.status ?? "pending"}</div>
              </div>

              <div style={{ marginTop: 6, opacity: 0.9 }}>
                {o.delivery_name ?? "-"}
              </div>

              <div style={{ marginTop: 4, opacity: 0.8 }}>
                {[o.delivery_address_line1, o.delivery_postal_code, o.delivery_city]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </div>

              <div style={{ marginTop: 6, opacity: 0.75 }}>
                Time: {o.delivery_time_from ?? "-"} → {o.delivery_time_to ?? "-"}
              </div>

              <div style={{ marginTop: 4, opacity: 0.6, fontSize: 12 }}>
                Created: {o.created_at ?? "-"}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
