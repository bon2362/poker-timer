export type LyricLine = { time: number; text: string };

export type LyricsQuery = { name: string; artist: string; album: string; durationMs: number | null };

const API = 'https://lrclib.net/api';
const DURATION_TOLERANCE_S = 3;

// "[01:23.45] text" (one line may carry several timestamps) → lines sorted by time in ms.
// Empty lines (instrumental gaps) are dropped: the last sung line stays up during a gap.
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    for (const s of stamps) lines.push({ time: Math.round((Number(s[1]) * 60 + Number(s[2])) * 1000), text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

// Index of the line sounding at positionMs; -1 before the first line.
export function currentLineIndex(lines: LyricLine[], positionMs: number): number {
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].time <= positionMs) i++;
  return i;
}

const EXTRA = /remaster|live|version|edit|mix|mono|stereo|deluxe|bonus|acoustic|demo|single|radio|feat\.?|ft\.|with /i;

// Spotify titles carry suffixes LRCLIB usually lacks: "Song - 2011 Remaster", "Song (feat. X)".
export function cleanTrackName(name: string): string {
  return name
    .replace(/\s*[([][^)\]]*[)\]]/g, m => (EXTRA.test(m) ? '' : m))
    .replace(/\s+-\s+.*$/, m => (EXTRA.test(m) ? '' : m))
    .trim();
}

type LrclibRecord = { duration?: number; syncedLyrics?: string | null };

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`lrclib ${res.status}`);
  return res.json();
}

function closeEnough(record: LrclibRecord, durationMs: number | null): boolean {
  if (durationMs === null || typeof record.duration !== 'number') return true;
  return Math.abs(record.duration - durationMs / 1000) <= DURATION_TOLERANCE_S;
}

// Synced lyrics from LRCLIB, or null when there are none. Network errors are thrown.
export async function fetchSyncedLyrics(q: LyricsQuery): Promise<LyricLine[] | null> {
  const name = cleanTrackName(q.name);
  const params = new URLSearchParams({ track_name: name, artist_name: q.artist, album_name: q.album });
  if (q.durationMs !== null) params.set('duration', String(Math.round(q.durationMs / 1000)));

  const exact = (await getJson(`${API}/get?${params}`)) as LrclibRecord | null;
  if (exact?.syncedLyrics) return parseLrc(exact.syncedLyrics);

  const found = (await getJson(`${API}/search?${new URLSearchParams({ track_name: name, artist_name: q.artist })}`)) as LrclibRecord[] | null;
  const match = (found ?? []).find(r => r.syncedLyrics && closeEnough(r, q.durationMs));
  return match?.syncedLyrics ? parseLrc(match.syncedLyrics) : null;
}
