'use client';
import { useEffect, useRef, useState } from 'react';
import { TimerDisplay } from './TimerDisplay';
import type { Stage } from '@/types/timer';

type Props = {
  imageUrl: string;
  playerName: string;
  timeLeft: number;
  stage: Stage;
  isPaused: boolean;
  onClose: () => void;
};

export function LoserImageOverlay({ imageUrl, playerName, timeLeft, stage, isPaused, onClose }: Props) {
  const [skipVisible, setSkipVisible] = useState(false);
  const hideSkipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const closeTimer = setTimeout(onClose, 30000);
    return () => clearTimeout(closeTimer);
  }, [onClose]);

  useEffect(() => {
    function showSkip() {
      setSkipVisible(true);
      if (hideSkipRef.current) clearTimeout(hideSkipRef.current);
      hideSkipRef.current = setTimeout(() => setSkipVisible(false), 2500);
    }

    document.addEventListener('mousemove', showSkip);
    return () => {
      document.removeEventListener('mousemove', showSkip);
      if (hideSkipRef.current) clearTimeout(hideSkipRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black">
      <img
        src={imageUrl}
        alt={`Проигравший: ${playerName}`}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <TimerDisplay timeLeft={timeLeft} stage={stage} isPaused={isPaused} />
      </div>

      <button
        onClick={onClose}
        className={`fixed right-8 top-8 z-20 rounded-lg border border-white/30 bg-black/45 px-5 py-2 text-[14px] font-semibold text-white backdrop-blur-sm transition-opacity hover:border-white/60 hover:bg-black/60 ${
          skipVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        Пропустить
      </button>
    </div>
  );
}
