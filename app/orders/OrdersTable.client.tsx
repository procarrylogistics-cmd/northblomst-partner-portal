"use client";

export type OrderRow = {
  id: string;
  shopify_order_number: string | null;
  shopify_order_id: number | null;
  partner_status: string | null;
  delivery_postal_code: string | null;
  created_at: string | null;
};

export default function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
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
          gridTemplateColumns: "220px 160px 140px 180px 1fr",
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

      {orders.length === 0 ? (
        <div style={{ padding: 16, opacity: 0.8 }}>No orders yet.</div>
      ) : (
        orders.map((o) => (
          <div
            key={o.id}
            style={{
              display: "grid",
              gridTemplateColumns: "220px 160px 140px 180px 1fr",
              padding: "12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {o.shopify_order_number ?? "-"}
            </div>
            <div style={{ opacity: 0.9 }}>{o.partner_status ?? "-"}</div>
            <div style={{ opacity: 0.9 }}>{o.delivery_postal_code ?? "-"}</div>
            <div style={{ opacity: 0.9 }}>
              {o.created_at ? new Date(o.created_at).toLocaleString() : "-"}
            </div>

            <div
              style={{
                textAlign: "right",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
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
                onClick={() => alert(`Print: ${o.shopify_order_number ?? o.id}`)}
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
                onClick={() =>
                  alert(`Reprint: ${o.shopify_order_number ?? o.id}`)
                }
              >
                Reprint
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
