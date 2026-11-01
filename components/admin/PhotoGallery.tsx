'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/client';
import { storageUrl, gameDate, type AdminPhoto, type AdminGame } from '@/lib/admin/types';
import { ConfirmDialog } from './ConfirmDialog';
export function PhotoGallery({ initialPhotos, total, sessionId, games, showLabel = true }: { showLabel?: boolean; initialPhotos: AdminPhoto[]; total: number; sessionId: string | null; games: AdminGame[] }) {
  const [photos, setPhotos] = useState(initialPhotos); const [count, setCount] = useState(total); const [menu, setMenu] = useState<string | null>(null); const [action, setAction] = useState<{ kind: 'delete' | 'move'; photo: AdminPhoto } | null>(null); const [target, setTarget] = useState(''); const [viewer, setViewer] = useState<AdminPhoto | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setPhotos(initialPhotos); setCount(total); }, [initialPhotos, total]);
  async function loadMore() {
    setBusy(true); setError('');
    try { const params = sessionId ? `sessionId=${encodeURIComponent(sessionId)}` : 'unassigned=1'; const data = await adminFetch(`/api/admin/photos?${params}&offset=${photos.length}`, 'GET'); setPhotos(previous => [...previous, ...data.photos.filter((photo: AdminPhoto) => !previous.some(p => p.id === photo.id))]); setCount(data.total); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function perform() {
    if (!action) return; setBusy(true); setError('');
    try { await adminFetch(`/api/admin/photos/${action.photo.id}`, action.kind === 'delete' ? 'DELETE' : 'PATCH', action.kind === 'move' ? { sessionId: target || null } : undefined); setPhotos(rows => rows.filter(p => p.id !== action.photo.id)); setCount(n => n - 1); setAction(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const groups = new Map<string, AdminPhoto[]>();
  for (const photo of photos) { const month = sessionId ? '' : photo.taken_at ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', month: 'long', year: 'numeric' }).format(new Date(photo.taken_at)) : 'Без даты'; groups.set(month, [...(groups.get(month) ?? []), photo]); }
  return <div>{showLabel && <div className="mb-3 flex justify-between text-xs text-[#888]"><span>ФОТО ({count})</span></div>}{[...groups].map(([month, rows]) => <section key={month} className="mb-5">{month && <h2 className="mb-3 text-[11px] uppercase tracking-[1px] text-[#888]">{month}</h2>}<div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">{rows.map(photo => <div key={photo.id} className="relative aspect-square min-w-0 rounded-lg bg-[#242424]">
    <button className="h-full w-full overflow-hidden rounded-lg" aria-label="Открыть фото" onClick={() => setViewer(photo)}><Image src={storageUrl('slideshow', photo.thumb_path || photo.path)} width={200} height={200} sizes="(max-width: 640px) 33vw, 140px" alt="Фото с игры" className="h-full w-full object-cover" /></button>
    {photo.taken_at && <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] text-white">{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Belgrade', year: '2-digit', month: '2-digit', day: '2-digit' }).format(new Date(photo.taken_at))}</span>}
    <button aria-label="Действия с фото" onClick={() => setMenu(menu === photo.id ? null : photo.id)} className="absolute right-1 top-1 h-8 w-8 rounded-md bg-black/65 text-white">⋯</button>
    {menu === photo.id && <div className="absolute right-1 top-10 z-20 w-36 rounded-lg border border-[#444] bg-[#242424] p-1 shadow-xl"><button onClick={() => { setAction({ kind: 'move', photo }); setTarget(''); setMenu(null); setError(''); }} className="block min-h-10 w-full rounded px-3 text-left text-xs hover:bg-[#333]">В игру…</button><button onClick={() => { setAction({ kind: 'delete', photo }); setMenu(null); setError(''); }} className="block min-h-10 w-full rounded px-3 text-left text-xs text-red-400 hover:bg-[#333]">Удалить</button></div>}
  </div>)}</div></section>)}
    {photos.length < count && <button disabled={busy} onClick={loadMore} className="min-h-11 w-full rounded-lg border border-dashed border-[#444] text-sm text-[#aaa] disabled:opacity-50">{busy ? 'Загружаем…' : `Показать ещё · осталось ${count - photos.length}`}</button>}
    {!photos.length && <p className="py-6 text-center text-sm text-[#777]">Фото пока нет</p>}
    {error && !action && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {action && <ConfirmDialog title={action.kind === 'delete' ? 'Удалить фото?' : 'Перенести фото'} confirmLabel={action.kind === 'delete' ? 'Удалить' : 'Перенести'} busy={busy} onConfirm={perform} onClose={() => setAction(null)}>
      {action.kind === 'delete' ? <p>{sessionId ? 'Фото исчезнет и со страницы игры, и из карусели.' : 'Фото исчезнет из карусели. Восстановить его будет нельзя.'}</p> : <><p>Выберите игру. Фото пропадёт отсюда и появится на странице выбранной игры.</p><label className="mt-3 block">Игра<select aria-label="Игра для переноса" value={target} onChange={e => setTarget(e.target.value)} className="mt-2 min-h-11 w-full rounded border border-[#444] bg-[#1a1a1a] px-3 text-white"><option value="">Без игры — только карусель</option>{games.filter(game => game.session.id !== sessionId).map(game => <option key={game.session.id} value={game.session.id}>{gameDate(game.session.createdAt)} · {game.names[game.players.find(p => p.finishPosition === 1)?.playerId ?? '']}</option>)}</select></label></>}{error && <p role="alert" className="mt-3 text-red-400">{error}</p>}
    </ConfirmDialog>}
    {viewer && <div role="dialog" aria-modal="true" aria-label="Просмотр фото" onKeyDown={e => { if (e.key === 'Escape') setViewer(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3"><button autoFocus onClick={() => setViewer(null)} className="absolute right-4 top-4 z-10 min-h-11 rounded-lg bg-[#333] px-4 text-white">Закрыть ✕</button><img src={storageUrl('slideshow', viewer.path)} alt="Фото с игры" className="max-h-[90dvh] max-w-full object-contain" /></div>}
  </div>;
}
