// components/GamePanel/GamePanel.tsx
'use client';
import { useGame } from '@/context/GameContext';
import { calcGameStats } from '@/lib/game';
import { PlayerRow } from './PlayerRow';
import { PrizeSummary } from './PrizeSummary';

type Props = { isOpen: boolean; onToggle: () => void };

export function GamePanel({ isOpen, onToggle }: Props) {
  const { activeSession, sessionPlayers } = useGame();
  if (!activeSession) return null;

  /* ── Collapsed strip ── */
  if (!isOpen) {
    return (
      <div
        className="fixed left-0 top-0 bottom-0 w-[32px] z-30 cursor-pointer group"
        onClick={onToggle}
        title="Игроки"
      >
        {/* Subtle left edge line */}
        <div className="absolute inset-y-0 left-0 w-px bg-[#2a2a2a] group-hover:bg-[#3a3a3a] transition-colors" />
        {/* Vertical label — visible only on hover */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="opacity-0 group-hover:opacity-100 text-[#666] text-[10px] tracking-[3px] uppercase font-medium transition-opacity select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            ИГРОКИ
          </span>
        </div>
      </div>
    );
  }

  /* ── Full panel ── */
  const stats = calcGameStats(activeSession, sessionPlayers);
  const isTwoTableActive = activeSession.numberOfTables === 2 && !activeSession.tablesMergedAt;
  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const table1Players = activePlayers.filter(p => p.tableNumber === 1);
  const table2Players = activePlayers.filter(p => p.tableNumber === 2);
  const eliminatedPlayers = sessionPlayers
    .filter(p => p.status === 'eliminated' || p.status === 'winner')
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
  const tableSections = [
    { tableNumber: 1, players: table1Players, stats: calcGameStats(activeSession, sessionPlayers, 1) },
    { tableNumber: 2, players: table2Players, stats: calcGameStats(activeSession, sessionPlayers, 2) },
  ];

  return (
    <div className="fixed top-0 left-0 bottom-0 w-[360px] max-w-[calc(100vw-32px)] z-40 bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] shrink-0">
        <div>
          <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Фонд</div>
          <div className="text-[18px] font-bold text-[#ccc] tabular-nums mt-0.5">
            {stats.bank.toLocaleString('ru')} RSD
          </div>
        </div>
        <button
          onClick={onToggle}
          className="text-[#555] text-[20px] bg-transparent border-none cursor-pointer hover:text-[#999] leading-none"
        >
          ✕
        </button>
      </div>

      {/* Stats bar */}
      {!isTwoTableActive && (
        <div className="border-b border-[#2a2a2a] shrink-0">
          <div className="bg-[#1a1a1a] px-4 py-2">
            <div className="text-[10px] text-[#555] uppercase tracking-[1px]">Фишек в игре</div>
            <div className="text-[15px] font-bold text-[#888] tabular-nums">{stats.totalChips.toLocaleString('ru')}</div>
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 flex flex-col gap-4">
        {/* Active players */}
        {isTwoTableActive ? (
          <div className="flex flex-col gap-4">
            {tableSections.map(section => (
              <div key={section.tableNumber}>
                <div className="sticky top-0 z-10 -mx-4 mb-2 border-y border-[#2a2a2a] bg-[#1a1a1a]/95 px-4 py-2 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-[#555] tracking-[2px] uppercase">
                      Стол {section.tableNumber} ({section.players.length})
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-[#555] uppercase tracking-[1px]">Фишек в игре</div>
                      <div className="text-[12px] font-bold text-[#888] tabular-nums">
                        {section.stats.totalChips.toLocaleString('ru')}
                      </div>
                    </div>
                  </div>
                </div>
                {section.players.map(sp => <PlayerRow key={sp.id} sp={sp} />)}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-2">
              В игре ({activePlayers.length})
            </div>
            {activePlayers.map(sp => <PlayerRow key={sp.id} sp={sp} />)}
          </div>
        )}

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
  );
}
