// components/SlideshowOverlay.tsx
'use client';
import { formatTime } from '@/lib/timer';

type Props = { url: string; timeLeft: number };

export function SlideshowOverlay({ url, timeLeft }: Props) {
  return (
    <div className="fixed inset-0 z-20 bg-black">
      <style>{`
        @keyframes slideshow-fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
      <img
        key={url}
        src={url}
        alt=""
        className="w-full h-full object-cover"
        style={{ animation: 'slideshow-fade 0.6s ease' }}
      />
      <div
        className="absolute bottom-6 left-8 font-black text-white/85 tabular-nums tracking-[-2px] pointer-events-none select-none"
        style={{ fontSize: 'clamp(48px, 8vw, 96px)', textShadow: '0 2px 16px rgba(0,0,0,0.8)' }}
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
}
