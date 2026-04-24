'use client';
import { useEffect, useRef, useState } from 'react';

const BREAK_TRACK_SRC = '/audio/sweaty-hand.mp3';

export function BreakSongPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const audio = new Audio(BREAK_TRACK_SRC);
    audio.loop = true;
    audioRef.current = audio;

    audio.play()
      .then(() => { if (cancelled) { audio.pause(); return; } setAudioBlocked(false); })
      .catch(() => { if (!cancelled) setAudioBlocked(true); });

    return () => {
      cancelled = true;
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioBlocked) {
      audio.play().then(() => { setAudioBlocked(false); setPaused(false); }).catch(() => {});
      return;
    }
    if (paused) {
      audio.play().then(() => setPaused(false)).catch(() => {});
    } else {
      audio.pause();
      setPaused(true);
    }
  };

  const isPlaying = !paused && !audioBlocked;

  return (
    <button
      onClick={toggle}
      title={isPlaying ? 'Пауза музыки' : 'Включить музыку'}
      className="fixed bottom-[72px] right-6 z-30 flex items-center gap-2 rounded-lg border border-white/20 bg-black/50 px-4 py-2 text-[13px] text-white/70 backdrop-blur-sm cursor-pointer hover:border-white/40 hover:text-white transition-colors"
    >
      {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Пауза' : 'Музыка'}
    </button>
  );
}
