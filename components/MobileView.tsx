'use client';
import { useEffect, useState } from 'react';
import { useTimer } from '@/context/TimerContext';
import { formatTime } from '@/lib/timer';
import type { Stage } from '@/types/timer';

/* ── Blind info (inline, portrait-optimised) ── */
function MobileBlindInfo({ stage, breakDuration }: { stage: Stage; breakDuration: number }) {
  if (stage.type === 'break') {
    return (
      <div className="text-center">
        <div className="text-[12px] text-[#666] tracking-[3px] uppercase mb-1">☕ Перерыв</div>
        <div className="text-[48px] font-bold text-blue-400 leading-tight">{breakDuration} мин</div>
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="text-[12px] text-[#666] tracking-[3px] uppercase mb-1">Round {stage.levelNum}</div>
      <div className="text-[52px] font-bold text-white leading-tight">{stage.sb} / {stage.bb}</div>
    </div>
  );
}

/* ── Clock ── */
function Clock() {
  const [clock, setClock] = useState('');
  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-[#333] text-[20px] font-bold tabular-nums">{clock}</span>;
}

/* ── Main mobile view ── */
export function MobileView() {
  const { state, dispatch } = useTimer();

  const stage = state.stages[state.currentStage];
  const isWarning = state.timeLeft <= 60 && state.timeLeft >= 0 && stage.type !== 'break';
  const isBreak = stage.type === 'break';
  const isOvertime = state.timeLeft < 0;

  const timerColor = isOvertime
    ? 'text-red-500'
    : isWarning
    ? 'text-orange-400'
    : isBreak
    ? 'text-blue-400'
    : 'text-white';

  const progressColor = isBreak
    ? 'bg-blue-600'
    : isWarning
    ? 'bg-orange-400'
    : 'bg-violet-700';

  const elapsed = stage.duration - state.timeLeft;
  const pct = Math.min(100, Math.max(0, (elapsed / stage.duration) * 100));

  // Next stage label
  const nextStage = state.stages[state.currentStage + 1];
  let nextText = '';
  if (!nextStage) nextText = 'Финал';
  else if (nextStage.type === 'break') {
    const afterBreak = state.stages[state.currentStage + 2];
    const after = afterBreak?.type === 'level' ? ` → ${afterBreak.sb}/${afterBreak.bb}` : '';
    nextText = `☕ Перерыв ${state.config.breakDuration} мин${after}`;
  } else {
    nextText = `${nextStage.sb} / ${nextStage.bb}`;
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden select-none transition-[background] duration-[1500ms] ${isWarning ? 'bg-[#3a1a0a]' : 'bg-[#1a1a1a]'}`}>

      {/* Top: blind info */}
      <div className="flex items-center justify-center pt-10 pb-2 px-6">
        <MobileBlindInfo stage={stage} breakDuration={state.config.breakDuration} />
      </div>

      {/* Center: timer */}
      <div className="flex-1 flex items-center justify-center relative">
        {state.isPaused && (
          <div
            className="absolute pointer-events-none font-black text-white/[0.10]"
            style={{ fontSize: 'clamp(80px, 28vw, 180px)', letterSpacing: '0.1em' }}
          >
            PAUSE
          </div>
        )}
        <div
          className={`font-black tabular-nums tracking-[-2px] transition-opacity ${timerColor} ${state.isPaused ? 'opacity-30' : 'opacity-100'}`}
          style={{ fontSize: 'clamp(88px, 24vw, 160px)' }}
        >
          {formatTime(state.timeLeft)}
        </div>
      </div>

      {/* Bottom: play/pause + next + clock */}
      <div className="flex flex-col items-center gap-5 pb-10 px-8">
        {/* Next blind */}
        {!state.isOver && nextText && (
          <div className="text-center">
            <div className="text-[10px] text-[#383838] tracking-[2px] uppercase mb-1">Далее</div>
            <div className="text-[28px] font-bold text-[#444]">{nextText}</div>
          </div>
        )}

        {/* Play / Pause button */}
        {!state.isOver && (
          <button
            onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
            className={`w-full max-w-[280px] py-5 rounded-2xl text-[28px] font-bold border-none cursor-pointer transition-colors active:scale-95 ${
              state.isPaused
                ? 'bg-violet-700 text-white hover:bg-violet-600'
                : 'bg-[#2a2a2a] text-[#666] hover:bg-[#333]'
            }`}
          >
            {state.isPaused ? '▶' : '⏸'}
          </button>
        )}

        {/* Clock */}
        <Clock />
      </div>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0">
        <div className="h-[3px] bg-[#333]">
          <div
            className={`h-full ${progressColor} ${isOvertime ? 'w-full' : 'transition-[width] duration-[900ms]'}`}
            style={isOvertime ? {} : { width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
