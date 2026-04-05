// components/GamePanel/GamePanel.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';
import { PlayerRow } from './PlayerRow';
import { PrizeSummary } from './PrizeSummary';

type Props = { onClose: () => void };

export function GamePanel({ onClose }: Props) {
  const { activeSession, sessionPlayers } = useGame();
  if (!activeSession) return null;

  const stats = calcGameStats(activeSession, sessionPlayers);
  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const eliminatedPlayers = sessionPlayers
    .filter(p => p.status === 'eliminated' || p.status === 'winner')
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

  return (
    <>
      {/* Panel */}
      <div className="fixed top-0 left-0 bottom-0 w-[320px] z-40 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Игра</div>
            <div className="text-[18px] font-bold text-[#ccc] tabular-nums mt-0.5">
              {stats.bank.toLocaleString('ru')} RSD
            </div>
          </div>
          <button onClick={onClose} className="text-[#555] text-[20px] bg-transparent border-none cursor-pointer hover:text-[#999] leading-none">✕</button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-px bg-[#2a2a2a] border-b border-[#2a2a2a] shrink-0">
          {[
            { label: 'Фишек в игре', value: stats.totalChips.toLocaleString('ru') },
            { label: 'Средний стек', value: stats.avgStack.toLocaleString('ru') },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1a1a1a] px-4 py-2">
              <div className="text-[10px] text-[#555] uppercase tracking-[1px]">{label}</div>
              <div className="text-[15px] font-bold text-[#888] tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Active players */}
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">
              В игре ({activePlayers.length})
            </div>
            {activePlayers.map(sp => <PlayerRow key={sp.id} sp={sp} />)}
          </div>

          {/* Eliminated */}
          {eliminatedPlayers.length > 0 && (
            <div>
              <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">
                Вылетели ({eliminatedPlayers.length})
              </div>
              {eliminatedPlayers.map(sp => <PlayerRow key={sp.id} sp={sp} />)}
            </div>
          )}

          {/* Prize breakdown */}
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">Призовые</div>
            <PrizeSummary />
          </div>
        </div>
      </div>
    </>
  );
}
