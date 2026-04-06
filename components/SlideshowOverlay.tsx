// components/SlideshowOverlay.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { formatTime } from '@/lib/timer';

type Props = { url: string; timeLeft: number };

function parseDateFromUrl(url: string): string | null {
  const filename = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '');
  const match = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const monthName = months[parseInt(month, 10) - 1];
  if (!monthName) return null;
  return `${parseInt(day, 10)} ${monthName} ${year}`;
}

type SlotProps = { src: string; visible: boolean };

/** Один слот: размытый фон + полное фото поверх, с fade-переходом */
function Slot({ src, visible }: SlotProps) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Размытый фон из того же фото */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-50"
      />
      {/* Полное фото по центру */}
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-contain"
      />
    </div>
  );
}

export function SlideshowOverlay({ url, timeLeft }: Props) {
  // Cross-fade: два слота, чередуем какой сверху
  const [imgA, setImgA] = useState(url);
  const [imgB, setImgB] = useState('');
  const [showB, setShowB] = useState(false);
  const activeIsB = useRef(false);

  useEffect(() => {
    if (activeIsB.current) {
      setImgA(url);
      setShowB(false);
      activeIsB.current = false;
    } else {
      setImgB(url);
      setShowB(true);
      activeIsB.current = true;
    }
  }, [url]);

  const activeUrl = showB ? imgB : imgA;
  const date = parseDateFromUrl(activeUrl);
  const textStyle = {
    fontSize: 'clamp(48px, 8vw, 96px)',
    textShadow: '0 2px 24px rgba(0,0,0,0.9)',
  };

  return (
    <div className="fixed inset-0 z-20 bg-black overflow-hidden">
      <Slot src={imgA} visible={!showB} />
      {imgB && <Slot src={imgB} visible={showB} />}

      {/* Timer — top */}
      <div className="absolute top-10 inset-x-0 flex justify-center pointer-events-none select-none">
        <div
          className="font-black text-white/85 tabular-nums tracking-[-2px]"
          style={textStyle}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Date — bottom */}
      {date && (
        <div className="absolute bottom-16 inset-x-0 flex justify-center pointer-events-none select-none">
          <div
            className="font-black text-white/70 tracking-[-1px]"
            style={textStyle}
          >
            {date}
          </div>
        </div>
      )}
    </div>
  );
}
