"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [partners, setPartners] = useState<any[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      const { data, error } = await supabase.from("partners").select("*");

      if (error) {
        console.error("ERROR:", error);
      } else {
        setPartners(data || []);
      }
    };

    fetchPartners();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>Northblomst Partner Portal</h1>

      {partners.length === 0 ? (
        <p>No partners found...</p>
      ) : (
        partners.map((partner) => (
  <div
    key={partner.id}
    style={{
      padding: "12px 0",
      borderBottom: "1px solid #333",
      fontSize: 14,
    }}
  >
    <strong>{partner.name}</strong> |{" "}
    {partner.email} |{" "}
    {partner.trackpod_shipper_name} |{" "}
    {partner.pickup_address_line1}, {partner.pickup_postal_code}
  </div>
))

      )}
    </div>
  );
}
