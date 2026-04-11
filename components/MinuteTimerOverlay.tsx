'use client';
import { useMinuteTimer } from '@/context/MinuteTimerContext';
import { useGame } from '@/context/GameContext';
import { Avatar } from './PlayerManager/PlayerManager';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function MinuteTimerOverlay({ mobile }: { mobile?: boolean }) {
  const { state, stopMinute } = useMinuteTimer();
  const { players } = useGame();
  if (!state.active) return null;

  const player = players.find(p => p.id === state.playerId);

  const mins = Math.floor(state.timeLeft / 60);
  const secs = state.timeLeft % 60;
  const isExpired = state.timeLeft <= 0;
  const isWarning = state.timeLeft <= 10 && state.timeLeft > 0;

  const timerColor = isExpired
    ? 'text-red-500'
    : isWarning
    ? 'text-orange-400'
    : 'text-white';

  if (mobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 px-8 text-center">
          <div className="text-[13px] text-violet-400 tracking-[4px] uppercase font-semibold">
            Минуту!
          </div>
          {player && <Avatar player={player} size={80} />}
          <div className="text-[22px] font-bold text-white">
            {state.playerName}
          </div>
          <div
            className={`font-black tabular-nums tracking-[-2px] ${timerColor} transition-colors`}
            style={{ fontSize: 'clamp(100px, 30vw, 180px)' }}
          >
            {pad(mins)}:{pad(secs)}
          </div>
          {isExpired ? (
            <div className="text-red-400 text-[18px] font-bold animate-pulse">
              Время вышло!
            </div>
          ) : (
            <button
              onClick={stopMinute}
              className="mt-4 bg-[#2a2a2a] border border-[#444] text-[#aaa] rounded-2xl px-8 py-4 text-[16px] font-semibold cursor-pointer hover:border-[#666] hover:text-white active:scale-95 transition-all"
            >
              Решение принято
            </button>
          )}
        </div>
      </div>
    );
  }

  // Desktop overlay
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 px-8 text-center">
        <div className="text-[14px] text-violet-400 tracking-[5px] uppercase font-semibold">
          Минуту!
        </div>
        {player && <Avatar player={player} size={120} />}
        <div className="text-[28px] font-bold text-white">
          {state.playerName}
        </div>
        <div
          className={`font-black tabular-nums tracking-[-4px] ${timerColor} transition-colors`}
          style={{ fontSize: 'clamp(160px, 22vw, 280px)' }}
        >
          {pad(mins)}:{pad(secs)}
        </div>
        {isExpired ? (
          <div className="text-red-400 text-[24px] font-bold animate-pulse">
            Время вышло!
          </div>
        ) : (
          <button
            onClick={stopMinute}
            className="mt-2 bg-[#1e1e1e] border border-[#333] text-[#888] rounded-xl px-8 py-3 text-[15px] cursor-pointer hover:border-[#555] hover:text-[#ccc] transition-colors"
          >
            Решение принято
          </button>
        )}
      </div>
    </div>
  );
}
