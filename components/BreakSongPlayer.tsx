'use client';
import { useEffect, useRef, useState } from 'react';

const BREAK_TRACK_SRC = '/audio/sweaty-hand.mp3';
const BREAK_SONG_PAUSED_KEY = 'pokerTimerBreakSongPaused';

type Props = {
  onStateChange?: (paused: boolean) => void;
};

export function BreakSongPlayer({ onStateChange }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const audio = new Audio(BREAK_TRACK_SRC);
    audio.loop = true;
    audioRef.current = audio;

    audio.play()
      .then(() => { if (cancelled) { audio.pause(); } })
      .catch(() => { if (!cancelled) { setPaused(true); onStateChange?.(true); } });

    return () => {
      cancelled = true;
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onStateChange?.(paused);
  }, [paused, onStateChange]);

  return null;
}

function loadPersistedPaused(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(BREAK_SONG_PAUSED_KEY) === 'true';
}

function savePersistedPaused(paused: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BREAK_SONG_PAUSED_KEY, String(paused));
}

export function useBreakSong(enabled: boolean): { songPaused: boolean; toggleSong: () => void; songTime: number } {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [songPaused, setSongPaused] = useState(loadPersistedPaused);
  const [songTime, setSongTime] = useState(0);
  const persistedPausedRef = useRef(songPaused);

  const setPausedPreference = (paused: boolean) => {
    persistedPausedRef.current = paused;
    setSongPaused(paused);
    savePersistedPaused(paused);
  };

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      setSongTime(0);
      return;
    }

    let cancelled = false;
    const audio = new Audio(BREAK_TRACK_SRC);
    audio.loop = true;
    audioRef.current = audio;
    setSongTime(0);

    const timeInterval = setInterval(() => {
      setSongTime(audio.currentTime || 0);
    }, 250);

    if (!persistedPausedRef.current) {
      audio.play()
        .then(() => { if (cancelled) audio.pause(); })
        .catch(() => { if (!cancelled) setPausedPreference(true); });
    } else {
      setSongPaused(true);
    }

    return () => {
      cancelled = true;
      clearInterval(timeInterval);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [enabled]);

  const toggleSong = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (songPaused) {
      audio.play().then(() => setPausedPreference(false)).catch(() => {});
    } else {
      audio.pause();
      setPausedPreference(true);
    }
  };

  return { songPaused, toggleSong, songTime };
}
