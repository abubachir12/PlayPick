import { ImageResponse } from "next/og";

// Link previews in chats. The bundled OG font has no Cyrillic, so the card text stays Latin.
export const alt = "PlayPick — pick a game for your mood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "radial-gradient(circle at 80% 20%, rgba(139,92,246,0.55), transparent 55%), radial-gradient(circle at 10% 90%, rgba(59,130,246,0.3), transparent 50%), #070b12",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 26,
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              boxShadow: "0 0 60px rgba(139,92,246,0.6)",
            }}
          >
            <svg width="60" height="60" viewBox="0 0 64 64">
              <path d="M32 6 L37.6 26.4 L58 32 L37.6 37.6 L32 58 L26.4 37.6 L6 32 L26.4 26.4 Z" fill="#fff" />
            </svg>
          </div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -3 }}>PlayPick</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 52, fontWeight: 700, color: "#c4b5fd" }}>What to play right now?</div>
        <div style={{ marginTop: 16, fontSize: 30, color: "rgba(255,255,255,0.7)" }}>
          Games picked for your mood, time and favourite genres
        </div>
      </div>
    ),
    size,
  );
}
