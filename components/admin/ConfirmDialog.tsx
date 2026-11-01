'use client';
import { useEffect, useRef } from 'react';
export function ConfirmDialog({ title, children, confirmLabel, busy, onConfirm, onClose }: { title: string; children: React.ReactNode; confirmLabel: string; busy?: boolean; onConfirm(): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (!element) return; if (typeof element.showModal === 'function') element.showModal(); else element.setAttribute('open', ''); }, []);
  return <dialog ref={dialog} className="fixed inset-0 z-50 m-auto w-[calc(100%-32px)] max-w-md rounded-xl border border-[#444] bg-[#242424] p-5 text-white backdrop:bg-black/70" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 className="text-lg font-semibold">{title}</h2><div className="mt-3 text-sm leading-relaxed text-[#aaa]">{children}</div>
    <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} disabled={busy} className="min-h-11 rounded-lg border border-[#444] px-4 text-sm disabled:opacity-50">Отмена</button><button onClick={onConfirm} disabled={busy} className="min-h-11 rounded-lg bg-red-800 px-4 text-sm font-semibold disabled:opacity-50">{busy ? 'Сохраняем…' : confirmLabel}</button></div>
  </dialog>;
}
