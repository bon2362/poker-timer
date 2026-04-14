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
  { time: 16.1, section: 'Verse 1', text: 'Тусклый свет кухни' },
  { time: 19.4, text: 'Карты липнут к рукам' },
  { time: 22.8, text: 'Саша шепчет "пас", мимо' },
  { time: 25, text: 'Мима ловит свой шанс' },
  { time: 29.3, text: 'Лёша вяло кидает' },
  { time: 32.3, text: 'Фишки прямо в центр' },
  { time: 36.2, text: 'Паша круто победный взгляд' },
  { time: 38.9, text: 'Словно главный в этой сцене' },
  { time: 43.3, section: 'Chorus', text: 'Потная раздача, бьётся в тишине' },
  { time: 50.0, text: 'Кто-то улыбается, кто-то тонет в вине' },
  { time: 56.6, text: 'Мы друзья за столом, но сейчас игра' },
  { time: 63.2, text: 'И у каждого своя тайная рука' },
  { time: 70.8, section: 'Verse 2', text: 'Катя тянет до ривера' },
  { time: 73.5, text: 'Флеш-дро дышит в груди' },
  { time: 77.4, text: 'Вова давит на все кнопки' },
  { time: 79.8, text: 'Словно может судьбу обойти' },
  { time: 83.8, text: 'Тома терпит, считает' },
  { time: 86.8, text: 'Каждый жест, каждый вдох' },
  { time: 89.9, text: 'Клочкова громко хохочет' },
  { time: 92.5, text: 'Скидывает королей под вздох' },
  { time: 98.1, section: 'Chorus', text: 'Потная раздача, бьётся в тишине' },
  { time: 104.7, text: 'Кто-то улыбается, кто-то тонет в вине' },
  { time: 110.9, text: 'Мы друзья за столом, но сейчас игра' },
  { time: 117.5, text: 'И у каждого своя тайная рука' },
  { time: 124.4, section: 'Verse 3', text: 'Варя ловит две пары' },
  { time: 127.6, text: 'Алиса верит в стрит' },
  { time: 130.6, text: 'Катя смотрит устало' },
  { time: 133.9, text: 'Но не может уйти' },
  { time: 137.4, text: 'Паша ставит полбанка' },
  { time: 140.6, text: 'Лёша жмёт "кол" сквозь страх' },
  { time: 143.9, text: 'Саша вылетел тихо' },
  { time: 146.4, text: 'Только кружка дрожит в руках' },
  { time: 151, section: 'Bridge', text: 'Мима удвоился с тузами (эй)' },
  { time: 154.7, text: 'Тома вытащил фул-хаус в конце' },
  { time: 157.1, text: 'Катя плачет над сброшенным флэшем' },
  { time: 160.3, text: 'Вова шутит, но пусто в глазе' },
  { time: 163.7, text: 'Кто-то встал, ушёл на балкон' },
  { time: 166.7, text: 'Кто-то ждёт новый раунд как сон' },
  { time: 169.9, text: 'И пока фишки падают в пот' },
  { time: 173.4, text: 'Нас сближает этот вечный счёт' },
  { time: 178.9, section: 'Chorus', text: 'Потная раздача, бьётся в тишине' },
  { time: 185.4, text: 'Кто-то улыбается, кто-то тонет в вине' },
  { time: 191.7, text: 'Мы друзья за столом, но сейчас игра' },
  { time: 198, text: 'И у каждого своя тайная рука' },
  { time: 206, section: 'Outro', text: 'Алый маркер на скатерти' },
  { time: 209.1, text: 'Хохот, зевота, коньяк' },
  { time: 212.3, text: 'Завтра снова забудем обиды' },
  { time: 215.4, text: 'А сегодня решает только флаг в картах' },
];

export function getCurrentFinalSongLyric(currentTime: number): LyricCue {
  let active = FINAL_SONG_LYRICS[0];
  for (const cue of FINAL_SONG_LYRICS) {
    if (cue.time > currentTime) break;
    active = cue;
  }
  return active;
}

export function getNextFinalSongLyric(currentTime: number): LyricCue | null {
  for (let i = 0; i < FINAL_SONG_LYRICS.length - 1; i++) {
    if (FINAL_SONG_LYRICS[i].time <= currentTime && FINAL_SONG_LYRICS[i + 1].time > currentTime) {
      return FINAL_SONG_LYRICS[i + 1];
    }
  }
  return null;
}

type Props = {
  urls: string[];
  controlsVisible: boolean;
  onFinish: () => void;
  finishLabel?: string;
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

export function FinalGameSlideshowOverlay({ urls, controlsVisible, onFinish, finishLabel = 'Завершить' }: Props) {
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
    let cancelled = false;
    const audio = new Audio(FINAL_TRACK_SRC);
    audio.loop = true;
    audioRef.current = audio;

    const timeInterval = setInterval(() => {
      setSongTime(audio.currentTime || 0);
    }, 250);

    audio.play()
      .then(() => { if (cancelled) { audio.pause(); return; } setAudioBlocked(false); })
      .catch(() => { if (!cancelled) setAudioBlocked(true); });

    return () => {
      cancelled = true;
      clearInterval(timeInterval);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const resumeAudio = () => {
    audioRef.current?.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  };

  const lyric = getCurrentFinalSongLyric(songTime);
  const nextLyric = getNextFinalSongLyric(songTime);
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
        {finishLabel}
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
