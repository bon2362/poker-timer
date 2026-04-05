'use client';
import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getTimerChannel } from '@/supabase/client';
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
      payload: { currentStage: state.currentStage, timeLeft: state.timeLeft, isPaused: state.isPaused },
    });
  }, [state.currentStage, state.timeLeft, state.isPaused]);

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
