"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import type { Game } from "@/types/game";

// Steam serves each screenshot in several sizes under the same name.
const thumbnail = (url: string) => url.replace(".1920x1080.", ".600x338.");

const HLS_SCRIPT = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.light.min.js";
type HlsInstance = { loadSource(url: string): void; attachMedia(video: HTMLVideoElement): void; destroy(): void };
type HlsGlobal = { new (): HlsInstance; isSupported(): boolean };

function loadHls(): Promise<HlsGlobal | null> {
  const existing = (window as unknown as { Hls?: HlsGlobal }).Hls;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = HLS_SCRIPT;
    script.async = true;
    script.onload = () => resolve((window as unknown as { Hls?: HlsGlobal }).Hls ?? null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
}

// Steam trailers are HLS streams: Safari plays them natively, other browsers get hls.js on the first play only.
function Trailer({ trailer, steamId }: { trailer: NonNullable<Game["trailer"]>; steamId?: number | null }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!playing || !video) return;
    let hls: HlsInstance | null = null;
    let cancelled = false;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = trailer.hls;
    } else {
      loadHls().then((Hls) => {
        if (cancelled) return;
        if (!Hls || !Hls.isSupported()) return setFailed(true);
        hls = new Hls();
        hls.loadSource(trailer.hls);
        hls.attachMedia(video);
      });
    }
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [playing, trailer.hls]);

  if (failed) {
    return (
      <p className="hint">
        Не получилось включить трейлер здесь.{" "}
        {steamId && <a className="text-link" href={`https://store.steampowered.com/app/${steamId}/`} target="_blank" rel="noopener noreferrer">Посмотреть в Steam</a>}
      </p>
    );
  }

  return playing ? (
    <video ref={videoRef} className="trailer-video" controls autoPlay playsInline poster={trailer.thumbnail || undefined}
      onError={() => setFailed(true)} />
  ) : (
    <button type="button" className="trailer-poster" onClick={() => setPlaying(true)} aria-label={`Смотреть трейлер: ${trailer.name}`}>
      {trailer.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={trailer.thumbnail.replace(".293x165.", ".max.")} alt="" loading="lazy"
          onError={(event) => { event.currentTarget.src = trailer.thumbnail; }} />
      )}
      <span className="trailer-play"><Play size={26} fill="currentColor" /></span>
      <span className="trailer-name">{trailer.name}</span>
    </button>
  );
}

function Lightbox({ shots, index, title, onClose, onMove }: {
  shots: string[]; index: number; title: string; onClose: () => void; onMove: (step: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onMove(1);
      if (event.key === "ArrowLeft") onMove(-1);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while the picture is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, onMove]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Скриншот ${index + 1} из ${shots.length}`} onClick={onClose}>
      <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="Закрыть"><X size={22} /></button>
      {shots.length > 1 && (
        <button type="button" className="lightbox-nav prev" aria-label="Предыдущий"
          onClick={(event) => { event.stopPropagation(); onMove(-1); }}><ChevronLeft size={28} /></button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shots[index]} alt={`${title}: скриншот ${index + 1}`} onClick={(event) => event.stopPropagation()} />
      {shots.length > 1 && (
        <button type="button" className="lightbox-nav next" aria-label="Следующий"
          onClick={(event) => { event.stopPropagation(); onMove(1); }}><ChevronRight size={28} /></button>
      )}
      <span className="lightbox-count">{index + 1} / {shots.length}</span>
    </div>
  );
}

export default function GameMedia({ game }: { game: Game }) {
  const shots = game.screenshots ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const move = useCallback((step: number) => {
    setOpen((current) => current === null ? null : (current + step + shots.length) % shots.length);
  }, [shots.length]);

  if (!shots.length && !game.trailer) return null;

  return (
    <div className="detail-block media-block">
      <h2>{game.trailer ? "Трейлер и скриншоты" : "Скриншоты"}</h2>
      {game.trailer && <Trailer trailer={game.trailer} steamId={game.steamId} />}
      {shots.length > 0 && (
        <ul className="shot-grid">
          {shots.map((shot, index) => (
            <li key={shot}>
              <button type="button" onClick={() => setOpen(index)} aria-label={`Открыть скриншот ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail(shot)} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open !== null && <Lightbox shots={shots} index={open} title={game.title} onClose={close} onMove={move} />}
    </div>
  );
}
