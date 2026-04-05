// components/GamePanel/PrizeSummary.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';

export function PrizeSummary() {
  const { activeSession, sessionPlayers } = useGame();
  if (!activeSession) return null;

  const stats = calcGameStats(activeSession, sessionPlayers);

  return (
    <div className="flex flex-col gap-1">
      {stats.payouts.map((amount, i) => (
        <div key={i} className="flex justify-between items-center text-[13px]">
          <span className="text-[#666]">{i + 1}-е место ({activeSession.prizePcts[i]}%)</span>
          <span className="text-[#ccc] font-bold tabular-nums">{amount.toLocaleString('ru')} ₽</span>
        </div>
      ))}
    </div>
  );
}
