"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            background: "linear-gradient(to bottom, #f9fafb, #f3f4f6)",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              padding: "2rem",
              backgroundColor: "white",
              borderRadius: "0.5rem",
              boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "1.5rem",
              }}
            >
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderRadius: "9999px",
                }}
              >
                <AlertCircle
                  style={{
                    width: "3rem",
                    height: "3rem",
                    color: "#ef4444",
                  }}
                />
              </div>

              <div>
                <h1
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                    marginBottom: "0.5rem",
                  }}
                >
                  Application Error
                </h1>
                <p style={{ color: "#6b7280" }}>
                  A critical error occurred. Please refresh the page to continue.
                </p>
              </div>

              <button
                onClick={reset}
                style={{
                  width: "100%",
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  borderRadius: "0.375rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
