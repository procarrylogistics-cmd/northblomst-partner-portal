// app/orders/page.tsx
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import OrdersTable, { type OrderRow } from "./OrdersTable.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

type Partner = {
  id: string;
  name: string;
  email: string | null;
  pickup_address_line1: string | null;
  pickup_postal_code: string | null;
};

function dkDateISO(offsetDays = 0) {
  // YYYY-MM-DD în timezone DK
  const now = new Date();
  const dk = new Date(now.getTime() + offsetDays * 86400000);
  return dk.toLocaleDateString("en-CA", { timeZone: "Europe/Copenhagen" }); // en-CA => YYYY-MM-DD
}

function FilterBar({ token, selectedDate }: { token: string; selectedDate: string }) {
  const base = `/orders?token=${encodeURIComponent(token)}`;
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
      <Link
        href={`${base}&when=today`}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.18)",
          textDecoration: "none",
        }}
      >
        Today
      </Link>

      <Link
        href={`${base}&when=tomorrow`}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.18)",
          textDecoration: "none",
        }}
      >
        Tomorrow
      </Link>

      <form
        action="/orders"
        method="GET"
        style={{ display: "flex", gap: 10, alignItems: "center" }}
      >
        <input type="hidden" name="token" value={token} />
        <input
          type="date"
          name="date"
          defaultValue={selectedDate}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "white",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Show
        </button>
      </form>
    </div>
  );
}

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

  if (!supabase) {
    return (
      <main style={{ padding: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Orders</h1>
        <p style={{ color: "#ffb4b4" }}>Server env missing.</p>
        <pre style={{ opacity: 0.85 }}>
          {JSON.stringify(
            {
              hasUrl: !!supabaseUrl,
              hasServiceRole: !!supabaseServiceKey,
            },
            null,
            2
          )}
        </pre>
      </main>
    );
  }

  // choose filter date
  const when = (Array.isArray(sp?.when) ? sp.when[0] : sp?.when) as string | undefined;
  const dateParam = (Array.isArray(sp?.date) ? sp.date[0] : sp?.date) as string | undefined;

  let selectedDate = dkDateISO(0);
  if (when === "tomorrow") selectedDate = dkDateISO(1);
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) selectedDate = dateParam;

  // 1) token -> partner_id
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
      </main>
    );
  }

  const partnerId = tokenRow.partner_id as string;

  // 2) partner header
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

  // 3) orders by partner_id + delivery_date filter
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select(
      [
        "id",
        "shopify_order_number",
        "shopify_order_id",
        "partner_status",
        "delivery_postal_code",
        "created_at",

        // for filtering + print layout
        "delivery_date",
        "delivery_window_start",
        "delivery_window_end",
        "recipient_name",
        "recipient_phone",
        "delivery_address1",
        "delivery_address2",
        "delivery_city",
        "delivery_country",
        "notes",
      ].join(",")
    )
    .eq("partner_id", partnerId)
    .eq("delivery_date", selectedDate)
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

        <FilterBar token={token} selectedDate={selectedDate} />
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          Showing date: <b>{selectedDate}</b>
        </div>
      </div>

      <OrdersTable orders={rows} token={token} />

      <div style={{ marginTop: 14, opacity: 0.7 }}>
        Showing {rows.length} order(s).
      </div>
    </main>
  );
}
