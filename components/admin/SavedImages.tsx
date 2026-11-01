'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { prepareImage } from '@/lib/admin/photoUpload';
import { adminFetch } from '@/lib/admin/client';
import { storageUrl, type SavedImage } from '@/lib/admin/types';
import type { SessionPlayer } from '@/types/game';
export function SavedImages({ sessionId, date, players, names, images }: { sessionId: string; date: string; players: SessionPlayer[]; names: Record<string, string>; images: SavedImage[] }) {
  const input = useRef<HTMLInputElement>(null); const selection = useRef<{ player: SessionPlayer; kind: 'winner' | 'loser' } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  const cards = players.flatMap(player => (['winner', 'loser'] as const).flatMap(kind => { const image = images.find(row => row.id === (kind === 'winner' ? player.winnerImageId : player.loserImageId)); return image ? [{ player, kind, image }] : []; }));
  async function replace(file: File) { if (!selection.current || busy) return; setBusy(true); setError(''); try { const prepared = await prepareImage(file, 'avatars', () => {}); await adminFetch(`/api/admin/games/${sessionId}/images`, 'PATCH', { sessionPlayerId: selection.current.player.id, kind: selection.current.kind, path: prepared.path, thumbPath: prepared.thumbPath }); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <section className="mt-6 rounded-xl border border-[#4a3c22] bg-[#2a2418] p-4"><span className="rounded-full bg-[#4a3c22] px-2.5 py-1 text-[11px] font-semibold text-[#f5c56b]">🔒 Сохранено за игрой {date}</span><h2 className="mb-2 mt-4 text-[17px] font-semibold text-[#f3e6cc]">Картинки этой игры</h2><p className="mb-4 text-xs leading-relaxed text-[#c9b894]">Копия картинок, которые показывал таймер в этот вечер. Правки здесь касаются только этой игры и не меняют раздел «Игроки».</p>
    <input aria-label="Заменить сохранённую картинку" ref={input} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void replace(file); e.target.value = ''; }} />
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">{cards.map(({ player, kind, image }) => <article key={`${player.id}-${kind}`} className="overflow-hidden rounded-lg bg-[#1f1b13]"><img src={storageUrl('avatars', image.thumb_path || image.path)} width={320} height={180} loading="lazy" alt={names[player.playerId]} className="aspect-video w-full object-cover" /><div className="p-3"><p className="text-sm text-[#f3e6cc]">{names[player.playerId]}</p><p className="mt-1 text-xs text-[#c9b894]">{kind === 'winner' ? 'победитель' : 'вылет'} · {player.finishPosition} место</p><button disabled={busy} onClick={() => { selection.current = { player, kind }; input.current?.click(); }} className="mt-3 min-h-10 w-full rounded-lg border border-[#4a3c22] text-xs text-[#f5c56b] disabled:opacity-50">{busy ? 'Загружаем…' : 'Заменить'}</button></div></article>)}</div>
    {players.some(player => !player.winnerImageId && !player.loserImageId) && <p className="mt-3 text-xs text-[#c9b894]">Без картинки в этой игре: {players.filter(player => !player.winnerImageId && !player.loserImageId).map(player => names[player.playerId]).join(', ')}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </section>;
}
