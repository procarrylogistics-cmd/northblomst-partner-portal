// app/orders/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Server-only Supabase (Service Role) — NU e expus în browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type Partner = {
  id: string;
  name: string;
  email: string | null;
  pickup_address_line1: string | null;
  pickup_postal_code: string | null;
};

type OrderRow = {
  id: string;
  shopify_order_number: string | null;
  shopify_order_id: number | null;
  partner_status: string | null;
  delivery_postal_code: string | null;
  created_at: string | null;
};

export default async function OrdersPage(props: any) {
  const sp = await Promise.resolve(props.searchParams ?? {});
  const tokenRaw = sp?.token;
  const token = (Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw ?? "").trim();

  if (!token) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Orders</h1>
        <p>Missing token. Please use the link you received.</p>
      </main>
    );
  }

  // 1) Găsim partner_id din token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("partner_access_tokens")
    .select("partner_id, active")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (tokenErr || !tokenRow?.partner_id) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Orders</h1>
        <p>Invalid token or token is inactive.</p>
        <p style={{ opacity: 0.7, marginTop: 8 }}>Please use the link you received.</p>
      </main>
    );
  }

  const partnerId = tokenRow.partner_id as string;

  // 2) Datele partenerului (header)
  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("id,name,email,pickup_address_line1,pickup_postal_code")
    .eq("id", partnerId)
    .maybeSingle<Partner>();

  if (partnerErr || !partner) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Orders</h1>
        <p>Partner not found for this token.</p>
      </main>
    );
  }

  // 3) Comenzile DOAR ale partenerului
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, shopify_order_number, shopify_order_id, partner_status, delivery_postal_code, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (ordersErr) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Orders</h1>
        <p>Could not load orders.</p>
        <pre style={{ opacity: 0.8 }}>{ordersErr.message}</pre>
      </main>
    );
  }

  const rows = (orders ?? []) as OrderRow[];

  return (
    <main style={{ padding: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          href={`/?token=${encodeURIComponent(token)}`}
          style={{
            display: "inline-block",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            textDecoration: "none",
          }}
        >
          ← Back
        </Link>
        <h1 style={{ margin: 0 }}>Orders</h1>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          maxWidth: 900,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 20 }}>{partner.name}</div>
        <div style={{ opacity: 0.85, marginTop: 4 }}>{partner.email}</div>
        <div style={{ opacity: 0.85, marginTop: 8 }}>
          {partner.pickup_address_line1}{" "}
          {partner.pickup_postal_code ? `, ${partner.pickup_postal_code}` : ""}
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          overflow: "hidden",
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px 160px 140px 160px 1fr",
            padding: "12px 14px",
            fontWeight: 700,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div>Order</div>
          <div>Status</div>
          <div>Postal</div>
          <div>Date</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: 16, opacity: 0.8 }}>No orders yet.</div>
        ) : (
          rows.map((o) => (
            <div
              key={o.id}
              style={{
                display: "grid",
                gridTemplateColumns: "220px 160px 140px 160px 1fr",
                padding: "12px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>{o.shopify_order_number ?? "-"}</div>
              <div style={{ opacity: 0.9 }}>{o.partner_status ?? "-"}</div>
              <div style={{ opacity: 0.9 }}>{o.delivery_postal_code ?? "-"}</div>
              <div style={{ opacity: 0.9 }}>
                {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
              </div>

              <div style={{ textAlign: "right", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  onClick={() => alert("Print placeholder")}
                >
                  Print
                </button>

                <button
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.08)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  onClick={() => alert("Reprint placeholder")}
                >
                  Reprint
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 14, opacity: 0.7 }}>Showing {rows.length} order(s).</div>
    </main>
  );
}
