import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const order = body;

    const recipientName = order.shipping_address?.name || "";
    const recipientPhone = order.shipping_address?.phone || "";
    const address1 = order.shipping_address?.address1 || "";
    const address2 = order.shipping_address?.address2 || "";
    const city = order.shipping_address?.city || "";
    const postalCode = order.shipping_address?.zip || "";
    const country = order.shipping_address?.country_code || "DK";

    const deliveryDate =
      order.note_attributes?.find((n: any) =>
        n.name.toLowerCase().includes("delivery")
      )?.value || new Date().toISOString().split("T")[0];

    // 🔥 AUTO ALLOCATE PARTNER BASED ON POSTAL CODE
    const { data: partnerRange } = await supabase
      .from("partner_postal_ranges")
      .select("*")
      .lte("postal_code_from", postalCode)
      .gte("postal_code_to", postalCode)
      .single();

    const partnerId = partnerRange?.partner_id || null;

    const { error } = await supabase.from("orders").insert([
      {
        shopify_order_id: order.id,
        shopify_order_number: order.name,
        shopify_created_at: order.created_at,
        paid_at: order.processed_at,
        partner_id: partnerId,
        partner_status: "NY",
        delivery_date: deliveryDate,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        delivery_address1: address1,
        delivery_address2: address2,
        delivery_city: city,
        delivery_postal_code: postalCode,
        delivery_country: country,
        source: "shopify",
      },
    ]);

    if (error) {
      console.error(error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
