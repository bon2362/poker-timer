'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { GameProvider } from '@/context/GameContext';
import { TimerProvider } from '@/context/TimerContext';
import { MinuteTimerProvider } from '@/context/MinuteTimerContext';

const PokerTimer = dynamic(
  () => import('@/components/PokerTimer').then(m => ({ default: m.PokerTimer })),
  { ssr: false }
);

const MobileView = dynamic(
  () => import('@/components/MobileView').then(m => ({ default: m.MobileView })),
  { ssr: false }
);

export default function Home() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    // Mobile: narrow screen (portrait phone) — threshold 768px
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Avoid rendering until client-side check completes (prevent flash)
  if (isMobile === null) return null;

  return (
    <GameProvider>
      <TimerProvider>
        <MinuteTimerProvider>
          {isMobile ? <MobileView /> : <PokerTimer />}
        </MinuteTimerProvider>
      </TimerProvider>
    </GameProvider>
  );
}
