"use client";

import { Toaster } from "react-hot-toast";

/** Mounted once in the root layout. Bottom-right; offset keeps it clear of phone controls. */
export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      gutter={8}
      containerStyle={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)", right: 16, left: 16 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: "#FFFDF9",
          color: "#1A1A1A",
          border: "1px solid #C8A44D",
          boxShadow: "0 6px 24px rgba(26, 26, 26, 0.08)",
          borderRadius: "12px",
          padding: "12px 14px",
          maxWidth: 380,
        },
        success: { iconTheme: { primary: "#C8A44D", secondary: "#FFFDF9" } },
      }}
    />
  );
}
