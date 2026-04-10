'use client';
import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getClient, getTimerChannel } from '@/supabase/client';
import { fetchTimerState, parsePersistedStages, saveTimerState } from '@/lib/supabase/timerState';
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

  // Echo suppression: skip sync effect when state came from a broadcast or DB change
  const fromBroadcastRef = useRef(false);
  const fromDisplayBroadcastRef = useRef(false);
  const fromDatabaseRef = useRef(false);

  // Track previous sync-relevant values to detect changes
  const prevSyncRef = useRef({
    currentStage: state.currentStage,
    anchorTs: state.anchorTs,
    isPaused: state.isPaused,
    isOver: state.isOver,
  });

  const prevDisplayRef = useRef({
    showCombos: state.config.showCombos,
    showPlayers: state.config.showPlayers,
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
    channel.on('broadcast', { event: 'display' }, ({ payload }) => {
      fromDisplayBroadcastRef.current = true;
      dispatch({ type: 'RESTORE_DISPLAY', showCombos: payload.showCombos, showPlayers: payload.showPlayers });
    });
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  // --- Event-driven sync: persist + broadcast only when significant state changes ---
  useEffect(() => {
    // Skip if this change came from a broadcast or DB update (avoid echo loop)
    if (fromBroadcastRef.current || fromDatabaseRef.current) {
      fromBroadcastRef.current = false;
      fromDatabaseRef.current = false;
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

    const stage = state.stages[state.currentStage];
    const payload = {
      currentStage: state.currentStage,
      anchorTs: state.anchorTs,
      elapsedBeforePause: state.elapsedBeforePause,
      isPaused: state.isPaused,
      isOver: state.isOver,
      warnedOneMin: state.warnedOneMin,
      // Stage info for iOS Live Activity
      stageType: stage.type,
      levelNum: stage.type === 'level' ? stage.levelNum : 0,
      sb: stage.type === 'level' ? stage.sb : 0,
      bb: stage.type === 'level' ? stage.bb : 0,
      stageDurationSecs: stage.duration,
      // Full stage list for backend RPC navigation (apply_timer_command)
      stages: state.stages,
    };

    // Save to DB + broadcast to other devices (only when WebSocket is connected)
    saveTimerState(payload);
    if (channelRef.current.state === 'joined') {
      channelRef.current.send({ type: 'broadcast', event: 'state', payload });
    }
  }, [state.currentStage, state.anchorTs, state.isPaused, state.isOver, state.elapsedBeforePause, state.warnedOneMin]);

  // --- iOS remote control via RPC ---
  // iOS calls apply_timer_command RPC → timer_state UPDATE with source='ios'.
  // When iOS calls apply_timer_command RPC, it updates timer_state with source='ios'.
  // The web picks that up here and syncs without re-saving to DB (echo suppression).
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    const channel = client
      .channel('timer-state-ios-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'timer_state', filter: 'id=eq.main' },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          // Ignore our own saves (source='web'); only process RPC writes (source='ios')
          if (row.source !== 'ios') return;
          fromDatabaseRef.current = true;
          dispatch({
            type: 'RESTORE_STATE',
            payload: {
              currentStage: row.current_stage as number,
              anchorTs: row.anchor_ts as number,
              elapsedBeforePause: row.elapsed_before_pause as number,
              isPaused: row.is_paused as boolean,
              isOver: row.is_over as boolean,
              warnedOneMin: row.warned_one_min as boolean,
              stageType: row.stage_type === 'break' ? 'break' : 'level',
              levelNum: (row.level_num as number) ?? 0,
              sb: (row.sb as number) ?? 0,
              bb: (row.bb as number) ?? 0,
              stageDurationSecs: (row.stage_duration_secs as number) ?? undefined,
              stages: parsePersistedStages(row.stages_json),
            },
          });
        }
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [dispatch]);

  // --- Broadcast display config changes (showCombos / showPlayers) ---
  useEffect(() => {
    if (fromDisplayBroadcastRef.current) {
      fromDisplayBroadcastRef.current = false;
      prevDisplayRef.current = { showCombos: state.config.showCombos, showPlayers: state.config.showPlayers };
      return;
    }

    const prev = prevDisplayRef.current;
    if (state.config.showCombos === prev.showCombos && state.config.showPlayers === prev.showPlayers) return;

    prevDisplayRef.current = { showCombos: state.config.showCombos, showPlayers: state.config.showPlayers };

    if (channelRef.current.state === 'joined') {
      channelRef.current.send({
        type: 'broadcast', event: 'display',
        payload: { showCombos: state.config.showCombos, showPlayers: state.config.showPlayers },
      });
    }
  }, [state.config.showCombos, state.config.showPlayers]);

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
