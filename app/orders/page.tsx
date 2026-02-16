"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type OrderRow = {
  id: string;
  shopify_order_number: string | null;
  shopify_created_at: string | null;
  partner_status: string | null;
  partner_id: string | null;
  printed_at?: string | null;
};

function toDateInputValue(d: Date) {
  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDayISO(dateStr: string) {
  // treat as local day, convert to ISO boundaries by constructing Date in local time
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.toISOString();
}

function endOfDayISO(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return dt.toISOString();
}

export default function OrdersPage() {
  const todayStr = useMemo(() => toDateInputValue(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async (dateStr: string) => {
    setLoading(true);

    const fromISO = startOfDayISO(dateStr);
    const toISO = endOfDayISO(dateStr);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, shopify_order_number, shopify_created_at, partner_status, partner_id, printed_at"
      )
      .gte("shopify_created_at", fromISO)
      .lte("shopify_created_at", toISO)
      .order("shopify_created_at", { ascending: false })
      .limit(200);

    console.log("ORDERS DATA:", data);
    console.log("ORDERS ERROR:", error);

    setOrders((data as OrderRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const goDay = (delta: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + delta);
    setSelectedDate(toDateInputValue(dt));
  };

  const handlePrint = async (order: OrderRow) => {
    // 1) print
    window.print();

    // 2) mark printed (dar rămâne clickabil pentru emergency)
    await supabase
      .from("orders")
      .update({ printed_at: new Date().toISOString() })
      .eq("id", order.id);
  };

  return (
    <div style={{ padding: 40 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Orders</h1>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => goDay(-1)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #555",
                background: "transparent",
                color: "white",
                cursor: "pointer",
              }}
            >
              ◀ Prev
            </button>

            <button
              onClick={() => setSelectedDate(todayStr)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #555",
                background: "transparent",
                color: "white",
                cursor: "pointer",
              }}
            >
              Today
            </button>

            <button
              onClick={() => goDay(1)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #555",
                background: "transparent",
                color: "white",
                cursor: "pointer",
              }}
            >
              Next ▶
            </button>

            <div style={{ width: 12 }} />

            <label style={{ fontSize: 12, opacity: 0.8 }}>Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #555",
                background: "transparent",
                color: "white",
              }}
            />
          </div>
        </div>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Showing: <strong>{selectedDate}</strong> • {orders.length} orders
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : orders.length === 0 ? (
        <p>No orders found for this date.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {orders.map((o) => {
            const isPrinted = !!o.printed_at;

            return (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid #333",
                  fontSize: 14,
                  opacity: isPrinted ? 0.75 : 1,
                }}
              >
                <div>
                  <strong>{o.shopify_order_number || "(no number)"}</strong>
                  {"  "} | Status: {o.partner_status || "-"}
                  {isPrinted ? (
                    <span style={{ marginLeft: 10, fontSize: 12 }}>
                      ✅ Printed
                    </span>
                  ) : null}
                </div>

                <button
                  onClick={() => handlePrint(o)}
                  title={isPrinted ? "Re-print (emergency)" : "Print"}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #555",
                    background: "transparent",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {isPrinted ? "Re-print" : "Print"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
