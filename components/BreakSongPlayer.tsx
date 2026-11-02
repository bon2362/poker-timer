'use client';
import { useEffect, useRef, useState } from 'react';
import { Fader } from '@/lib/fader';

const BREAK_TRACK_SRC = '/audio/sweaty-hand.mp3';
const BREAK_SONG_PAUSED_KEY = 'pokerTimerBreakSongPaused';
const START_FADE_MS = 2000;
const UNMUTE_FADE_MS = 400;

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

// gain/rampMs: how loud the song should be right now while the timer speaks (see lib/musicDuck).
export function useBreakSong(enabled: boolean, gain = 1, rampMs = 0): { songPaused: boolean; songPlaying: boolean; toggleSong: () => void; songTime: number } {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<Fader | null>(null);
  if (!fadeRef.current) fadeRef.current = new Fader(v => { if (audioRef.current) audioRef.current.volume = v; }, 0);
  const gainRef = useRef(gain);
  gainRef.current = gain;
  const [songPaused, setSongPaused] = useState(loadPersistedPaused);
  // True only once the browser actually started the song (autoplay may be blocked).
  const [songPlaying, setSongPlaying] = useState(false);
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
      setSongPlaying(false);
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

    const fade = fadeRef.current;
    fade?.setNow(0);
    if (!persistedPausedRef.current) {
      audio.play()
        .then(() => {
          if (cancelled) { audio.pause(); return; }
          setSongPlaying(true);
          fade?.rampTo(gainRef.current, START_FADE_MS);
        })
        .catch(() => { if (!cancelled) setPausedPreference(true); });
    } else {
      setSongPaused(true);
    }

    return () => {
      cancelled = true;
      clearInterval(timeInterval);
      fade?.setNow(0);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      setSongPlaying(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (audioRef.current && !audioRef.current.paused) fadeRef.current?.rampTo(gain, rampMs);
  }, [gain, rampMs]);

  useEffect(() => () => fadeRef.current?.dispose(), []);

  const toggleSong = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (songPaused) {
      fadeRef.current?.setNow(0);
      audio.play().then(() => {
        setPausedPreference(false);
        setSongPlaying(true);
        fadeRef.current?.rampTo(gainRef.current, UNMUTE_FADE_MS);
      }).catch(() => {});
    } else {
      audio.pause();
      setPausedPreference(true);
      setSongPlaying(false);
    }
  };

  return { songPaused, songPlaying, toggleSong, songTime };
}
