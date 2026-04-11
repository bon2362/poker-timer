'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { useMinuteTimer } from '@/context/MinuteTimerContext';
import { Avatar } from './PlayerManager/PlayerManager';
import type { SessionPlayer, Player } from '@/types/game';

type Props = { onClose: () => void };

/* ── Active player row (collapsible) ── */
function PlayerAdminRow({ sp, player }: { sp: SessionPlayer; player: Player }) {
  const { activeSession, doRebuy, undoRebuy, doAddon, undoAddon, eliminatePlayer, declareWinner, sessionPlayers } = useGame();
  const { startMinute } = useMinuteTimer();
  const [expanded, setExpanded] = useState(false);
  if (!activeSession) return null;

  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const isLastPlayer = activePlayers.length === 1;

  const btnBase = 'flex items-center justify-center rounded-xl border font-semibold cursor-pointer active:scale-95 transition-transform';

  return (
    <div className="bg-[#242424] rounded-2xl overflow-hidden">
      {/* Collapsed header — tap to expand */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 cursor-pointer bg-transparent border-none text-left active:bg-[#2a2a2a] transition-colors"
      >
        <Avatar player={player} size={44} />
        <span className="flex-1 text-[17px] font-semibold text-white">{player.name}</span>
        <span className={`text-[16px] transition-transform ${expanded ? 'rotate-180' : ''} text-[#555]`}>▾</span>
      </button>

      {/* Expanded actions */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* Rebuy controls */}
          {activeSession.rebuyCost > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => undoRebuy(sp.id)}
                disabled={sp.rebuys === 0}
                className={`${btnBase} w-11 h-11 text-[20px] bg-[#1a1a1a] border-[#333] text-[#888] disabled:opacity-30 disabled:cursor-not-allowed hover:border-violet-500 hover:text-violet-300`}
              >
                −
              </button>
              <div className="flex-1 text-center text-[14px] text-violet-300 font-medium">
                Ребай{sp.rebuys > 0 ? ` ×${sp.rebuys}` : ''}
                {activeSession.maxRebuys > 0 && (
                  <span className="text-[#555]">/{activeSession.maxRebuys}</span>
                )}
              </div>
              <button
                onClick={() => doRebuy(sp.id)}
                disabled={activeSession.maxRebuys > 0 && sp.rebuys >= activeSession.maxRebuys}
                className={`${btnBase} w-11 h-11 text-[20px] bg-[#2a2040] border-[#443366] text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#3a2060]`}
              >
                +
              </button>
            </div>
          )}

          {/* Addon controls */}
          {activeSession.addonCost > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => undoAddon(sp.id)}
                disabled={!sp.hasAddon}
                className={`${btnBase} w-11 h-11 text-[20px] bg-[#1a1a1a] border-[#333] text-[#888] disabled:opacity-30 disabled:cursor-not-allowed hover:border-green-500 hover:text-green-300`}
              >
                −
              </button>
              <div className={`flex-1 text-center text-[14px] font-medium ${sp.hasAddon ? 'text-green-400' : 'text-[#555]'}`}>
                {sp.hasAddon ? 'Аддон ✓' : 'Аддон'}
              </div>
              <button
                onClick={() => !sp.hasAddon && doAddon(sp.id)}
                disabled={sp.hasAddon}
                className={`${btnBase} w-11 h-11 text-[20px] bg-[#1a2a1a] border-[#336633] text-green-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#2a3a2a]`}
              >
                +
              </button>
            </div>
          )}

          {/* Eliminate / Winner + Minute */}
          <div className="flex gap-2">
            {isLastPlayer ? (
              <button
                onClick={() => declareWinner(sp.id)}
                className={`${btnBase} flex-1 py-3 text-[15px] bg-yellow-900 border-yellow-700 text-yellow-300 hover:bg-yellow-800`}
              >
                🏆 Победитель
              </button>
            ) : (
              <button
                onClick={() => eliminatePlayer(sp.id)}
                className={`${btnBase} flex-1 py-3 text-[15px] bg-red-900 border-red-700 text-red-300 hover:bg-red-800`}
              >
                Вылетел:а
              </button>
            )}
            <button
              onClick={() => { startMinute(player.name, player.id); setExpanded(false); }}
              className={`${btnBase} py-3 px-4 text-[15px] bg-[#1a2030] border-[#334466] text-blue-300 hover:bg-[#2a3050]`}
            >
              ⏱ Минуту!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Eliminated player row ── */
function EliminatedAdminRow({ sp, player }: { sp: SessionPlayer; player: Player }) {
  const { undoEliminate } = useGame();
  return (
    <div className="flex items-center gap-3 bg-[#1e1e1e] rounded-2xl px-4 py-3">
      <Avatar player={player} size={36} />
      <span className="flex-1 text-[15px] text-[#555] line-through">{player.name}</span>
      <span className="text-[12px] text-[#444] mr-2">{sp.finishPosition}-е</span>
      <button
        onClick={() => undoEliminate(sp.id)}
        className="text-[13px] bg-[#2a2020] border border-[#664444] text-[#cc8888] rounded-xl px-3 py-2 cursor-pointer hover:bg-[#3a2020] active:scale-95 transition-transform"
      >
        ↩ вернуть
      </button>
    </div>
  );
}

/* ── Main admin panel ── */
export function MobileAdminPanel({ onClose }: Props) {
  const { activeSession, sessionPlayers, players } = useGame();
  const { state: timerState, dispatch: timerDispatch } = useTimer();

  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const eliminated = sessionPlayers
    .filter(p => p.status === 'eliminated' || p.status === 'winner')
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

  const btnToggle = (active: boolean) =>
    `flex-1 py-3 rounded-xl border font-semibold text-[13px] cursor-pointer active:scale-95 transition-all ${
      active
        ? 'bg-violet-900 border-violet-600 text-violet-200'
        : 'bg-[#242424] border-[#333] text-[#555]'
    }`;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1a1a1a] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] shrink-0">
        <div>
          <div className="text-[11px] text-[#444] tracking-[3px] uppercase">Режим</div>
          <div className="text-[18px] font-bold text-[#ccc]">Администратор</div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center bg-[#2a2a2a] border border-[#333] rounded-full text-[#888] text-[18px] cursor-pointer hover:text-white hover:border-[#555] active:scale-95 transition-transform"
        >
          ✕
        </button>
      </div>

      {/* Display toggles */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="text-[11px] text-[#444] tracking-[2px] uppercase mb-2 px-1">Экран</div>
        <div className="flex gap-2">
          <button
            onClick={() => timerDispatch({ type: 'TOGGLE_GAME_PANEL' })}
            className={btnToggle(timerState.config.showPlayers)}
          >
            👥 Игроки
          </button>
          <button
            onClick={() => timerDispatch({ type: 'TOGGLE_COMBOS' })}
            className={btnToggle(timerState.config.showCombos !== false)}
          >
            🃏 Комбинации
          </button>
        </div>
      </div>

      {/* Content */}
      {!activeSession ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-8">
            <div className="text-4xl mb-4">🃏</div>
            <p className="text-[#555] text-[15px]">Активная игра не найдена</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 flex flex-col gap-4">
          {/* Active players */}
          {activePlayers.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="text-[11px] text-[#444] tracking-[2px] uppercase px-1">
                В игре ({activePlayers.length})
              </div>
              {activePlayers.map(sp => {
                const player = players.find(p => p.id === sp.playerId);
                if (!player) return null;
                return <PlayerAdminRow key={sp.id} sp={sp} player={player} />;
              })}
            </div>
          )}

          {/* Eliminated players */}
          {eliminated.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] text-[#444] tracking-[2px] uppercase px-1">
                Вылетели ({eliminated.length})
              </div>
              {eliminated.map(sp => {
                const player = players.find(p => p.id === sp.playerId);
                if (!player) return null;
                return <EliminatedAdminRow key={sp.id} sp={sp} player={player} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
