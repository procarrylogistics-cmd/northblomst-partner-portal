import "./globals.css";

export const metadata = {
  title: "Northblomst Partner Portal",
  description: "Internal partner system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#0f0f0f",
          color: "white",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            height: 80,
            display: "flex",
            alignItems: "center",
            padding: "0 30px",
            borderBottom: "1px solid #222",
            background: "#111",
          }}
        >
          <img
            src="/logo.png"
            alt="Northblomst"
            style={{ height: 100 }}
          />
        </div>

        {/* CONTENT */}
        <div>{children}</div>
      </body>
    </html>
  );
}

