// components/FinalGameSlideshowOverlay.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const FINAL_TRACK_SRC = '/audio/sweaty-hand.mp3';

type LyricCue = {
  time: number;
  section?: string;
  text: string;
};

export const FINAL_SONG_LYRICS: LyricCue[] = [
  { time: 0, section: 'Verse 1', text: 'Тусклый свет кухни' },
  { time: 4, text: 'Карты липнут к рукам' },
  { time: 8, text: 'Саша шепчет "пас", мимо' },
  { time: 12, text: 'Мима ловит свой шанс' },
  { time: 16, text: 'Лёша вяло кидает' },
  { time: 20, text: 'Фишки прямо в центр' },
  { time: 24, text: 'Паша круто победный взгляд' },
  { time: 28, text: 'Словно главный в этой сцене' },
  { time: 34, section: 'Chorus', text: 'Потная раздача, бьётся в тишине' },
  { time: 39, text: 'Кто-то улыбается, кто-то тонет в вине' },
  { time: 44, text: 'Мы друзья за столом, но сейчас игра' },
  { time: 49, text: 'И у каждого своя тайная рука' },
  { time: 56, section: 'Verse 2', text: 'Катя тянет до ривера' },
  { time: 60, text: 'Флеш-дро дышит в груди' },
  { time: 64, text: 'Вова давит на все кнопки' },
  { time: 68, text: 'Словно может судьбу обойти' },
  { time: 72, text: 'Тома терпит, считает' },
  { time: 76, text: 'Каждый жест, каждый вдох' },
  { time: 80, text: 'Клочкова громко хохочет' },
  { time: 84, text: 'Скидывает королей под вздох' },
  { time: 90, section: 'Chorus', text: 'Потная раздача, бьётся в тишине' },
  { time: 95, text: 'Кто-то улыбается, кто-то тонет в вине' },
  { time: 100, text: 'Мы друзья за столом, но сейчас игра' },
  { time: 105, text: 'И у каждого своя тайная рука' },
  { time: 112, section: 'Verse 3', text: 'Варя ловит две пары' },
  { time: 116, text: 'Алиса верит в стрит' },
  { time: 120, text: 'Катя смотрит устало' },
  { time: 124, text: 'Но не может уйти' },
  { time: 128, text: 'Паша ставит полбанка' },
  { time: 132, text: 'Лёша жмёт "кол" сквозь страх' },
  { time: 136, text: 'Саша вылетел тихо' },
  { time: 140, text: 'Только кружка дрожит в руках' },
  { time: 147, section: 'Bridge', text: 'Мима удвоился с тузами (эй)' },
  { time: 151, text: 'Тома вытащил фул-хаус в конце' },
  { time: 155, text: 'Катя плачет над сброшенным флэшем' },
  { time: 159, text: 'Вова шутит, но пусто в глазе' },
  { time: 164, text: 'Кто-то встал, ушёл на балкон' },
  { time: 168, text: 'Кто-то ждёт новый раунд как сон' },
  { time: 172, text: 'И пока фишки падают в пот' },
  { time: 176, text: 'Нас сближает этот вечный счёт' },
  { time: 184, section: 'Chorus', text: 'Потная раздача, бьётся в тишине' },
  { time: 189, text: 'Кто-то улыбается, кто-то тонет в вине' },
  { time: 194, text: 'Мы друзья за столом, но сейчас игра' },
  { time: 199, text: 'И у каждого своя тайная рука' },
  { time: 205, section: 'Outro', text: 'Алый маркер на скатерти' },
  { time: 209, text: 'Хохот, зевота, коньяк' },
  { time: 213, text: 'Завтра снова забудем обиды' },
  { time: 217, text: 'А сегодня решает только флаг в картах' },
];

export function getCurrentFinalSongLyric(currentTime: number): LyricCue {
  let active = FINAL_SONG_LYRICS[0];
  for (const cue of FINAL_SONG_LYRICS) {
    if (cue.time > currentTime) break;
    active = cue;
  }
  return active;
}

type Props = {
  urls: string[];
  controlsVisible: boolean;
  onFinish: () => void;
};

type SlotProps = { src: string; visible: boolean };

function Slot({ src, visible }: SlotProps) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-[2000ms] ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-[0.35]"
      />
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-contain"
      />
    </div>
  );
}

function shuffleIndexes(length: number): number[] {
  const idxs = Array.from({ length }, (_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs;
}

export function FinalGameSlideshowOverlay({ urls, controlsVisible, onFinish }: Props) {
  const [imgA, setImgA] = useState(urls[0] ?? '');
  const [imgB, setImgB] = useState('');
  const [showB, setShowB] = useState(false);
  const [songTime, setSongTime] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const shuffledIndexes = useMemo(() => shuffleIndexes(urls.length), [urls]);
  const indexRef = useRef(0);
  const activeIsB = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (urls.length === 0) return;
    indexRef.current = 0;
    const firstUrl = urls[shuffledIndexes[0] ?? 0];
    setImgA(firstUrl);
    setImgB('');
    setShowB(false);
    activeIsB.current = false;
  }, [shuffledIndexes, urls]);

  useEffect(() => {
    if (urls.length <= 1) return;
    const intervalId = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % shuffledIndexes.length;
      const nextUrl = urls[shuffledIndexes[indexRef.current]];
      if (activeIsB.current) {
        setImgA(nextUrl);
        setShowB(false);
        activeIsB.current = false;
      } else {
        setImgB(nextUrl);
        setShowB(true);
        activeIsB.current = true;
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [shuffledIndexes, urls]);

  useEffect(() => {
    const audio = new Audio(FINAL_TRACK_SRC);
    audio.loop = true;
    audioRef.current = audio;

    const timeInterval = setInterval(() => {
      setSongTime(audio.currentTime || 0);
    }, 250);

    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));

    return () => {
      clearInterval(timeInterval);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const resumeAudio = () => {
    audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  const lyric = getCurrentFinalSongLyric(songTime);
  const hasImages = urls.length > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black overflow-hidden" onClick={audioBlocked ? resumeAudio : undefined}>
      {hasImages ? (
        <>
          <Slot src={imgA} visible={!showB} />
          {imgB && <Slot src={imgB} visible={showB} />}
        </>
      ) : (
        <div className="absolute inset-0 bg-[#050505]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/80 pointer-events-none" />

      <div className="absolute inset-x-0 top-8 flex justify-center px-5 pointer-events-none select-none">
        <div className="text-[11px] sm:text-[12px] font-semibold uppercase text-white/55">
          Финальная раздача
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[88px] sm:bottom-[96px] flex flex-col items-center px-5 text-center pointer-events-none select-none">
        {lyric.section && (
          <div className="mb-3 text-[12px] sm:text-[13px] font-bold uppercase text-yellow-300/80">
            {lyric.section}
          </div>
        )}
        <div
          key={`${lyric.time}-${lyric.text}`}
          className="max-w-[980px] animate-[final-lyric-rise_500ms_ease-out] text-[34px] sm:text-[56px] lg:text-[82px] text-white font-black leading-[1.08] drop-shadow-[0_4px_28px_rgba(0,0,0,0.95)]"
        >
          {lyric.text}
        </div>
        {audioBlocked && (
          <div className="mt-5 text-[14px] text-white/70">
            Нажмите на экран, чтобы включить музыку
          </div>
        )}
      </div>

      <button
        onClick={onFinish}
        className={`absolute right-6 bottom-6 z-10 rounded-lg border border-white/25 bg-black/45 px-6 py-3 text-[15px] font-semibold text-white/75 backdrop-blur-sm cursor-pointer transition-opacity duration-300 hover:border-white/45 hover:text-white ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        Завершить
      </button>

      <style>{`
        @keyframes final-lyric-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
