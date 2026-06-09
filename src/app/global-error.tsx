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
          background: "#f6f7f8",
          color: "#0a0e1a",
          fontFamily:
            'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
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
              border: "1px dashed #d1d5db",
              background: "#ffffff",
              padding: "40px 24px",
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                color: "#94a3b8",
                fontSize: 20,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              [!]
            </div>
            <h1
              style={{
                margin: "12px 0 0",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Sistem tidak dapat dimuat
            </h1>
            <p
              style={{
                maxWidth: 448,
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: 11,
                lineHeight: "20px",
              }}
            >
              Terjadi gangguan pada tampilan utama. Muat ulang halaman untuk
              mencoba kembali.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: 32,
                marginTop: 16,
                border: "1px solid #0a0e1a",
                background: "#0a0e1a",
                color: "#00d4aa",
                padding: "0 12px",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
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
