import { createClient } from "@/lib/supabase";

export default async function Home() {
  const supabase = createClient();

  const { data: partners, error } = await supabase
    .from("partners")
    .select(
      "id, name, email, trackpod_shipper_name, pickup_address_line1, pickup_postal_code, pickup_city, active, created_at"
    )
    .order("created_at", { ascending: false });

  // Debug info (appears in Vercel logs, not in browser console)
  const debug = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    error: error ? { message: error.message, details: (error as any).details } : null,
    count: partners?.length ?? 0,
  };

  return (
    <main style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Northblomst Partner Portal</h1>

      {/* DEBUG BOX (remove later) */}
      <div
        style={{
          background: "#111",
          color: "#0f0",
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 12,
          whiteSpace: "pre-wrap",
        }}
      >
        DEBUG: {JSON.stringify(debug, null, 2)}
      </div>

      {error && (
        <div
          style={{
            background: "#2a0000",
            color: "#ffb4b4",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <strong>Supabase error:</strong> {error.message}
        </div>
      )}

      {!partners || partners.length === 0 ? (
        <p style={{ opacity: 0.8 }}>No partners found…</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {partners.map((p) => (
            <div
              key={p.id}
              style={{
                background: "#111",
                color: "#fff",
                borderRadius: 10,
                padding: 16,
                border: "1px solid #222",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700 }}>{p.name}</div>
              <div style={{ opacity: 0.9 }}>{p.email}</div>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                <strong>Track-POD shipper:</strong> {p.trackpod_shipper_name}
              </div>
              <div style={{ marginTop: 8, opacity: 0.85 }}>
                <strong>Pickup:</strong>{" "}
                {p.pickup_address_line1}, {p.pickup_postal_code} {p.pickup_city}
              </div>
              <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                Active: {String(p.active)}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
