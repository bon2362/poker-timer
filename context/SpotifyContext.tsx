'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearTokens, getSpotifyClientId, SPOTIFY_AUTH_KEY, getValidAccessToken, loadTokens, startSpotifyLogin } from '@/lib/spotify/auth';
import { playContext, searchPlaylists, SpotifyApiError, type SpotifyPlaylistItem } from '@/lib/spotify/api';
import { loadLastPlaylist, loadVolume, saveLastPlaylist, saveVolume } from '@/lib/spotify/storage';
import { AutoPauseController, type SiteAudioId } from '@/lib/spotify/autoPause';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const PLAYER_NAME = 'Poker Timer';

export type SpotifyStatus = 'disabled' | 'disconnected' | 'connecting' | 'ready' | 'error';
export type SpotifyTrack = { name: string; artists: string; imageUrl: string | null };

export type SpotifyContextValue = {
  status: SpotifyStatus;
  errorMessage: string | null;
  notice: string | null;
  track: SpotifyTrack | null;
  isPlaying: boolean;
  isActiveHere: boolean;
  playingElsewhere: boolean;
  volume: number;
  lastPlaylist: SpotifyPlaylistItem | null;
  activeHolds: SiteAudioId[];
  connect(): void;
  disconnect(): void;
  togglePlay(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setVolume(v: number): void;
  playPlaylist(p: SpotifyPlaylistItem): Promise<void>;
  search(q: string): Promise<SpotifyPlaylistItem[]>;
  holdSiteAudio(id: SiteAudioId): void;
  releaseSiteAudio(id: SiteAudioId): void;
};

const SpotifyContext = createContext<SpotifyContextValue | null>(null);

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise(resolve => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      document.body.appendChild(script);
    });
  }
  return sdkPromise;
}

function apiErrorMessage(e: unknown): string {
  if (e instanceof SpotifyApiError) {
    if (e.status === 401) return 'Подключите Spotify заново';
    if (e.status === 403) return 'Нужен Spotify Premium';
    if (e.status === 404) return 'Плеер ещё не готов, попробуйте ещё раз';
  }
  return 'Spotify не ответил, попробуйте ещё раз';
}

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SpotifyStatus>('disabled');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isActiveHere, setIsActiveHere] = useState(false);
  const [playingElsewhere, setPlayingElsewhere] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [lastPlaylist, setLastPlaylist] = useState<SpotifyPlaylistItem | null>(null);
  const [activeHolds, setActiveHolds] = useState<SiteAudioId[]>([]);

  const playerRef = useRef<Spotify.Player | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const isActiveRef = useRef(false);
  const controllerRef = useRef<AutoPauseController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new AutoPauseController({
      isPlayingHere: () => isActiveRef.current && isPlayingRef.current,
      isActiveHere: () => isActiveRef.current,
      pause: () => playerRef.current?.pause() ?? Promise.resolve(),
      resume: () => playerRef.current?.resume() ?? Promise.resolve(),
    });
  }

  // Fatal: the player can't work until the user reconnects.
  const fail = useCallback((message: string) => {
    setStatus('error');
    setErrorMessage(message);
  }, []);

  // Transient: shown for a few seconds, the player stays usable.
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  const connectPlayer = useCallback(async (isCancelled: () => boolean): Promise<Spotify.Player | null> => {
    setStatus('connecting');
    setErrorMessage(null);
    await loadSdk();
    if (isCancelled()) return null;
    const player = new window.Spotify.Player({
      name: PLAYER_NAME,
      getOAuthToken: cb => {
        getValidAccessToken().then(token => {
          if (token) cb(token);
          else if (!loadTokens()) fail('Подключите Spotify заново');
          else showNotice('Нет связи со Spotify, пробуем ещё раз');
        });
      },
      volume: loadVolume(),
    });
    playerRef.current = player;

    player.addListener('ready', ({ device_id }) => {
      deviceIdRef.current = device_id;
      setStatus('ready');
      setErrorMessage(null);
      setNotice(null);
    });
    player.addListener('not_ready', () => { deviceIdRef.current = null; });
    player.addListener('player_state_changed', state => {
      if (!state) {
        if (isActiveRef.current && isPlayingRef.current) setPlayingElsewhere(true);
        isActiveRef.current = false;
        isPlayingRef.current = false;
        setIsActiveHere(false);
        setIsPlaying(false);
        return;
      }
      isActiveRef.current = true;
      isPlayingRef.current = !state.paused;
      setIsActiveHere(true);
      setIsPlaying(!state.paused);
      setPlayingElsewhere(false);
      const current = state.track_window.current_track;
      setTrack(current ? {
        name: current.name,
        artists: current.artists.map(a => a.name).join(', '),
        imageUrl: current.album.images[0]?.url ?? null,
      } : null);
    });
    player.addListener('initialization_error', () => fail('Браузер не поддерживает плеер Spotify'));
    player.addListener('authentication_error', () => { clearTokens(); fail('Подключите Spotify заново'); });
    player.addListener('account_error', () => fail('Нужен Spotify Premium'));
    player.addListener('autoplay_failed', () => { isPlayingRef.current = false; setIsPlaying(false); });

    player.connect();
    return player;
  }, [fail, showNotice]);

  useEffect(() => {
    if (!getSpotifyClientId()) return;
    setVolumeState(loadVolume());
    setLastPlaylist(loadLastPlaylist());
    if (!loadTokens()) {
      setStatus('disconnected');
      return;
    }
    let cancelled = false;
    let player: Spotify.Player | null = null;
    connectPlayer(() => cancelled).then(p => {
      player = p;
      if (cancelled) p?.disconnect();
    });
    return () => {
      cancelled = true;
      player?.disconnect();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [connectPlayer]);

  const withToken = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = await getValidAccessToken();
    // No token: login gone (401) or Spotify unreachable right now (0).
    if (!token) throw new SpotifyApiError(loadTokens() ? 0 : 401);
    return fn(token);
  }, []);

  const handleApiError = useCallback((e: unknown) => {
    if (e instanceof SpotifyApiError && e.status === 401) {
      clearTokens();
      fail(apiErrorMessage(e));
    } else if (e instanceof SpotifyApiError && e.status === 403) {
      fail(apiErrorMessage(e));
    } else {
      showNotice(apiErrorMessage(e));
    }
  }, [fail, showNotice]);

  const playPlaylist = useCallback(async (playlist: SpotifyPlaylistItem) => {
    const player = playerRef.current;
    const deviceId = deviceIdRef.current;
    if (!player || !deviceId) {
      showNotice('Плеер ещё не готов, попробуйте ещё раз');
      return;
    }
    await player.activateElement();
    try {
      await withToken(token => playContext(token, deviceId, playlist.uri));
      saveLastPlaylist(playlist);
      setLastPlaylist(playlist);
      controllerRef.current?.forgetPause();
    } catch (e) {
      handleApiError(e);
    }
  }, [handleApiError, showNotice, withToken]);

  // Explicit pause/resume instead of player.togglePlay(): auto-resume may already be in flight.
  const togglePlay = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    await player.activateElement();
    if (isActiveRef.current && isPlayingRef.current) {
      if (controllerRef.current?.activeHolds().length) controllerRef.current.forgetPause();
      await player.pause();
      return;
    }
    if (isActiveRef.current) {
      await player.resume();
      return;
    }
    const playlist = loadLastPlaylist();
    if (playlist) await playPlaylist(playlist);
  }, [playPlaylist]);

  const next = useCallback(async () => { await playerRef.current?.nextTrack(); }, []);
  const previous = useCallback(async () => { await playerRef.current?.previousTrack(); }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    saveVolume(v);
    playerRef.current?.setVolume(v);
  }, []);

  const search = useCallback(async (q: string) => {
    try {
      return await withToken(token => searchPlaylists(token, q));
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  }, [withToken]);

  const connect = useCallback(() => { startSpotifyLogin(); }, []);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;
    isActiveRef.current = false;
    isPlayingRef.current = false;
    clearTokens();
    setIsActiveHere(false);
    setIsPlaying(false);
    setPlayingElsewhere(false);
    setTrack(null);
    setErrorMessage(null);
    setStatus('disconnected');
  }, []);

  // Logging out from the admin page (another tab) removes the saved login.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SPOTIFY_AUTH_KEY && !e.newValue) disconnect();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [disconnect]);

  const holdSiteAudio = useCallback((id: SiteAudioId) => {
    controllerRef.current?.hold(id);
    setActiveHolds(controllerRef.current?.activeHolds() ?? []);
  }, []);

  const releaseSiteAudio = useCallback((id: SiteAudioId) => {
    controllerRef.current?.release(id);
    setActiveHolds(controllerRef.current?.activeHolds() ?? []);
  }, []);

  const value = useMemo<SpotifyContextValue>(() => ({
    status, errorMessage, notice, track, isPlaying, isActiveHere, playingElsewhere, volume, lastPlaylist, activeHolds,
    connect, disconnect, togglePlay, next, previous, setVolume, playPlaylist, search, holdSiteAudio, releaseSiteAudio,
  }), [
    status, errorMessage, notice, track, isPlaying, isActiveHere, playingElsewhere, volume, lastPlaylist, activeHolds,
    connect, disconnect, togglePlay, next, previous, setVolume, playPlaylist, search, holdSiteAudio, releaseSiteAudio,
  ]);

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

export function useSpotify(): SpotifyContextValue | null {
  return useContext(SpotifyContext);
}

export function useSiteAudioHold(id: SiteAudioId, active: boolean): void {
  const ctx = useContext(SpotifyContext);
  const hold = ctx?.holdSiteAudio;
  const release = ctx?.releaseSiteAudio;
  useEffect(() => {
    if (!active || !hold || !release) return;
    hold(id);
    return () => release(id);
  }, [active, hold, release, id]);
}
