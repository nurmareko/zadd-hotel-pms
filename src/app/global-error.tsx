"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <head>
        <title>Gangguan Sistem | ZADD Hotel Management</title>
      </head>
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          background: "#F8FAFC",
          color: "#0F172A",
          fontFamily:
            '"Plus Jakarta Sans", var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <main
          role="alert"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: 576,
              minHeight: 280,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              background: "#FFFFFF",
              padding: "40px 24px",
              boxSizing: "border-box",
              textAlign: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: "#FEF3C7",
                color: "#B45309",
                fontSize: 22,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              !
            </div>
            <h1
              style={{
                margin: "20px 0 0",
                color: "#0F172A",
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              Sistem tidak dapat dimuat
            </h1>
            <p
              style={{
                maxWidth: 448,
                margin: "8px 0 0",
                color: "#64748B",
                fontSize: 14,
                lineHeight: "24px",
              }}
            >
              Terjadi gangguan pada tampilan utama. Muat ulang halaman untuk
              mencoba kembali.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: 40,
                marginTop: 24,
                border: "1px solid #0F172A",
                borderRadius: 6,
                background: "#0F172A",
                color: "#FFFFFF",
                padding: "0 16px",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                lineHeight: "40px",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              Muat ulang
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
