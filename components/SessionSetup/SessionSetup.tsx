'use client';
import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useTimer } from '@/context/TimerContext';
import { PrizeConfig } from './PrizeConfig';
import type { NewSessionData } from '@/types/game';

export function SessionSetup() {
  const { players, sessionPlayers, activeSession, startSession } = useGame();
  const { dispatch: timerDispatch } = useTimer();

  const [buyIn, setBuyIn] = useState(String(activeSession?.buyIn ?? 1000));
  const [initialStack, setInitialStack] = useState(String(activeSession?.initialStack ?? 2000));
  const [rebuyCost, setRebuyCost] = useState(String(activeSession?.rebuyCost ?? 1000));
  const [rebuyChips, setRebuyChips] = useState(String(activeSession?.rebuyChips ?? 2000));
  const [addonCost, setAddonCost] = useState(String(activeSession?.addonCost ?? 1000));
  const [addonChips, setAddonChips] = useState(String(activeSession?.addonChips ?? 3000));
  const [prizeSpots, setPrizeSpots] = useState(activeSession?.prizeSpots ?? 3);
  const [prizePcts, setPrizePcts] = useState<number[]>(activeSession?.prizePcts ?? [50, 30, 20]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    activeSession ? new Set(sessionPlayers.map(sp => sp.playerId)) : new Set()
  );
  const [starting, setStarting] = useState(false);

  const locked = !!activeSession;

  function togglePlayer(id: string) {
    if (locked) return;
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleStart() {
    if (selectedPlayerIds.size < 2) { alert('Выберите минимум 2 игрока'); return; }
    const sum = prizePcts.reduce((a, b) => a + b, 0);
    if (sum !== 100) { alert('Сумма призовых процентов должна быть 100%'); return; }

    const data: NewSessionData = {
      buyIn: parseInt(buyIn, 10) || 0,
      initialStack: parseInt(initialStack, 10) || 0,
      rebuyCost: parseInt(rebuyCost, 10) || 0,
      rebuyChips: parseInt(rebuyChips, 10) || 0,
      addonCost: parseInt(addonCost, 10) || 0,
      addonChips: parseInt(addonChips, 10) || 0,
      prizeSpots,
      prizePcts,
    };

    setStarting(true);
    await startSession(data, Array.from(selectedPlayerIds));
    timerDispatch({ type: 'RESTART' });
    setStarting(false);
  }

  const numInput = (disabled: boolean) =>
    `bg-[#333] border rounded-[6px] text-white px-3 py-2 text-[15px] font-bold w-full focus:outline-none tabular-nums ${
      disabled
        ? 'border-[#333] text-[#666] cursor-not-allowed'
        : 'border-[#444] focus:border-violet-600'
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* Section label */}
      <div className="flex items-center gap-2">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase">Игра</div>
        {locked && (
          <span className="text-[10px] text-[#444] tracking-[1px] uppercase bg-[#242424] px-2 py-0.5 rounded-full">
            🔒 активная сессия
          </span>
        )}
      </div>

      {/* Financial fields */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Взнос (RSD)', val: buyIn, set: setBuyIn },
          { label: 'Начальный стек', val: initialStack, set: setInitialStack },
          { label: 'Ребай (RSD)', val: rebuyCost, set: setRebuyCost },
          { label: 'Фишек за ребай', val: rebuyChips, set: setRebuyChips },
          { label: 'Аддон (RSD)', val: addonCost, set: setAddonCost },
          { label: 'Фишек за аддон', val: addonChips, set: setAddonChips },
        ].map(({ label, val, set }) => (
          <div key={label} className="bg-[#242424] rounded-lg p-3">
            <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-2">{label}</label>
            <input
              type="number"
              min="0"
              value={val}
              onChange={e => !locked && set(e.target.value)}
              disabled={locked}
              className={numInput(locked)}
            />
          </div>
        ))}
      </div>

      {/* Prize config */}
      <div className={`bg-[#242424] rounded-lg p-4 ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-3">Призовые места</div>
        <PrizeConfig
          spots={prizeSpots}
          pcts={prizePcts}
          onSpotsChange={setPrizeSpots}
          onPctsChange={setPrizePcts}
        />
      </div>

      {/* Player selection */}
      <div className="bg-[#242424] rounded-lg p-4">
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-3">
          {locked ? 'Участники' : `Кто играет сегодня (${selectedPlayerIds.size} выбрано)`}
        </div>
        {players.length === 0 ? (
          <p className="text-[#555] text-[13px]">Добавьте игроков во вкладке «Игроки»</p>
        ) : (
          <div className="flex flex-col gap-2">
            {players.map(player => (
              <label
                key={player.id}
                className={`flex items-center gap-3 ${locked ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPlayerIds.has(player.id)}
                  onChange={() => togglePlayer(player.id)}
                  disabled={locked}
                  className="w-4 h-4 accent-violet-600 disabled:cursor-not-allowed"
                />
                <span className={`text-[14px] ${locked ? 'text-[#888]' : 'text-[#ccc]'}`}>{player.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Start button — hidden when locked */}
      {!locked && (
        <button
          onClick={handleStart}
          disabled={starting || selectedPlayerIds.size < 2}
          className="bg-green-700 text-white border-none rounded-lg py-3 text-[15px] font-semibold cursor-pointer hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? 'Запускаем...' : '▶ Начать игру'}
        </button>
      )}
    </div>
  );
}
