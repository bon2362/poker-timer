'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearTokens, getSpotifyClientId, SPOTIFY_AUTH_KEY, getValidAccessToken, loadTokens, startSpotifyLogin } from '@/lib/spotify/auth';
import { playContext, searchPlaylists, setShuffle, SpotifyApiError, type SpotifyPlaylistItem } from '@/lib/spotify/api';
import { loadLastPlaylist, loadVolume, saveLastPlaylist, saveVolume } from '@/lib/spotify/storage';
import { AutoPauseController, type SiteAudioId } from '@/lib/spotify/autoPause';
import type { SpotifyProgress } from '@/lib/spotify/progress';
import { Fader } from '@/lib/fader';

// Spotify fades out before an auto-pause and back in after the auto-resume.
const HOLD_FADE_OUT_MS = 2000;
const HOLD_FADE_IN_MS = 3000;
const USER_PLAY_FADE_MS = 400;

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
const PLAYER_NAME = 'Poker Timer';

export type SpotifyStatus = 'disabled' | 'disconnected' | 'connecting' | 'ready' | 'error';
export type SpotifyTrack = { name: string; artists: string; imageUrl: string | null };

export type SpotifyContextValue = {
  status: SpotifyStatus;
  errorMessage: string | null;
  notice: string | null;
  track: SpotifyTrack | null;
  nextTrack: SpotifyTrack | null;
  progress: SpotifyProgress | null;
  isPlaying: boolean;
  shuffle: boolean;
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
  seek(positionMs: number): Promise<void>;
  toggleShuffle(): Promise<void>;
  setVolume(v: number): void;
  playPlaylist(p: SpotifyPlaylistItem): Promise<void>;
  search(q: string): Promise<SpotifyPlaylistItem[]>;
  /** Lowers or restores Spotify while the timer speaks (gain 0..1 on top of the user's volume). */
  duckMusic(gain: number, rampMs: number): void;
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

function toTrack(t: Spotify.Track | null | undefined): SpotifyTrack | null {
  if (!t) return null;
  return { name: t.name, artists: t.artists.map(a => a.name).join(', '), imageUrl: t.album.images[0]?.url ?? null };
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
  const [nextTrack, setNextTrack] = useState<SpotifyTrack | null>(null);
  const [progress, setProgress] = useState<SpotifyProgress | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffleState] = useState(false);
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
  const volumeRef = useRef(0.5);
  const holdFaderRef = useRef<Fader | null>(null);
  const duckFaderRef = useRef<Fader | null>(null);

  // What the player actually plays at: the user's volume, lowered by auto-pause and timer phrases.
  const effectiveVolume = () => volumeRef.current * (holdFaderRef.current?.value ?? 1) * (duckFaderRef.current?.value ?? 1);
  const applyVolume = () => { playerRef.current?.setVolume(effectiveVolume()).catch(() => {}); };

  if (!holdFaderRef.current) holdFaderRef.current = new Fader(applyVolume);
  if (!duckFaderRef.current) duckFaderRef.current = new Fader(applyVolume);

  if (!controllerRef.current) {
    const holdFader = holdFaderRef.current;
    controllerRef.current = new AutoPauseController({
      isPlayingHere: () => isActiveRef.current && isPlayingRef.current,
      isActiveHere: () => isActiveRef.current,
      // A release during the fade-out cancels it, and then there is nothing to pause.
      pause: async () => { if (await holdFader.rampTo(0, HOLD_FADE_OUT_MS)) await playerRef.current?.pause(); },
      resume: async () => {
        await playerRef.current?.resume();
        await holdFader.rampTo(1, HOLD_FADE_IN_MS);
      },
    });
  }

  useEffect(() => () => {
    holdFaderRef.current?.dispose();
    duckFaderRef.current?.dispose();
  }, []);

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
      volume: effectiveVolume(),
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
        setNextTrack(null);
        setProgress(null);
        return;
      }
      isActiveRef.current = true;
      isPlayingRef.current = !state.paused;
      setIsActiveHere(true);
      setIsPlaying(!state.paused);
      setShuffleState(state.shuffle);
      setPlayingElsewhere(false);
      setTrack(toTrack(state.track_window.current_track));
      setNextTrack(toTrack(state.track_window.next_tracks[0]));
      setProgress({ position: state.position, duration: state.duration, at: Date.now() });
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
    volumeRef.current = loadVolume();
    setVolumeState(volumeRef.current);
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
      holdFaderRef.current?.rampTo(1, USER_PLAY_FADE_MS);
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
      holdFaderRef.current?.rampTo(1, USER_PLAY_FADE_MS);
      await player.resume();
      return;
    }
    const playlist = loadLastPlaylist();
    if (playlist) await playPlaylist(playlist);
  }, [playPlaylist]);

  const next = useCallback(async () => { await playerRef.current?.nextTrack(); }, []);
  const previous = useCallback(async () => { await playerRef.current?.previousTrack(); }, []);

  // Moves the shown position right away; Spotify confirms with the next state change.
  const seek = useCallback(async (positionMs: number) => {
    const player = playerRef.current;
    if (!player || !isActiveRef.current) return;
    setProgress(p => p && { ...p, position: positionMs, at: Date.now() });
    await player.seek(positionMs);
  }, []);

  // Shows the new state right away; on failure the button goes back.
  const toggleShuffle = useCallback(async () => {
    const deviceId = deviceIdRef.current;
    if (!deviceId || !isActiveRef.current) return;
    const nextState = !shuffle;
    setShuffleState(nextState);
    try {
      await withToken(token => setShuffle(token, deviceId, nextState));
    } catch (e) {
      setShuffleState(!nextState);
      handleApiError(e);
    }
  }, [shuffle, handleApiError, withToken]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    saveVolume(v);
    volumeRef.current = v;
    applyVolume();
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
    holdFaderRef.current?.setNow(1);
    setIsActiveHere(false);
    setIsPlaying(false);
    setPlayingElsewhere(false);
    setTrack(null);
    setNextTrack(null);
    setProgress(null);
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

  const duckMusic = useCallback((gain: number, rampMs: number) => {
    duckFaderRef.current?.rampTo(gain, rampMs);
  }, []);

  const holdSiteAudio = useCallback((id: SiteAudioId) => {
    controllerRef.current?.hold(id);
    setActiveHolds(controllerRef.current?.activeHolds() ?? []);
  }, []);

  const releaseSiteAudio = useCallback((id: SiteAudioId) => {
    controllerRef.current?.release(id);
    setActiveHolds(controllerRef.current?.activeHolds() ?? []);
  }, []);

  const value = useMemo<SpotifyContextValue>(() => ({
    status, errorMessage, notice, track, nextTrack, progress, isPlaying, shuffle, isActiveHere, playingElsewhere, volume, lastPlaylist, activeHolds,
    connect, disconnect, togglePlay, next, previous, seek, toggleShuffle, setVolume, playPlaylist, search, duckMusic, holdSiteAudio, releaseSiteAudio,
  }), [
    status, errorMessage, notice, track, nextTrack, progress, isPlaying, shuffle, isActiveHere, playingElsewhere, volume, lastPlaylist, activeHolds,
    connect, disconnect, togglePlay, next, previous, seek, toggleShuffle, setVolume, playPlaylist, search, duckMusic, holdSiteAudio, releaseSiteAudio,
  ]);

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

export function useSpotify(): SpotifyContextValue | null {
  return useContext(SpotifyContext);
}

export function useSpotifyDuck(gain: number, rampMs: number): void {
  const duck = useContext(SpotifyContext)?.duckMusic;
  useEffect(() => { duck?.(gain, rampMs); }, [duck, gain, rampMs]);
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
