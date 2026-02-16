"use client";

type OrderRow = {
  id: string;
  shopify_order_number: string | null;
  partner_status: string | null;
  delivery_postal_code: string | null;
  created_at: string | null;
};

export default function OrdersTable({
  orders,
  token,
}: {
  orders: OrderRow[];
  token: string;
}) {
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
        }}
      >
        <div>Order</div>
        <div>Status</div>
        <div>Postal</div>
        <div>Date</div>
        <div style={{ textAlign: "right" }}>Action</div>
      </div>

      {orders.length === 0 ? (
        <div style={{ padding: 16, opacity: 0.8 }}>
          No orders.
        </div>
      ) : (
        orders.map((o) => (
          <div
            key={o.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "220px 160px 140px 180px 1fr",
              padding: "12px 14px",
              borderBottom:
                "1px solid rgba(255,255,255,0.06)",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {o.shopify_order_number ?? "-"}
            </div>

            <div>{o.partner_status ?? "-"}</div>

            <div>{o.delivery_postal_code ?? "-"}</div>

            <div>
              {o.created_at
                ? new Date(o.created_at).toLocaleString()
                : "-"}
            </div>

            <div style={{ textAlign: "right" }}>
              <a
                href={`/orders/print/${o.id}?token=${encodeURIComponent(
                  token
                )}`}
                target="_blank"
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border:
                    "1px solid rgba(255,255,255,0.25)",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Print
              </a>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
