'use client';
import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getTimerChannel } from '@/supabase/client';
import { fetchTimerState, saveTimerState } from '@/lib/supabase/timerState';
import type { TimerState, Action } from '@/types/timer';

type TimerContextValue = {
  state: TimerState;
  dispatch: React.Dispatch<Action>;
};

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(timerReducer, undefined, createInitialState);
  const suppressUntilRef = useRef<number>(0);
  const channelRef = useRef(getTimerChannel(process.env.NEXT_PUBLIC_SESSION_ID ?? 'main'));
  // Always-current ref for the periodic save interval
  const stateRef = useRef(state);
  stateRef.current = state;

  // Timer tick
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(id);
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
    if (event !== 'tick') suppressUntilRef.current = now + 3500;
    playSound(event);
    dispatch({ type: 'CLEAR_SOUND' });
  }, [state.pendingSound]);

  // --- Restore timer state from DB on mount ---
  useEffect(() => {
    fetchTimerState().then(saved => {
      if (saved) dispatch({ type: 'RESTORE_STATE', payload: saved });
    });
  }, []);

  // --- Persist timer state to DB every 5 seconds ---
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      saveTimerState({
        currentStage: s.currentStage,
        timeLeft: s.timeLeft,
        isPaused: s.isPaused,
        isOver: s.isOver,
        warnedOneMin: s.warnedOneMin,
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // --- Realtime: subscribe + receive state from other devices ---
  useEffect(() => {
    const channel = channelRef.current;
    // Receive state broadcast from other devices (self: false ensures no echo)
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      dispatch({ type: 'RESTORE_STATE', payload });
    });
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  // --- Realtime: send state every second so other devices stay in sync ---
  useEffect(() => {
    channelRef.current.send({
      type: 'broadcast',
      event: 'state',
      payload: {
        currentStage: state.currentStage,
        timeLeft: state.timeLeft,
        isPaused: state.isPaused,
        isOver: state.isOver,
        warnedOneMin: state.warnedOneMin,
      },
    });
  }, [state.currentStage, state.timeLeft, state.isPaused, state.isOver, state.warnedOneMin]);

  return (
    <TimerContext.Provider value={{ state, dispatch }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
