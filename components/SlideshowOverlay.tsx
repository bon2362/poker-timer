// components/SlideshowOverlay.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { formatTime } from '@/lib/timer';
import { getCurrentFinalSongLyric, getNextFinalSongLyric } from './FinalGameSlideshowOverlay';

type Props = {
  url: string;
  timeLeft: number;
  songTime?: number;
  showLyrics?: boolean;
};

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

export function SlideshowOverlay({ url, timeLeft, songTime, showLyrics }: Props) {
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
  const timerStyle = {
    fontSize: 'clamp(48px, 8vw, 96px)',
    textShadow: '0 2px 24px rgba(0,0,0,0.9)',
  };
  const dateStyle = {
    fontSize: 'clamp(16px, 2.6vw, 32px)',
    textShadow: '0 2px 16px rgba(0,0,0,0.9)',
  };

  const showLyricsBlock = showLyrics && typeof songTime === 'number';
  const lyric = showLyricsBlock ? getCurrentFinalSongLyric(songTime!) : null;
  const nextLyric = showLyricsBlock ? getNextFinalSongLyric(songTime!) : null;

  return (
    <div className="fixed inset-0 z-20 bg-black overflow-hidden">
      <Slot src={imgA} visible={!showB} />
      {imgB && <Slot src={imgB} visible={showB} />}

      {/* Timer + Date — top */}
      <div className="absolute top-10 inset-x-0 flex flex-col items-center pointer-events-none select-none">
        <div
          className="font-black text-white/85 tabular-nums tracking-[-2px]"
          style={timerStyle}
        >
          {formatTime(timeLeft)}
        </div>
        {date && (
          <div
            className="font-black text-white/70 tracking-[-1px] mt-1"
            style={dateStyle}
          >
            {date}
          </div>
        )}
      </div>

      {/* Lyrics — bottom */}
      {showLyricsBlock && lyric && (
        <div className="absolute inset-x-0 bottom-[88px] sm:bottom-[96px] flex flex-col items-center px-5 text-center pointer-events-none select-none">
          <div
            key={`${lyric.time}-${lyric.text}`}
            className="max-w-[980px] animate-[final-lyric-rise_500ms_ease-out] text-[26px] sm:text-[40px] lg:text-[56px] text-white font-black leading-[1.1] drop-shadow-[0_4px_28px_rgba(0,0,0,0.95)]"
          >
            {lyric.text}
          </div>
          {nextLyric && (
            <div
              key={`next-${nextLyric.time}`}
              className="mt-3 max-w-[980px] text-[18px] sm:text-[26px] lg:text-[36px] text-white/35 font-black leading-[1.1] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
            >
              {nextLyric.text}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes final-lyric-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
