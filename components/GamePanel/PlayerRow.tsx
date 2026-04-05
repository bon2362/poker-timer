// components/GamePanel/PlayerRow.tsx
'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Avatar } from '../PlayerManager/PlayerManager';
import type { SessionPlayer } from '@/types/game';

type Props = { sp: SessionPlayer };

export function PlayerRow({ sp }: Props) {
  const { players, activeSession, doRebuy, doAddon, eliminatePlayer, declareWinner, sessionPlayers } = useGame();
  const [confirming, setConfirming] = useState(false);
  const player = players.find(p => p.id === sp.playerId);
  if (!player || !activeSession) return null;

  const activePlayers = sessionPlayers.filter(p => p.status === 'playing');
  const isLastPlayer = activePlayers.length === 1 && sp.status === 'playing';

  if (sp.status === 'eliminated' || sp.status === 'winner') {
    return (
      <div className="flex items-center gap-3 py-2 opacity-50">
        <Avatar player={player} size={32} />
        <span className="flex-1 text-[13px] text-[#666] line-through">{player.name}</span>
        <span className="text-[11px] text-[#444]">{sp.finishPosition}-е</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2 border-b border-[#242424] last:border-0">
      <div className="flex items-center gap-3">
        <Avatar player={player} size={36} />
        <span
          className="flex-1 text-[14px] text-[#ccc] cursor-pointer hover:text-white"
          onClick={() => !isLastPlayer && setConfirming(c => !c)}
        >
          {player.name}
        </span>
        {activeSession.rebuyCost > 0 && (
          <button
            onClick={() => doRebuy(sp.id)}
            className="text-[11px] bg-[#2a2040] border border-[#443366] text-violet-400 rounded px-2 py-1 cursor-pointer hover:bg-[#3a2060]"
          >
            Ребай{sp.rebuys > 0 ? ` ×${sp.rebuys}` : ''}
          </button>
        )}
        {activeSession.addonCost > 0 && (
          <button
            onClick={() => !sp.hasAddon && doAddon(sp.id)}
            disabled={sp.hasAddon}
            className={`text-[11px] rounded px-2 py-1 cursor-pointer border ${
              sp.hasAddon
                ? 'bg-transparent border-[#333] text-[#444] cursor-not-allowed'
                : 'bg-[#1a2a1a] border-[#336633] text-green-400 hover:bg-[#2a3a2a]'
            }`}
          >
            {sp.hasAddon ? 'Аддон ✓' : 'Аддон'}
          </button>
        )}
      </div>

      {confirming && !isLastPlayer && (
        <div className="flex items-center gap-2 pl-[48px]">
          <span className="text-[12px] text-[#888]">Вылетел?</span>
          <button
            onClick={async () => { await eliminatePlayer(sp.id); setConfirming(false); }}
            className="text-[12px] bg-red-900 border border-red-700 text-red-300 rounded px-3 py-1 cursor-pointer hover:bg-red-800"
          >
            Да, вылетел
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[12px] bg-transparent border border-[#333] text-[#666] rounded px-3 py-1 cursor-pointer"
          >
            Отмена
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
