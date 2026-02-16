// app/orders/print/[id]/page.tsx
import { createClient } from "@supabase/supabase-js";
import PrintClient from "./print-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase =
  supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

function A4({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <title>Print</title>
        <style>{`
          @page { size: A4; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #111; }
          .box { border:1px solid #111; border-radius:10px; padding:12px; margin-bottom:12px; }
          .muted { color:#444; font-size:12px; }
          .h { font-size:18px; font-weight:800; }
          .big { font-size:28px; font-weight:900; }
          .label { margin-top:14px; border-top:2px dashed #111; padding-top:12px; }
          .qr { width:140px; height:140px; border:1px solid #111; border-radius:10px; display:flex; align-items:center; justify-content:center; }
          .row { display:flex; gap:12px; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

export default async function PrintOrderPage({ params, searchParams }: any) {
  const id = params?.id as string;
  const token = (searchParams?.token ?? "").toString().trim();

  if (!supabase) {
    return (
      <A4>
        <div className="box">
          <div className="h">Server env missing</div>
          <pre>{JSON.stringify({ hasUrl: !!supabaseUrl, hasServiceRole: !!supabaseServiceKey }, null, 2)}</pre>
        </div>
      </A4>
    );
  }

  // validate token
  const { data: tokenRow } = await supabase
    .from("partner_access_tokens")
    .select("partner_id, active")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();

  if (!tokenRow?.partner_id) {
    return (
      <A4>
        <div className="box">
          <div className="h">Invalid token</div>
          <div className="muted">Use the link you received.</div>
        </div>
      </A4>
    );
  }

  const partnerId = tokenRow.partner_id as string;

  // load order minimal fields (SAFE)
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, partner_id, shopify_order_number, partner_status, delivery_postal_code, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !order || order.partner_id !== partnerId) {
    return (
      <A4>
        <div className="box">
          <div className="h">Order not found / not allowed</div>
          <div className="muted">This order doesn’t belong to this partner.</div>
        </div>
      </A4>
    );
  }

  const orderNo = order.shopify_order_number ?? order.id;
  const qrText = `NORTHBLOMST|ORDER=${orderNo}|ID=${order.id}`;

  return (
    <A4>
      <PrintClient />

      <div className="box">
        <div className="muted">Northblomst - Partner Print</div>
        <div className="big">{orderNo}</div>
        <div style={{ marginTop: 8 }}>
          <b>Status:</b> {order.partner_status ?? "-"}
        </div>
        <div style={{ marginTop: 6 }}>
          <b>Postal:</b> {order.delivery_postal_code ?? "-"}
        </div>
        <div style={{ marginTop: 6 }}>
          <b>Created:</b> {order.created_at ? new Date(order.created_at).toLocaleString() : "-"}
        </div>
      </div>

      <div className="label">
        <div className="h">LABEL</div>
        <div className="muted">Scan QR for order</div>

        <div className="row" style={{ marginTop: 12 }}>
          <div className="qr">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrText)}`}
              width={140}
              height={140}
              alt="QR"
            />
          </div>

          <div className="box" style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{orderNo}</div>
            <div style={{ marginTop: 6 }}>
              <b>Postal:</b> {order.delivery_postal_code ?? "-"}
            </div>
            <div style={{ marginTop: 6 }}>
              <b>Status:</b> {order.partner_status ?? "-"}
            </div>
          </div>
        </div>
      </div>
    </A4>
  );
}
