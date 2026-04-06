// components/SlideshowOverlay.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { formatTime } from '@/lib/timer';

type Props = { url: string; timeLeft: number };

function parseDateFromUrl(url: string): string | null {
  const filename = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? '');
  console.log('[slideshow] filename:', filename);
  const match = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
  console.log('[slideshow] date match:', match);
  if (!match) return null;
  const [, day, month, year] = match;
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const monthName = months[parseInt(month, 10) - 1];
  if (!monthName) return null;
  return `${parseInt(day, 10)} ${monthName} ${year}`;
}

export function SlideshowOverlay({ url, timeLeft }: Props) {
  // Cross-fade: two image slots, alternating which is on top
  const [imgA, setImgA] = useState(url);
  const [imgB, setImgB] = useState('');
  const [showB, setShowB] = useState(false);
  const activeIsB = useRef(false);

  useEffect(() => {
    if (activeIsB.current) {
      // B is on top — load new photo into A and bring A up
      setImgA(url);
      setShowB(false);
      activeIsB.current = false;
    } else {
      // A is on top (or initial) — load new photo into B and bring B up
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
      {/* Image A */}
      <img
        src={imgA}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out ${showB ? 'opacity-0' : 'opacity-100'}`}
      />
      {/* Image B */}
      {imgB && (
        <img
          src={imgB}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-in-out ${showB ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Timer + date — centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-2">
        <div
          className="font-black text-white/85 tabular-nums tracking-[-2px]"
          style={textStyle}
        >
          {formatTime(timeLeft)}
        </div>
        {date && (
          <div
            className="font-black text-white/70 tracking-[-1px]"
            style={textStyle}
          >
            {date}
          </div>
        )}
      </div>
    </div>
  );
}
