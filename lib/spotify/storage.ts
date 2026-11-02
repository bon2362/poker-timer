import type { SpotifyPlaylistItem } from './api';

const LAST_PLAYLIST_KEY = 'spotifyLastPlaylist';
const VOLUME_KEY = 'spotifyVolume';
const DEFAULT_VOLUME = 0.5;

export function loadLastPlaylist(): SpotifyPlaylistItem | null {
  try {
    const raw = window.localStorage.getItem(LAST_PLAYLIST_KEY);
    return raw ? (JSON.parse(raw) as SpotifyPlaylistItem) : null;
  } catch {
    return null;
  }
}

export function saveLastPlaylist(playlist: SpotifyPlaylistItem): void {
  try { window.localStorage.setItem(LAST_PLAYLIST_KEY, JSON.stringify(playlist)); } catch {}
}

export function loadVolume(): number {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_KEY));
    return window.localStorage.getItem(VOLUME_KEY) !== null && value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveVolume(volume: number): void {
  try { window.localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
}
