import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
        }}
      >
        <svg width="112" height="112" viewBox="0 0 64 64">
          <path d="M32 6 L37.6 26.4 L58 32 L37.6 37.6 L32 58 L26.4 37.6 L6 32 L26.4 26.4 Z" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
