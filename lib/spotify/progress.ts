export type SpotifyProgress = { position: number; duration: number; at: number };

// Spotify reports the position only when the state changes; between reports it moves with the clock.
export function currentPosition(progress: SpotifyProgress, playing: boolean, now: number): number {
  const elapsed = playing ? Math.max(0, now - progress.at) : 0;
  return Math.min(progress.duration, progress.position + elapsed);
}

export function formatTrackTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
