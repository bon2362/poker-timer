'use client';

import { useEffect, useRef } from 'react';

type Props = {
  timeLeft: number;
  isPaused: boolean;
};

export default function TractorOverlay({ timeLeft, isPaused }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = timeLeft <= 30;

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

  // Start video when showVideo becomes true; pause/resume with isPaused
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!showVideo) return;
    if (isPaused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [showVideo, isPaused]);

  // Stop video on unmount
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
    <>
      <audio ref={audioRef} src="/audio/tractor.mp3" loop />
      {/* Video overlay — z-20, below timer (z-30) and controls (z-30) */}
      <div className="fixed inset-0 z-20 bg-black">
        <video
          ref={videoRef}
          src="/video/tractor.mp4"
          loop
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-1000 ${
            showVideo ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </>
  );
}
