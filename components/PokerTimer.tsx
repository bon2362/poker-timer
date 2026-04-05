'use client';
import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getTimerChannel } from '@/supabase/client';
import { BlindInfo } from './BlindInfo';
import { TimerDisplay } from './TimerDisplay';
import { Controls } from './Controls';
import { CombosPanel } from './CombosPanel';
import { SettingsScreen } from './SettingsScreen';
import type { Config } from '@/types/timer';

export function PokerTimer() {
  const [state, dispatch] = useReducer(timerReducer, undefined, createInitialState);
  const suppressUntilRef = useRef<number>(0);
  const channelRef = useRef(getTimerChannel(process.env.NEXT_PUBLIC_SESSION_ID ?? 'main'));
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer interval
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
  }, []);

  // Clock display
  const clock = useClockState();

  // Auto-hide controls on mouse inactivity
  useEffect(() => {
    function showControls() {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }
    document.addEventListener('mousemove', showControls);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => {
      document.removeEventListener('mousemove', showControls);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Audio side effects
  useEffect(() => {
    if (!state.pendingSound) return;
    const event = state.pendingSound;
    const now = Date.now();
    if (event === 'tick' && now < suppressUntilRef.current) {
      dispatch({ type: 'CLEAR_SOUND' });
      return;
    }
    if (event !== 'tick') {
      suppressUntilRef.current = now + 3500;
    }
    playSound(event);
    dispatch({ type: 'CLEAR_SOUND' });
  }, [state.pendingSound]);

  // Supabase broadcast — subscribe once
  useEffect(() => {
    const channel = channelRef.current;
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  // Supabase broadcast — send state on change
  useEffect(() => {
    channelRef.current.send({
      type: 'broadcast',
      event: 'state',
      payload: {
        currentStage: state.currentStage,
        timeLeft: state.timeLeft,
        isPaused: state.isPaused,
      },
    });
  }, [state.currentStage, state.timeLeft, state.isPaused]);

  // Keyboard: Space → toggle pause
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_PAUSE' });
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleSaveSettings = useCallback((config: Config) => {
    dispatch({ type: 'SAVE_SETTINGS', config });
  }, []);

  const stage = state.stages[state.currentStage];
  const isWarning = state.timeLeft <= 60 && state.timeLeft >= 0 && stage.type !== 'break';

  // Compute next blind info for bottom bar
  const nextStage = state.stages[state.currentStage + 1];
  let nextText = '';
  if (!nextStage) {
    nextText = 'Финал';
  } else if (nextStage.type === 'break') {
    const afterBreak = state.stages[state.currentStage + 2];
    const afterStr = afterBreak?.type === 'level' ? ` → ${afterBreak.sb}/${afterBreak.bb}` : '';
    nextText = `☕ Перерыв ${state.config.breakDuration} мин${afterStr}`;
  } else {
    nextText = `${nextStage.sb} / ${nextStage.bb}`;
  }

  if (state.screen === 'settings') {
    return (
      <SettingsScreen
        config={state.config}
        onSave={handleSaveSettings}
        onClose={() => dispatch({ type: 'CLOSE_SETTINGS' })}
        onJumpToEnd={() => {
          dispatch({ type: 'JUMP_TO_END' });
          dispatch({ type: 'CLOSE_SETTINGS' });
        }}
      />
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden select-none transition-[background] duration-[1500ms] ${isWarning ? 'bg-[#3a1a0a]' : 'bg-[#1a1a1a]'}`}>
      {/* Top bar */}
      <div className="relative w-full px-7 pt-5">
        <BlindInfo
          stage={stage}
          breakDuration={state.config.breakDuration}
        />
        <div className="absolute top-5 right-7 flex gap-1 items-center">
          <button
            className="bg-transparent border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={toggleFullscreen}
            title="Fullscreen"
          >
            ⛶
          </button>
          <button
            className="bg-transparent border-none text-[#555] text-[20px] cursor-pointer p-1 w-8"
            onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Timer + progress */}
      {!state.isOver && (
        <TimerDisplay
          timeLeft={state.timeLeft}
          stage={stage}
          isPaused={state.isPaused}
        />
      )}

      {/* Tournament over screen */}
      {state.isOver && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <h1 className="text-[48px] font-black text-violet-600">Tournament Over</h1>
          <p className="text-[#888] text-[18px]">Хорошая игра!</p>
          <button
            className="bg-violet-700 text-white border-none rounded-lg px-6 h-11 text-[15px] cursor-pointer hover:bg-violet-800"
            onClick={() => dispatch({ type: 'RESTART' })}
          >
            ↺ Начать заново
          </button>
        </div>
      )}

      {/* Controls */}
      {!state.isOver && (
        <Controls
          isPaused={state.isPaused}
          isOver={state.isOver}
          visible={controlsVisible}
          onPrev={() => dispatch({ type: 'PREV_STAGE' })}
          onTogglePause={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          onNext={() => dispatch({ type: 'NEXT_STAGE' })}
        />
      )}

      {/* Combos panel */}
      {!state.isOver && (
        <CombosPanel
          visible={state.config.showCombos !== false}
          onToggle={() => dispatch({ type: 'TOGGLE_COMBOS' })}
        />
      )}

      {/* Next blind info */}
      {!state.isOver && nextText && (
        <div className="pb-[22px] text-center text-[13px] text-[#444] tracking-[0.5px] pointer-events-none">
          <span className="text-[#383838]">Далее: </span>{nextText}
        </div>
      )}

      {/* Clock */}
      <div className="fixed bottom-[18px] right-7 text-[28px] font-bold text-[#444] tabular-nums tracking-[2px] pointer-events-none">
        {clock}
      </div>
    </div>
  );
}

function useClockState(): string {
  const [clock, setClock] = useState('00:00');
  useEffect(() => {
    function update() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClock(`${h}:${m}`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return clock;
}
