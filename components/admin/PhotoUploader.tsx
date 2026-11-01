'use client';
import { useRef, useState } from 'react';
import { uploadPhoto } from '@/lib/admin/photoUpload';
type Entry = { file: File; status: 'queued' | 'uploading' | 'done' | 'error'; progress: number; error?: string };
export function PhotoUploader({ sessionId, onUploaded, empty = true, photoCount }: { sessionId: string; onUploaded(): void; empty?: boolean; photoCount?: number }) {
  const [entries, setEntries] = useState<Entry[]>([]); const [busy, setBusy] = useState(false); const input = useRef<HTMLInputElement>(null); const active = useRef(false);
  function patch(index: number, updates: Partial<Entry>) { setEntries(rows => rows.map((row, i) => i === index ? { ...row, ...updates } : row)); }
  async function run(rows: Entry[], indices: number[]) {
    if (active.current) return; active.current = true; setBusy(true); setEntries(rows);
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
  function add(files: File[]) { if (!files.length || active.current) return; const next = [...entries, ...files.map(file => ({ file, status: 'queued' as const, progress: 0 }))]; void run(next, files.map((_, i) => entries.length + i)); }
  return <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(Array.from(e.dataTransfer.files)); }}>
    <input aria-label="Загрузить фото" ref={input} type="file" multiple accept="image/*" className="hidden" disabled={busy} onChange={e => { add(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
    <div className="flex items-center justify-between gap-2">{photoCount !== undefined && <h2 className="text-[11px] tracking-[2px] text-[#888]">ФОТО ({photoCount})</h2>}<button onClick={() => input.current?.click()} disabled={busy} className="min-h-10 rounded-lg bg-violet-700 px-4 text-sm font-semibold disabled:opacity-50">+ Загрузить фото</button></div>
    <p className="my-3 rounded-lg bg-[#242424] p-3 text-xs leading-relaxed text-[#999]">Эти фото показываются на странице игры и в карусели на паузе таймера.</p>
    {empty && <div className="mb-3 rounded-lg border border-dashed border-[#3a3a3a] p-4 text-center text-xs leading-relaxed text-[#888]">Перетащите фото сюда или нажмите «Загрузить фото»<br />Можно выбрать сразу несколько файлов · JPG, PNG</div>}
    {entries.length > 0 && <div className="my-3 space-y-3 rounded-lg bg-[#242424] p-3"><p className="text-sm">Загрузка {entries.filter(e => e.status === 'done').length} из {entries.length}</p>{entries.map((entry, index) => <div key={index} className="text-xs"><div className="flex justify-between gap-2"><span className="truncate font-mono">{entry.file.name}</span><span className={entry.status === 'done' ? 'text-green-400' : entry.status === 'error' ? 'text-red-400' : 'text-[#aaa]'}>{entry.status === 'done' ? 'готово' : entry.status === 'error' ? 'ошибка' : entry.status === 'queued' ? 'в очереди' : `${entry.progress}%`}</span></div><progress max={100} value={entry.progress} className="h-1 w-full accent-violet-500" />{entry.error && <p role="alert" className="mt-1 text-red-400">{entry.file.name}: {entry.error}</p>}</div>)}
      {entries.some(e => e.status === 'error') && <button disabled={busy} onClick={() => void run(entries, entries.flatMap((entry, index) => entry.status === 'error' ? [index] : []))} className="min-h-10 rounded-lg border border-[#444] px-3 text-sm disabled:opacity-50">Повторить неудачные</button>}</div>}
  </div>;
}
