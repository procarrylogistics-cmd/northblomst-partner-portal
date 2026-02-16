import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Home({ searchParams }: any) {
  const token = searchParams?.token;

  if (!token) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Invalid access</h2>
        <p>No token provided.</p>
      </div>
    );
  }

  const { data: tokenRow } = await supabase
    .from("partner_access_tokens")
    .select("partner_id")
    .eq("token", token)
    .eq("active", true)
    .single();

  if (!tokenRow) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Access denied</h2>
        <p>Invalid or inactive token.</p>
      </div>
    );
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", tokenRow.partner_id)
    .single();

  if (!partner) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Partner not found</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>{partner.name}</h1>
      <p>{partner.email}</p>
      <p>
        {partner.pickup_address_line1}, {partner.pickup_postal_code}
      </p>
    </div>
  );
}
