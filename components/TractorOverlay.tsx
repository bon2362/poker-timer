'use client';

import { useEffect, useRef } from 'react';

type Props = {
  timeLeft: number;
  isPaused: boolean;
};

export default function TractorOverlay({ timeLeft: _timeLeft, isPaused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [isPaused]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 bg-black">
      <video
        ref={videoRef}
        src="/video/blind-300.mp4"
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
}
