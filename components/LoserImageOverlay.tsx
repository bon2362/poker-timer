'use client';
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/timer';
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
  const isBreak = stage.type === 'break';
  const isOvertime = timeLeft < 0;
  const isWarning = timeLeft <= 60 && timeLeft >= 0 && !isBreak;

  const timerColor = isOvertime
    ? 'text-red-500'
    : isWarning
    ? 'text-orange-400'
    : isBreak
    ? 'text-blue-400'
    : 'text-white';

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

      <div className="fixed right-6 top-5 z-20 flex items-center gap-5 sm:right-8">
        <div
          className={`font-black tabular-nums leading-none ${timerColor} ${isPaused ? 'opacity-60' : 'opacity-95'}`}
          style={{ fontSize: '42px', textShadow: '0 2px 18px rgba(0,0,0,0.75)' }}
        >
          {formatTime(timeLeft)}
        </div>
        <button
          onClick={onClose}
          className={`bg-transparent border-none text-[#777] text-[15px] font-semibold cursor-pointer p-2 transition-opacity duration-500 hover:text-[#aaa] leading-none ${
            skipVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
