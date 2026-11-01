'use client';
import { useState } from 'react';
import type { PublicLeaderboardRow } from '@/lib/games/queries';
import { Avatar } from './Primitives';
import { number, plural } from './format';

type SortKey = 'name' | 'games' | 'wins' | 'prizes' | 'totalWon' | 'net';
const columns: { key: SortKey; label: string }[] = [{ key: 'name', label: 'Игрок' }, { key: 'games', label: 'Игр' }, { key: 'wins', label: 'Победы' }, { key: 'prizes', label: 'Призы' }, { key: 'totalWon', label: 'Выигрыш' }, { key: 'net', label: 'Итог' }];
export function Leaderboard({ rows }: { rows: PublicLeaderboardRow[] }) {
  const [key, setKey] = useState<SortKey>('totalWon');
  const [ascending, setAscending] = useState(false);
  const sort = (next: SortKey) => { if (next === key) setAscending(!ascending); else { setKey(next); setAscending(next === 'name'); } };
  const sorted = [...rows].sort((a, b) => {
    const comparison = key === 'name' ? a.name.localeCompare(b.name, 'ru') : (a[key] as number) - (b[key] as number);
    return (ascending ? comparison : -comparison) || a.name.localeCompare(b.name, 'ru');
  });
  const label = (column: typeof columns[number]) => <>{column.label}{key === column.key && (ascending ? ' ↑' : ' ↓')}</>;
  return <div>
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">{columns.filter(c => c.key !== 'name').reverse().map(column => <button key={column.key} onClick={() => sort(column.key)} aria-pressed={key === column.key} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs ${key === column.key ? 'border-violet-700 bg-[#2a2040] text-white' : 'border-[#333] text-[#aaa]'}`}>{label(column)}</button>)}</div>
    <div role="table" aria-label="Таблица компании" className="overflow-hidden rounded-xl bg-[#242424]">
      <div role="row" className="hidden grid-cols-[48px_minmax(0,1fr)_72px_80px_72px_120px_120px] items-center gap-2 border-b border-[#333] px-4 text-[11px] uppercase tracking-wide text-[#8a8a8a] lg:grid"><span>#</span>{columns.map(column => <button role="columnheader" aria-sort={key === column.key ? (ascending ? 'ascending' : 'descending') : 'none'} key={column.key} onClick={() => sort(column.key)} className={`min-h-12 text-left ${key === column.key ? 'font-bold text-violet-400' : ''}`}>{label(column)}</button>)}</div>
      {sorted.map((row, index) => <div role="row" data-testid="leaderboard-row" key={row.playerId} className="grid min-h-16 grid-cols-[18px_minmax(0,1fr)_62px_66px] items-center gap-2 border-b border-[#2f2f2f] px-3 py-3 text-xs last:border-0 hover:bg-[#2a2a2a] lg:min-h-14 lg:grid-cols-[48px_minmax(0,1fr)_72px_80px_72px_120px_120px] lg:px-4 lg:text-sm">
        <span className="text-[#777]">{index + 1}</span><div className="flex min-w-0 items-center gap-2 lg:gap-3"><span className="inline-flex"><Avatar name={row.name} url={row.avatarUrl} /></span><div className="min-w-0"><span data-testid="player-name" className="block truncate font-semibold text-[#eee]">{row.name}</span><span className="mt-1 block text-[10px] leading-4 text-[#8a8a8a] lg:hidden">{plural(row.games, ['игра', 'игры', 'игр'])} · {row.wins} поб. · {row.prizes} в призах</span></div></div>
        <span className="hidden tabular-nums lg:block">{row.games}</span><span className="hidden tabular-nums lg:block">{row.wins}</span><span className="hidden tabular-nums lg:block">{row.prizes}</span>
        <span className="font-semibold tabular-nums text-yellow-400">{number(row.totalWon)}</span><span className={`w-fit rounded-md py-1 font-bold tabular-nums lg:px-2.5 ${row.net > 0 ? 'text-green-400 lg:bg-green-400/10' : row.net < 0 ? 'text-red-400 lg:bg-red-400/10' : 'text-[#aaa]'}`}>{row.net > 0 ? '+' : row.net < 0 ? '−' : ''}{number(Math.abs(row.net))}</span>
      </div>)}
    </div>
    <p className="mt-3 text-xs leading-5 text-[#8a8a8a]">Суммы в RSD. Итог — выигрыш минус взносы, ребаи и аддоны.</p>
  </div>;
}
