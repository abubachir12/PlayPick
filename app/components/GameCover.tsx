"use client";

import { useState } from "react";

// A stable hue per title keeps placeholder covers distinct but inside the site's violet–blue range.
function placeholderStyle(title: string) {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const hue = 215 + (Math.abs(hash) % 110);
  return {
    background: `radial-gradient(circle at 25% 20%, hsl(${hue} 80% 62% / 0.55), transparent 55%),
      radial-gradient(circle at 85% 90%, hsl(${(hue + 50) % 360} 75% 55% / 0.35), transparent 50%),
      linear-gradient(135deg, hsl(${hue} 45% 16%), #0b0f19)`,
  };
}

function initials(title: string) {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?";
}

export default function GameCover({ src, title, className = "" }: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`game-cover game-cover-empty ${className}`} style={placeholderStyle(title)} aria-hidden="true">
        <span>{initials(title)}</span>
      </div>
    );
  }

  return (
    // RAWG covers come from a single CDN host; plain img keeps them out of the image optimizer quota.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Обложка ${title}`}
      className={`game-cover ${className}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
