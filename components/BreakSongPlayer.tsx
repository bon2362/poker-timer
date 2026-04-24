'use client';
import { useEffect, useRef, useState } from 'react';

const BREAK_TRACK_SRC = '/audio/sweaty-hand.mp3';

export function BreakSongPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const resumeAudio = () => {
    audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  if (!audioBlocked) return null;

  return (
    <button
      onClick={resumeAudio}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-lg border border-white/25 bg-black/60 px-4 py-2 text-[13px] text-white/80 backdrop-blur-sm cursor-pointer hover:border-white/45 hover:text-white"
    >
      🎵 Нажмите, чтобы включить музыку
    </button>
  );
}
