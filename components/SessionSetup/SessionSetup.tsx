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
  const [maxRebuys, setMaxRebuys] = useState(String(activeSession?.maxRebuys ?? 1));
  const [addonCost, setAddonCost] = useState(String(activeSession?.addonCost ?? 1000));
  const [addonChips, setAddonChips] = useState(String(activeSession?.addonChips ?? 3000));
  const [prizeSpots, setPrizeSpots] = useState(activeSession?.prizeSpots ?? 3);
  const [prizePcts, setPrizePcts] = useState<number[]>(activeSession?.prizePcts ?? [50, 30, 20]);
  const [numberOfTables, setNumberOfTables] = useState<1 | 2>(
    activeSession?.numberOfTables === 2 ? 2 : 1
  );
  const [mergeThreshold, setMergeThreshold] = useState(String(activeSession?.mergeThreshold ?? 2));
  const [playerTables, setPlayerTables] = useState<Record<string, 1 | 2>>(() => {
    if (!activeSession) return {};
    return Object.fromEntries(
      sessionPlayers.map(sp => [sp.playerId, sp.tableNumber === 2 ? 2 : 1])
    );
  });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    activeSession ? new Set(sessionPlayers.map(sp => sp.playerId)) : new Set()
  );
  const [starting, setStarting] = useState(false);

  const locked = !!activeSession;

  function togglePlayer(id: string) {
    if (locked) return;
    setSelectedPlayerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setPlayerTables(tables => ({ ...tables, [id]: tables[id] ?? 1 }));
      }
      return next;
    });
  }

  function setPlayerTable(playerId: string, table: 1 | 2) {
    if (locked) return;
    setPlayerTables(prev => ({ ...prev, [playerId]: table }));
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
      maxRebuys: parseInt(maxRebuys, 10) || 0,
      addonCost: parseInt(addonCost, 10) || 0,
      addonChips: parseInt(addonChips, 10) || 0,
      prizeSpots,
      prizePcts,
      numberOfTables,
      mergeThreshold: numberOfTables === 2 ? (parseInt(mergeThreshold, 10) || 0) : 0,
      tablesMergedAt: null,
    };

    setStarting(true);
    const selectedIds = Array.from(selectedPlayerIds);
    const selectedTables = Object.fromEntries(
      selectedIds.map(id => [id, numberOfTables === 2 ? (playerTables[id] ?? 1) : 1])
    );
    await startSession(data, selectedIds, selectedTables);
    timerDispatch({ type: 'RESTART' });
    setStarting(false);
  }

  const numInput = (disabled: boolean) =>
    `bg-[#333] border rounded-[6px] text-white px-3 py-2 text-[15px] font-bold w-full focus:outline-none tabular-nums [appearance:textfield] ${
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
              type="text"
              inputMode="numeric"
              value={val}
              onChange={e => !locked && set(e.target.value.replace(/\D/g, ''))}
              onBlur={() => { if (!locked && val === '') set('0'); }}
              disabled={locked}
              className={numInput(locked)}
            />
          </div>
        ))}
      </div>

      {/* Max rebuys — shown only when rebuys are enabled */}
      {parseInt(rebuyCost, 10) > 0 && (
        <div className={`bg-[#242424] rounded-lg p-3 ${locked ? 'opacity-60' : ''}`}>
          <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-2">
            Макс. ребаев (0 = без лимита)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={maxRebuys}
            onChange={e => !locked && setMaxRebuys(e.target.value.replace(/\D/g, ''))}
            onBlur={() => { if (!locked && maxRebuys === '') setMaxRebuys('0'); }}
            disabled={locked}
            className={numInput(locked)}
          />
        </div>
      )}

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

      {/* Table setup */}
      <div className={`bg-[#242424] rounded-lg p-4 ${locked ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-1">Кол-во столов</div>
            <div className="text-[12px] text-[#666]">По умолчанию игра идёт за одним столом</div>
          </div>
          <div className="grid grid-cols-2 gap-1 bg-[#1a1a1a] border border-[#333] rounded-lg p-1 shrink-0">
            {[1, 2].map(value => (
              <button
                key={value}
                type="button"
                onClick={() => !locked && setNumberOfTables(value as 1 | 2)}
                disabled={locked}
                aria-pressed={numberOfTables === value}
                className={`min-w-10 rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors ${
                  numberOfTables === value
                    ? 'bg-violet-700 text-white'
                    : 'text-[#777] hover:text-[#ccc]'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {numberOfTables === 2 && (
          <div className="mt-4 border-t border-[#333] pt-4">
            <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-2">
              Порог объединения
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={mergeThreshold}
              onChange={e => !locked && setMergeThreshold(e.target.value.replace(/\D/g, ''))}
              onBlur={() => { if (!locked && mergeThreshold === '') setMergeThreshold('2'); }}
              disabled={locked}
              className={numInput(locked)}
            />
            <div className="mt-2 text-[12px] text-[#666]">
              Допустимый диапазон: [2, {Math.max(1, selectedPlayerIds.size - 1)}]
            </div>
          </div>
        )}
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
            {players.map(player => {
              const selected = selectedPlayerIds.has(player.id);
              return (
                <div key={player.id} className="flex items-center gap-3">
                  <label className={`flex min-w-0 flex-1 items-center gap-3 ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePlayer(player.id)}
                      disabled={locked}
                      className="w-4 h-4 accent-violet-600 disabled:cursor-not-allowed"
                    />
                    <span className={`min-w-0 flex-1 truncate text-[14px] ${locked ? 'text-[#888]' : 'text-[#ccc]'}`}>{player.name}</span>
                  </label>

                  {numberOfTables === 2 && selected && (
                    <div className="grid grid-cols-2 gap-1 bg-[#1a1a1a] border border-[#333] rounded-md p-1 shrink-0">
                      {[1, 2].map(value => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPlayerTable(player.id, value as 1 | 2)}
                          disabled={locked}
                          aria-pressed={(playerTables[player.id] ?? 1) === value}
                          className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                            (playerTables[player.id] ?? 1) === value
                              ? 'bg-violet-700 text-white'
                              : 'text-[#777] hover:text-[#ccc]'
                          }`}
                        >
                          Стол {value}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
