'use client';

import { useEffect, useRef } from 'react';

type Props = {
  isPaused: boolean;
};

export default function TractorOverlay({ isPaused }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Start audio on mount, stop on unmount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  // Pause/resume audio when isPaused changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPaused) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPaused]);

  return <audio ref={audioRef} src="/audio/tractor.mp3" loop />;
}
