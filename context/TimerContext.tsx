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

  // Echo suppression: skip sync effect when state came from a broadcast
  const fromBroadcastRef = useRef(false);

  // Track previous sync-relevant values to detect changes
  const prevSyncRef = useRef({
    currentStage: state.currentStage,
    anchorTs: state.anchorTs,
    isPaused: state.isPaused,
    isOver: state.isOver,
  });

  // Timer tick — just recomputes timeLeft from anchor, no decrement
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

  // --- Realtime: subscribe + receive anchor state from other devices ---
  useEffect(() => {
    const channel = channelRef.current;
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      fromBroadcastRef.current = true;
      dispatch({ type: 'RESTORE_STATE', payload });
    });
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  // --- Event-driven sync: persist + broadcast only when significant state changes ---
  useEffect(() => {
    // Skip if this change came from a broadcast (avoid echo loop)
    if (fromBroadcastRef.current) {
      fromBroadcastRef.current = false;
      prevSyncRef.current = {
        currentStage: state.currentStage,
        anchorTs: state.anchorTs,
        isPaused: state.isPaused,
        isOver: state.isOver,
      };
      return;
    }

    const prev = prevSyncRef.current;
    const changed =
      state.currentStage !== prev.currentStage ||
      state.anchorTs !== prev.anchorTs ||
      state.isPaused !== prev.isPaused ||
      state.isOver !== prev.isOver;

    prevSyncRef.current = {
      currentStage: state.currentStage,
      anchorTs: state.anchorTs,
      isPaused: state.isPaused,
      isOver: state.isOver,
    };

    if (!changed) return;

    const payload = {
      currentStage: state.currentStage,
      anchorTs: state.anchorTs,
      elapsedBeforePause: state.elapsedBeforePause,
      isPaused: state.isPaused,
      isOver: state.isOver,
      warnedOneMin: state.warnedOneMin,
    };

    // Save to DB + broadcast to other devices (only when WebSocket is connected)
    saveTimerState(payload);
    if (channelRef.current.state === 'joined') {
      channelRef.current.send({ type: 'broadcast', event: 'state', payload });
    }
  }, [state.currentStage, state.anchorTs, state.isPaused, state.isOver, state.elapsedBeforePause, state.warnedOneMin]);

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
