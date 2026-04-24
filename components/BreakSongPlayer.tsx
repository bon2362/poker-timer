'use client';
import { useEffect, useRef, useState } from 'react';

const BREAK_TRACK_SRC = '/audio/sweaty-hand.mp3';

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

export function useBreakSong(enabled: boolean): { songPaused: boolean; toggleSong: () => void } {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [songPaused, setSongPaused] = useState(false);

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      setSongPaused(false);
      return;
    }

    let cancelled = false;
    const audio = new Audio(BREAK_TRACK_SRC);
    audio.loop = true;
    audioRef.current = audio;
    setSongPaused(false);

    audio.play()
      .then(() => { if (cancelled) audio.pause(); })
      .catch(() => { if (!cancelled) setSongPaused(true); });

    return () => {
      cancelled = true;
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [enabled]);

  const toggleSong = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (songPaused) {
      audio.play().then(() => setSongPaused(false)).catch(() => {});
    } else {
      audio.pause();
      setSongPaused(true);
    }
  };

  return { songPaused, toggleSong };
}
