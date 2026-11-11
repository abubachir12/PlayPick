"use client"; // Error boundaries must be Client Components

// Replaces the root layout when it fails, so it carries its own document and inline styles.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#070b12", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <title>Ошибка — PlayPick</title>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>PlayPick временно недоступен</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", margin: "12px 0 24px" }}>Обновите страницу через минуту.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "12px 22px", border: "none", borderRadius: 12, background: "#8b5cf6", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Попробовать снова
          </button>
        </div>
      </body>
    </html>
  );
}
