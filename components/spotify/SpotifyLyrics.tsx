'use client';
import { useEffect, useState } from 'react';
import type { SpotifyTrack } from '@/context/SpotifyContext';
import { currentPosition, type SpotifyProgress } from '@/lib/spotify/progress';
import { currentLineIndex, fetchSyncedLyrics, type LyricLine } from '@/lib/spotify/lyrics';

const TICK_MS = 250;

// Found lyrics (or null for "none") per track, kept until the page reloads.
const cache = new Map<string, LyricLine[] | null>();

// Synced lyrics of the track, or null while loading or when there are none.
export function useSyncedLyrics(track: SpotifyTrack | null, durationMs: number | null): LyricLine[] | null {
  const uri = track?.uri ?? null;
  const [loaded, setLoaded] = useState<{ uri: string; lines: LyricLine[] | null } | null>(null);

  useEffect(() => {
    if (!track || cache.has(track.uri)) return;
    let cancelled = false;
    fetchSyncedLyrics({ name: track.name, artist: track.artist, album: track.album, durationMs })
      .then(lines => {
        cache.set(track.uri, lines && lines.length > 0 ? lines : null);
        if (!cancelled) setLoaded({ uri: track.uri, lines: cache.get(track.uri) ?? null });
      })
      .catch(() => {}); // Network trouble: no lyrics this time, retried on the next play of the track.
    return () => { cancelled = true; };
    // The duration arrives with the track; refetching on every progress report is not wanted.
  }, [uri]);

  if (!uri) return null;
  if (cache.has(uri)) return cache.get(uri) ?? null;
  return loaded?.uri === uri ? loaded.lines : null;
}

// Position of a line relative to the current one (-1 leaving above … 3 entering below).
const SLOT_CLASS: Record<number, string> = {
  [-1]: '-translate-y-[1.6em] opacity-0',
  0: 'translate-y-0 opacity-40',
  1: 'translate-y-[1.6em] opacity-100',
  2: 'translate-y-[3.2em] opacity-40',
  3: 'translate-y-[4.8em] opacity-0',
};

// Three lines under the title: the sounding one bright in the middle, its neighbours dimmed.
// Lines keep their element across ticks, so moving to the next line slides everything up.
export function SpotifyLyrics({ lines, progress, playing }: { lines: LyricLine[]; progress: SpotifyProgress | null; playing: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  const index = progress ? currentLineIndex(lines, currentPosition(progress, playing, now)) : -1;
  const visible: number[] = [];
  for (let i = index - 2; i <= index + 2; i++) if (i >= 0 && i < lines.length) visible.push(i);

  return (
    <div className="relative h-[4.8em] w-[min(80vw,900px)] overflow-hidden text-[clamp(18px,2.8vh,30px)] font-semibold text-white">
      {visible.map(i => (
        <div
          key={i}
          className={`absolute inset-x-0 top-0 h-[1.6em] truncate text-center leading-[1.6em] transition-[translate,opacity] duration-500 ease-out ${SLOT_CLASS[i - index + 1]}`}
        >
          {lines[i].text}
        </div>
      ))}
    </div>
  );
}
