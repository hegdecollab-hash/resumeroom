import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";

export const alt = `${APP_NAME} – Interview practice built around your resume`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#fbfaf7",
        color: "#1f2328",
      }}
    >
      <div style={{ fontSize: 36, color: "#4f46e5", fontWeight: 600 }}>{APP_NAME}</div>
      <div style={{ fontSize: 72, fontWeight: 600, marginTop: 24, lineHeight: 1.1 }}>
        Interview practice built around your resume.
      </div>
      <div style={{ fontSize: 30, color: "#4b5260", marginTop: 28 }}>Rehearse the questions your resume invites.</div>
    </div>,
    size,
  );
}
