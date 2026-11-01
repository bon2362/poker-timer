'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignPayouts } from '@/lib/games/results';
import { calcGameStats } from '@/lib/game';
import { adminFetch } from '@/lib/admin/client';
import { money } from '@/lib/admin/types';
import type { Session, SessionPlayer } from '@/types/game';
export function ResultsEditor({ session, players, names }: { session: Session; players: SessionPlayer[]; names: Record<string, string> }) {
  const [draft, setDraft] = useState(players); const [saved, setSaved] = useState(players); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const router = useRouter();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved); const bank = calcGameStats(session, draft).bank; const oldBank = calcGameStats(session, saved).bank;
  const payouts = new Map(assignPayouts(session, draft).map(row => [row.id, row.payout]));
  function edit(id: string, patch: Partial<SessionPlayer>) { setDraft(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row)); }
  function move(player: SessionPlayer, direction: number) { const next = (player.finishPosition ?? 0) + direction; setDraft(rows => rows.map(row => row.id === player.id ? { ...row, finishPosition: next } : row.finishPosition === next ? { ...row, finishPosition: player.finishPosition } : row)); }
  async function save() {
    setBusy(true); setError('');
    try { const data = await adminFetch(`/api/admin/games/${session.id}/results`, 'PATCH', { players: draft.map(p => ({ id: p.id, finishPosition: p.finishPosition, rebuys: p.rebuys, hasAddon: p.hasAddon })) });
      const next = draft.map(p => ({ ...p, payout: data.players?.find((row: { id: string }) => row.id === p.id)?.payout ?? payouts.get(p.id) ?? 0 })); setDraft(next); setSaved(next); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const control = 'h-9 min-w-9 rounded-md border border-[#444] px-2 text-sm disabled:opacity-30';
  return <section className="min-w-0"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-[11px] tracking-[2px] text-[#888]">РЕЗУЛЬТАТЫ</h2><span className={`text-sm ${dirty ? 'text-yellow-400' : 'text-[#ddd]'}`}>Банк {money(bank)} RSD</span></div>
    <div className="space-y-2">{[...draft].sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0)).map(player => {
      const name = names[player.playerId] ?? 'Игрок'; const payout = payouts.get(player.id) ?? 0; const previous = saved.find(p => p.id === player.id)?.payout ?? 0;
      return <div key={player.id} className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg bg-[#242424] px-3 py-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${player.finishPosition === 1 ? 'bg-yellow-400 text-[#29220b]' : player.finishPosition === 2 ? 'bg-[#d1d5db] text-[#333]' : player.finishPosition === 3 ? 'bg-[#b98245] text-[#2a1e12]' : 'border border-[#444] text-[#666]'}`}>{player.finishPosition}</span><span className="min-w-0 flex-1 truncate text-sm">{name}</span>
        <button aria-label={`Выше: ${name}`} className={control} disabled={busy || player.finishPosition === 1} onClick={() => move(player, -1)}>↑</button><button aria-label={`Ниже: ${name}`} className={control} disabled={busy || player.finishPosition === draft.length} onClick={() => move(player, 1)}>↓</button>
        <div className="flex w-full items-center gap-2 sm:w-auto"><span className="text-xs text-[#888]">Ребаи</span><button className={control} aria-label={`Убрать ребай: ${name}`} disabled={busy || player.rebuys === 0} onClick={() => edit(player.id, { rebuys: player.rebuys - 1 })}>−</button><span className="text-sm">{player.rebuys}</span><button className={control} aria-label={`Добавить ребай: ${name}`} disabled={busy || session.rebuyCost === 0 || (session.maxRebuys > 0 && player.rebuys >= Math.max(session.maxRebuys, saved.find(p => p.id === player.id)?.rebuys ?? 0))} onClick={() => edit(player.id, { rebuys: player.rebuys + 1 })}>+</button>
          <button aria-label={`Аддон: ${name}`} aria-pressed={player.hasAddon} className={`${control} ml-auto whitespace-nowrap ${player.hasAddon ? 'border-violet-700 bg-[#2a2040] text-violet-200' : 'text-[#888]'}`} disabled={busy || session.addonCost === 0} onClick={() => edit(player.id, { hasAddon: !player.hasAddon })}>{player.hasAddon ? '✓ Аддон' : 'Аддон —'}</button>
          <div className={`ml-auto min-w-16 text-right text-sm font-semibold ${previous !== payout ? 'text-yellow-400' : 'text-[#ddd]'}`}>{previous !== payout && <div className="text-xs text-[#777] line-through">{money(previous)}</div>}{money(payout)}</div></div>
      </div>;
    })}</div><p className="mt-3 text-xs leading-relaxed text-[#777]">Выигрыш пересчитывается по банку и процентам игры: {session.prizePcts.join(' / ')} %.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {dirty && <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-2 border-t border-[#333] bg-[#1a1a1a] py-3"><p className="w-full text-xs text-[#aaa]">Результаты изменены · банк {money(oldBank)} → {money(bank)}</p><button onClick={() => setDraft(saved)} disabled={busy} className="min-h-11 rounded-lg border border-[#444] px-4 text-sm">Отменить</button><button onClick={save} disabled={busy} className="min-h-11 flex-1 rounded-lg bg-violet-700 px-4 text-sm font-semibold disabled:opacity-50">{busy ? 'Сохраняем…' : 'Сохранить'}</button></div>}
  </section>;
}
