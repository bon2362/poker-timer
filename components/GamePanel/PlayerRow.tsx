// components/GamePanel/PlayerRow.tsx
'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useMinuteTimer } from '@/context/MinuteTimerContext';
import { Avatar } from '../PlayerManager/PlayerManager';
import type { SessionPlayer } from '@/types/game';

type Props = { sp: SessionPlayer };

export function PlayerRow({ sp }: Props) {
  const {
    players, activeSession,
    doRebuy, undoRebuy, doAddon, undoAddon,
    movePlayerToTable,
    eliminatePlayer, undoEliminate, declareWinner,
    sessionPlayers,
  } = useGame();
  const { startMinute } = useMinuteTimer();
  const [expanded, setExpanded] = useState(false);
  const [undoHover, setUndoHover] = useState(false);
  const player = players.find(p => p.id === sp.playerId);
  if (!player || !activeSession) return null;

  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const isLastPlayer = activePlayers.length === 1 && sp.status === 'playing';
  const canMoveTables = activeSession.numberOfTables === 2 && !activeSession.tablesMergedAt;
  const targetTable = sp.tableNumber === 1 ? 2 : 1;

  /* ── Eliminated / winner row ── */
  if (sp.status === 'eliminated' || sp.status === 'winner') {
    return (
      <div
        className="flex items-center gap-3 py-2 group cursor-pointer"
        onMouseEnter={() => setUndoHover(true)}
        onMouseLeave={() => setUndoHover(false)}
      >
        <Avatar player={player} size={32} />
        <span className="flex-1 text-[13px] text-[#666] line-through">{player.name}</span>
        {sp.status === 'eliminated' && undoHover ? (
          <button
            onClick={() => undoEliminate(sp.id)}
            title="Восстановить игрока"
            className="text-[11px] bg-[#2a2020] border border-[#664444] text-[#cc8888] rounded px-2 py-0.5 cursor-pointer hover:bg-[#3a2020] transition-colors"
          >
            ↩ вернуть
          </button>
        ) : (
          <span className="text-[11px] text-[#444]">{sp.finishPosition}-е</span>
        )}
      </div>
    );
  }

  /* ── Active player row ── */
  return (
    <div className="flex flex-col gap-2 py-2 border-b border-[#242424] last:border-0">
      <div className="flex items-center gap-2">
        <Avatar player={player} size={36} />
        <span
          className="flex-1 min-w-0 truncate text-[14px] text-[#ccc] cursor-pointer hover:text-white"
          onClick={() => !isLastPlayer && setExpanded(e => !e)}
        >
          {player.name}
        </span>

        {/* Rebuy button — shows ±controls when expanded */}
        {activeSession.rebuyCost > 0 && (() => {
          const maxR = activeSession.maxRebuys;
          const atMax = maxR > 0 && sp.rebuys >= maxR;
          const isSingle = maxR === 1;

          if (expanded) {
            return (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => undoRebuy(sp.id)}
                  disabled={sp.rebuys === 0}
                  className="text-[13px] w-6 h-6 flex items-center justify-center bg-[#1a1a1a] border border-[#333] text-[#888] rounded cursor-pointer hover:bg-[#2a2040] hover:text-violet-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="text-[11px] text-violet-400 min-w-[44px] text-center">
                  Ребай{sp.rebuys > 0 ? ` ×${sp.rebuys}` : ''}
                </span>
                <button
                  onClick={() => doRebuy(sp.id)}
                  disabled={atMax}
                  className="text-[13px] w-6 h-6 flex items-center justify-center bg-[#1a1a1a] border border-[#443366] text-violet-400 rounded cursor-pointer hover:bg-[#3a2060] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            );
          }

          // Collapsed — toggle style when maxRebuys === 1
          if (isSingle) {
            return (
              <button
                onClick={() => sp.rebuys > 0 ? undoRebuy(sp.id) : doRebuy(sp.id)}
                className={`shrink-0 text-[11px] rounded px-2 py-1 cursor-pointer border transition-colors ${
                  sp.rebuys > 0
                    ? 'bg-[#2a2040] border-[#443366] text-violet-400 hover:bg-[#2a1a1a] hover:border-[#664444] hover:text-red-400'
                    : 'bg-[#2a2040] border-[#443366] text-violet-400 hover:bg-[#3a2060]'
                }`}
              >
                {sp.rebuys > 0 ? 'Ребай ✓' : 'Ребай'}
              </button>
            );
          }

          // Collapsed — counter style (default)
          return (
            <button
              onClick={() => !atMax && doRebuy(sp.id)}
              disabled={atMax}
              className="shrink-0 text-[11px] bg-[#2a2040] border border-[#443366] text-violet-400 rounded px-2 py-1 cursor-pointer hover:bg-[#3a2060] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ребай{sp.rebuys > 0 ? ` ×${sp.rebuys}` : ''}
            </button>
          );
        })()}

        {/* Addon button — shows ±controls when expanded */}
        {activeSession.addonCost > 0 && (
          expanded ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => sp.hasAddon && undoAddon(sp.id)}
                disabled={!sp.hasAddon}
                className="text-[13px] w-6 h-6 flex items-center justify-center bg-[#1a1a1a] border border-[#333] text-[#888] rounded cursor-pointer hover:bg-[#1a2a1a] hover:text-green-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className={`text-[11px] min-w-[44px] text-center ${sp.hasAddon ? 'text-green-400' : 'text-[#555]'}`}>
                {sp.hasAddon ? 'Аддон ✓' : 'Аддон'}
              </span>
              <button
                onClick={() => !sp.hasAddon && doAddon(sp.id)}
                disabled={sp.hasAddon}
                className="text-[13px] w-6 h-6 flex items-center justify-center bg-[#1a1a1a] border border-[#336633] text-green-400 rounded cursor-pointer hover:bg-[#2a3a2a] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => sp.hasAddon ? undoAddon(sp.id) : doAddon(sp.id)}
              className={`shrink-0 text-[11px] rounded px-2 py-1 cursor-pointer border transition-colors ${
                sp.hasAddon
                  ? 'bg-[#1a2a1a] border-[#336633] text-green-400 hover:bg-[#2a1a1a] hover:border-[#664444] hover:text-red-400'
                  : 'bg-[#1a2a1a] border-[#336633] text-green-400 hover:bg-[#2a3a2a]'
              }`}
            >
              {sp.hasAddon ? 'Аддон ✓' : 'Аддон'}
            </button>
          )
        )}
      </div>

      {/* Expanded menu — elimination + minute timer */}
      {expanded && !isLastPlayer && (
        <div className="pl-[48px] flex flex-wrap gap-2">
          {canMoveTables && (
            <button
              onClick={async () => { await movePlayerToTable(sp.id, targetTable); setExpanded(false); }}
              className="text-[12px] bg-[#242020] border border-[#554444] text-[#d0aaaa] rounded px-3 py-1 cursor-pointer hover:bg-[#302424]"
            >
              {sp.tableNumber === 1 ? '→ Стол 2' : '← Стол 1'}
            </button>
          )}
          <button
            onClick={async () => { await eliminatePlayer(sp.id); setExpanded(false); }}
            className="text-[12px] bg-red-900 border border-red-700 text-red-300 rounded px-3 py-1 cursor-pointer hover:bg-red-800"
          >
            Вылетел:а
          </button>
          <button
            onClick={() => { startMinute(player.name, player.id); setExpanded(false); }}
            className="text-[12px] bg-[#1a2030] border border-[#334466] text-blue-300 rounded px-3 py-1 cursor-pointer hover:bg-[#2a3050]"
          >
            ⏱ Минуту!
          </button>
        </div>
      )}

      {isLastPlayer && (
        <div className="pl-[48px]">
          <button
            onClick={() => declareWinner(sp.id)}
            className="text-[13px] bg-yellow-900 border border-yellow-600 text-yellow-300 rounded-lg px-4 py-2 cursor-pointer hover:bg-yellow-800 font-semibold"
          >
            🏆 Объявить победителем
          </button>
        </div>
      )}
    </div>
  );
}
