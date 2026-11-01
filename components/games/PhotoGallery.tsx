'use client';
import { useEffect, useRef, useState } from 'react';
import type { GamePhoto } from '@/lib/games/queries';
export function PhotoGallery({ photos, date }: { photos: GamePhoto[]; date: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const touch = useRef<number | null>(null);
  const opened = index !== null;
  useEffect(() => {
    if (!opened) return;
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIndex(null);
      if (event.key === 'ArrowRight') setIndex(current => ((current ?? 0) + 1) % photos.length);
      if (event.key === 'ArrowLeft') setIndex(current => ((current ?? 0) - 1 + photos.length) % photos.length);
      if (event.key === 'Tab') {
        const buttons = close.current?.closest('[role="dialog"]')?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); trigger.current?.focus(); };
  }, [opened, photos.length]);
  const step = (delta: number) => setIndex(current => ((current ?? 0) + delta + photos.length) % photos.length);
  return <>
    <div className="columns-2 gap-2 lg:columns-4">{photos.map((photo, i) => <button key={photo.id} onClick={event => { trigger.current = event.currentTarget; setIndex(i); }} aria-label={`Открыть фото ${i + 1}`} className="mb-2 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-violet-400"><img src={photo.thumbUrl} alt={`Фото с вечера ${i + 1}`} width={photo.width ?? undefined} height={photo.height ?? undefined} loading="lazy" className="h-auto w-full transition-opacity hover:opacity-85 motion-reduce:transition-none" /></button>)}</div>
    {index !== null && <div role="dialog" aria-modal="true" aria-label="Фото с вечера" className="fixed inset-0 z-50 flex flex-col bg-[#0d0d0d] text-white" onTouchStart={event => { touch.current = event.touches[0].clientX; }} onTouchEnd={event => { if (touch.current !== null) { const delta = event.changedTouches[0].clientX - touch.current; if (Math.abs(delta) > 50) step(delta < 0 ? 1 : -1); touch.current = null; } }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-sm tabular-nums">{index + 1} / {photos.length}</span><span className="text-xs text-[#8a8a8a]">{date}</span><button ref={close} onClick={() => setIndex(null)} aria-label="Закрыть" className="h-11 w-11 rounded-full border border-[#333] bg-[#1a1a1a]">✕</button></div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center"><img src={photos[index].url} alt={`Фото с вечера ${index + 1}`} className="max-h-full w-full max-w-[880px] object-contain" /><button onClick={() => step(-1)} aria-label="Предыдущее фото" className="absolute left-2 h-12 w-12 rounded-full bg-black/55 text-xl">←</button><button onClick={() => step(1)} aria-label="Следующее фото" className="absolute right-2 h-12 w-12 rounded-full bg-black/55 text-xl">→</button></div>
      <p className="px-4 py-5 text-center text-xs text-[#8a8a8a]">Листайте свайпом или стрелками</p>
    </div>}
  </>;
}
