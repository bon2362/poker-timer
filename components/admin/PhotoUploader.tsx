'use client';
import { useEffect, useRef, useState } from 'react';
import { uploadPhoto } from '@/lib/admin/photoUpload';
import { remainingLabel } from '@/lib/admin/types';
type Entry = { file: File; status: 'queued' | 'uploading' | 'done' | 'error'; progress: number; error?: string; preview?: string };
const statusClass = { done: 'text-green-400', error: 'text-red-400', queued: 'text-[#aaa]', uploading: 'text-[#aaa]' };
const barClass = {
  done: '[&::-webkit-progress-value]:bg-green-400 [&::-moz-progress-bar]:bg-green-400',
  error: '[&::-webkit-progress-value]:bg-red-700 [&::-moz-progress-bar]:bg-red-700',
  queued: '[&::-webkit-progress-value]:bg-violet-500 [&::-moz-progress-bar]:bg-violet-500',
  uploading: '[&::-webkit-progress-value]:bg-violet-500 [&::-moz-progress-bar]:bg-violet-500',
};
const previewOf = (file: File) => typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined;
export function PhotoUploader({ sessionId, onUploaded, empty = true, photoCount }: { sessionId: string; onUploaded(): void; empty?: boolean; photoCount?: number }) {
  const [entries, setEntries] = useState<Entry[]>([]); const [busy, setBusy] = useState(false); const input = useRef<HTMLInputElement>(null); const active = useRef(false); const started = useRef(0); const running = useRef<number[]>([]); const previews = useRef(new Set<string>());
  useEffect(() => { const urls = previews.current; return () => urls.forEach(url => URL.revokeObjectURL(url)); }, []);
  function patch(index: number, updates: Partial<Entry>) { setEntries(rows => rows.map((row, i) => i === index ? { ...row, ...updates } : row)); }
  async function run(rows: Entry[], indices: number[]) {
    if (active.current) return; active.current = true; setBusy(true); setEntries(rows); started.current = Date.now(); running.current = indices;
    let cursor = 0; let uploaded = false;
    await Promise.all(Array.from({ length: Math.min(3, indices.length) }, async () => {
      while (cursor < indices.length) {
        const index = indices[cursor++]; patch(index, { status: 'uploading', error: undefined, progress: 0 });
        try { await uploadPhoto(rows[index].file, sessionId, percent => patch(index, { progress: percent })); patch(index, { status: 'done', progress: 100 }); uploaded = true; }
        catch (e) { patch(index, { status: 'error', error: (e as Error).message || 'Не удалось загрузить фото. Попробуйте ещё раз.' }); }
      }
    }));
    active.current = false; setBusy(false); if (uploaded) onUploaded();
  }
  function add(files: File[]) {
    if (!files.length || active.current) return;
    const added = files.map(file => { const preview = previewOf(file); if (preview) previews.current.add(preview); return { file, status: 'queued' as const, progress: 0, preview }; });
    void run([...entries, ...added], files.map((_, i) => entries.length + i));
  }
  const fraction = running.current.length ? running.current.reduce((sum, index) => sum + (entries[index]?.status === 'error' ? 100 : entries[index]?.progress ?? 0), 0) / (running.current.length * 100) : 0;
  const remaining = busy ? remainingLabel(Date.now() - started.current, fraction) : '';
  const pending = entries.filter(entry => entry.preview && (entry.status === 'queued' || entry.status === 'uploading'));
  return <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(Array.from(e.dataTransfer.files)); }}>
    <input aria-label="Загрузить фото" ref={input} type="file" multiple accept="image/*" className="hidden" disabled={busy} onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    <div className="flex items-center justify-between gap-2">{photoCount !== undefined && <h2 className="text-[11px] tracking-[2px] text-[#888]">ФОТО ({photoCount})</h2>}<button onClick={() => input.current?.click()} disabled={busy} className="min-h-10 rounded-lg bg-violet-700 px-4 text-sm font-semibold disabled:opacity-50">+ Загрузить фото</button></div>
    <p className="my-3 rounded-lg bg-[#242424] p-3 text-xs leading-relaxed text-[#999]">Эти фото показываются на странице игры и в карусели на паузе таймера.</p>
    {empty && <div className="mb-3 rounded-lg border border-dashed border-[#3a3a3a] p-4 text-center text-xs leading-relaxed text-[#888]">Перетащите фото сюда или нажмите «Загрузить фото»<br />Можно выбрать сразу несколько файлов · JPG, PNG</div>}
    {entries.length > 0 && <div className="my-3 space-y-3 rounded-lg bg-[#242424] p-3"><div className="flex justify-between gap-2 text-[13px] text-[#ccc]"><span>Загрузка {entries.filter(e => e.status === 'done').length} из {entries.length}</span>{remaining && <span className="text-[#8a8a8a]">{remaining}</span>}</div>{entries.map((entry, index) => <div key={index} className="text-xs"><div className="flex justify-between gap-2"><span className="truncate font-mono">{entry.file.name}</span><span className={statusClass[entry.status]}>{entry.status === 'done' ? 'готово' : entry.status === 'error' ? 'ошибка' : entry.status === 'queued' ? 'в очереди' : `${entry.progress}%`}</span></div><progress max={100} value={entry.status === 'error' ? 100 : entry.progress} className={`mt-1 block h-1 w-full appearance-none overflow-hidden rounded [&::-webkit-progress-bar]:bg-[#333] ${barClass[entry.status]}`} />{entry.error && <div className="mt-1 flex items-center justify-between gap-2"><p role="alert" className="min-w-0 text-red-400">{entry.file.name}: {entry.error}</p><button disabled={busy} onClick={() => void run(entries, [index])} aria-label={`Повторить: ${entry.file.name}`} className="h-8 shrink-0 rounded-md border border-red-900 px-2.5 text-red-300 disabled:opacity-50">Повторить</button></div>}</div>)}
      {entries.filter(e => e.status === 'error').length > 1 && <button disabled={busy} onClick={() => void run(entries, entries.flatMap((entry, index) => entry.status === 'error' ? [index] : []))} className="min-h-10 rounded-lg border border-[#444] px-3 text-sm disabled:opacity-50">Повторить неудачные</button>}</div>}
    {pending.length > 0 && <div className="mb-1.5 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">{pending.map(entry => <img key={entry.preview} src={entry.preview} alt="" className="aspect-square w-full rounded-md object-cover opacity-45" />)}</div>}
  </div>;
}
