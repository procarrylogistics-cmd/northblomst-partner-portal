import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = (searchParams?.token ?? "").trim();

  if (!token) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Orders</h1>
        <p>Missing token. Please use the link you received.</p>
      </main>
    );
  }

  // SERVER SIDE ONLY (service role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1) validate token -> partner_id
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("partner_access_tokens")
    .select("partner_id")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (tokenErr || !tokenRow?.partner_id) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Orders</h1>
        <p>Invalid or revoked token.</p>
      </main>
    );
  }

  const partnerId = tokenRow.partner_id;

  // 2) load partner (header)
  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,email")
    .eq("id", partnerId)
    .maybeSingle();

  // 3) load ONLY this partner's orders (using YOUR real columns)
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select(
      "id, shopify_order_id, shopify_order_number, shopify_created_at, paid_at, partner_status, partner_id"
    )
    .eq("partner_id", partnerId)
    .order("shopify_created_at", { ascending: false });

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Orders</h1>
        <Link
          href={`/?token=${encodeURIComponent(token)}`}
          style={{ marginLeft: "auto", textDecoration: "none" }}
        >
          ← Back
        </Link>
      </div>

      <p style={{ opacity: 0.75 }}>
        Partner: <b>{partner?.name ?? "Partner"}</b>
        {partner?.email ? ` — ${partner.email}` : ""}
      </p>

      {ordersErr && (
        <p style={{ color: "tomato" }}>Orders query error: {ordersErr.message}</p>
      )}

      {!ordersErr && (!orders || orders.length === 0) && (
        <p style={{ opacity: 0.8 }}>No orders found yet.</p>
      )}

      {orders && orders.length > 0 && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "rgba(255,255,255,0.04)" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 12 }}>Shopify Order</th>
                <th style={{ textAlign: "left", padding: 12 }}>Created</th>
                <th style={{ textAlign: "left", padding: 12 }}>Paid</th>
                <th style={{ textAlign: "left", padding: 12 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {o.shopify_order_number ?? o.shopify_order_id ?? o.id}
                  </td>
                  <td style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {o.shopify_created_at
                      ? new Date(o.shopify_created_at).toLocaleString("da-DK")
                      : "-"}
                  </td>
                  <td style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {o.paid_at ? new Date(o.paid_at).toLocaleString("da-DK") : "-"}
                  </td>
                  <td style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    {o.partner_status ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
