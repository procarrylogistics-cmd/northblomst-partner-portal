"use client";

type OrderRow = {
  id: string;
  shopify_order_number: string | null;
  shopify_created_at: string | null;
  paid_at: string | null;
  partner_status: string | null;
};

export default function OrdersTable({ orders }: { orders: OrderRow[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px 220px 180px 1fr",
            gap: 0,
            padding: "12px 14px",
            fontWeight: 700,
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <div>Order</div>
          <div>Created</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {orders.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.8 }}>
            No orders found for this partner.
          </div>
        ) : (
          orders.map((o) => (
            <div
              key={o.id}
              style={{
                display: "grid",
                gridTemplateColumns: "220px 220px 180px 1fr",
                padding: "12px 14px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {o.shopify_order_number ?? o.id}
              </div>

              <div style={{ opacity: 0.85, fontSize: 13 }}>
                {o.shopify_created_at
                  ? new Date(o.shopify_created_at).toLocaleString()
                  : "-"}
              </div>

              <div style={{ opacity: 0.9, fontSize: 13 }}>
                {o.partner_status ?? "-"}
              </div>

              <div style={{ textAlign: "right", opacity: 0.55, fontSize: 13 }}>
                (Print/Reprint next step)
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
