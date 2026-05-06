'use client';
import { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { timerReducer } from '@/reducer/timerReducer';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getClient, getTimerChannel } from '@/supabase/client';
import { fetchAppConfig, normalizeConfig, saveAppConfig } from '@/lib/supabase/appConfig';
import { fetchTimerState, isPersistedTimerStateStaleForSession, parsePersistedStages, saveTimerState } from '@/lib/supabase/timerState';
import { useGame } from '@/context/GameContext';
import type { TimerState, Action, DisplayConfigSnapshot } from '@/types/timer';

type TimerContextValue = {
  state: TimerState;
  dispatch: React.Dispatch<Action>;
};

type SyncSnapshot = Pick<TimerState, 'currentStage' | 'anchorTs' | 'elapsedBeforePause' | 'isPaused' | 'isOver' | 'warnedOneMin'>;

const TimerContext = createContext<TimerContextValue | null>(null);

function toSyncSnapshot(payload: SyncSnapshot): SyncSnapshot {
  return {
    currentStage: payload.currentStage,
    anchorTs: payload.anchorTs,
    elapsedBeforePause: payload.elapsedBeforePause,
    isPaused: payload.isPaused,
    isOver: payload.isOver,
    warnedOneMin: payload.warnedOneMin,
  };
}

function syncSnapshotMatchesState(snapshot: SyncSnapshot, state: TimerState): boolean {
  return (
    snapshot.currentStage === state.currentStage &&
    snapshot.anchorTs === state.anchorTs &&
    snapshot.elapsedBeforePause === state.elapsedBeforePause &&
    snapshot.isPaused === state.isPaused &&
    snapshot.isOver === state.isOver &&
    snapshot.warnedOneMin === state.warnedOneMin
  );
}

function toDisplaySnapshot(state: TimerState): DisplayConfigSnapshot {
  return {
    showCombos: state.config.showCombos,
    showPlayers: state.config.showPlayers,
    slideshowEnabled: state.config.slideshowEnabled,
    slideshowSpeed: state.config.slideshowSpeed,
    breakSongEnabled: state.config.breakSongEnabled,
  };
}

function displaySnapshotMatchesState(snapshot: DisplayConfigSnapshot, state: TimerState): boolean {
  return (
    snapshot.showCombos === state.config.showCombos &&
    snapshot.showPlayers === state.config.showPlayers &&
    snapshot.slideshowEnabled === state.config.slideshowEnabled &&
    snapshot.slideshowSpeed === state.config.slideshowSpeed &&
    snapshot.breakSongEnabled === state.config.breakSongEnabled
  );
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(timerReducer, undefined, createInitialState);
  const { activeSession, loading: gameLoading } = useGame();
  const suppressUntilRef = useRef<number>(0);
  const channelRef = useRef(getTimerChannel(process.env.NEXT_PUBLIC_SESSION_ID ?? 'main'));
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Echo suppression: skip sync effect only for the exact state received from another source.
  const suppressSyncSnapshotRef = useRef<SyncSnapshot | null>(null);
  const fromDisplayBroadcastRef = useRef(false);

  // Track session createdAt to detect session end vs start
  const prevSessionCreatedAtRef = useRef(activeSession?.createdAt);

  // Track previous sync-relevant values to detect changes
  const prevSyncRef = useRef({
    currentStage: state.currentStage,
    anchorTs: state.anchorTs,
    isPaused: state.isPaused,
    isOver: state.isOver,
  });

  const prevDisplayRef = useRef(toDisplaySnapshot(state));
  const saveConfigQueueRef = useRef<Promise<void>>(Promise.resolve());
  const appConfigRestoringRef = useRef(false);
  const didStartConfigPersistRef = useRef(false);

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

  // --- Restore timer state from DB on mount / session change ---
  useEffect(() => {
    if (gameLoading) return;

    const prevCreatedAt = prevSessionCreatedAtRef.current;
    prevSessionCreatedAtRef.current = activeSession?.createdAt;

    // Session just ended (was active, now null) — keep current timer state
    // (already paused by handleFinishGame), don't overwrite from DB
    if (prevCreatedAt && !activeSession?.createdAt) return;

    let cancelled = false;

    fetchTimerState().then(saved => {
      if (cancelled || !saved) return;
      if (isPersistedTimerStateStaleForSession(saved.updatedAt, activeSession?.createdAt)) {
        dispatch({ type: 'RESTART' });
        return;
      }
      suppressSyncSnapshotRef.current = toSyncSnapshot(saved);
      dispatch({ type: 'RESTORE_STATE', payload: saved });
    });

    return () => { cancelled = true; };
  }, [activeSession?.createdAt, gameLoading]);

  // --- Restore durable app config from Supabase on cold start ---
  useEffect(() => {
    let cancelled = false;

    fetchAppConfig().then(config => {
      if (cancelled) return;
      if (config) {
        appConfigRestoringRef.current = true;
        dispatch({ type: 'RESTORE_CONFIG', config });
        return;
      }

      saveConfigQueueRef.current = saveConfigQueueRef.current
        .catch(() => {})
        .then(() => saveAppConfig(state.config));
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Realtime: subscribe + receive anchor state from other devices ---
  useEffect(() => {
    const channel = channelRef.current;
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      suppressSyncSnapshotRef.current = toSyncSnapshot(payload);
      dispatch({ type: 'RESTORE_STATE', payload });
    });
    channel.on('broadcast', { event: 'display' }, ({ payload }) => {
      fromDisplayBroadcastRef.current = true;
      dispatch({ type: 'RESTORE_DISPLAY', config: payload });
    });
    channel.subscribe();
    return () => {
      getClient()?.removeChannel(channel);
      channelRef.current = getTimerChannel(process.env.NEXT_PUBLIC_SESSION_ID ?? 'main');
    };
  }, []);

  // --- Realtime DB sync for durable app config ---
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    const channel = client
      .channel('app-config-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'id=eq.main' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          const config = normalizeConfig(row?.config_json);
          if (!config) return;
          appConfigRestoringRef.current = true;
          dispatch({ type: 'RESTORE_CONFIG', config });
        }
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, []);

  // --- Event-driven sync: persist + broadcast only when significant state changes ---
  useEffect(() => {
    // Skip only if this exact state came from a broadcast or DB update (avoid echo loop).
    // If the incoming state was identical and did not trigger this effect, the next local
    // user action will not match this snapshot and will still sync normally.
    const suppressedSnapshot = suppressSyncSnapshotRef.current;
    if (suppressedSnapshot && syncSnapshotMatchesState(suppressedSnapshot, state)) {
      suppressSyncSnapshotRef.current = null;
      prevSyncRef.current = {
        currentStage: state.currentStage,
        anchorTs: state.anchorTs,
        isPaused: state.isPaused,
        isOver: state.isOver,
      };
      return;
    }
    suppressSyncSnapshotRef.current = null;

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

    // Save local changes to DB in order; out-of-order RPC completion can otherwise
    // make a stale play/pause state look newer than the user's last action.
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => saveTimerState(payload));

    // Broadcast to other devices (only when WebSocket is connected)
    if (channelRef.current.state === 'joined') {
      channelRef.current.send({ type: 'broadcast', event: 'state', payload });
    }
  }, [state.currentStage, state.anchorTs, state.isPaused, state.isOver, state.elapsedBeforePause, state.warnedOneMin]);

  // --- Realtime DB sync ---
  // Broadcast is fast, but it can be missed by a temporarily disconnected device.
  // Treat timer_state as the durable fallback for both web and iOS writes.
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
          const restoredState: Extract<Action, { type: 'RESTORE_STATE' }>['payload'] = {
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
          };
          suppressSyncSnapshotRef.current = toSyncSnapshot(restoredState);
          dispatch({ type: 'RESTORE_STATE', payload: restoredState });
        }
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [dispatch]);

  // --- Broadcast display/media config changes ---
  useEffect(() => {
    if (fromDisplayBroadcastRef.current) {
      fromDisplayBroadcastRef.current = false;
      prevDisplayRef.current = toDisplaySnapshot(state);
      return;
    }

    const prev = prevDisplayRef.current;
    if (displaySnapshotMatchesState(prev, state)) return;

    prevDisplayRef.current = toDisplaySnapshot(state);

    if (channelRef.current.state === 'joined') {
      channelRef.current.send({
        type: 'broadcast', event: 'display',
        payload: toDisplaySnapshot(state),
      });
    }
  }, [
    state.config.showCombos,
    state.config.showPlayers,
    state.config.slideshowEnabled,
    state.config.slideshowSpeed,
    state.config.breakSongEnabled,
  ]);

  // Persist config changes to durable storage. localStorage remains a cache/fallback,
  // but Supabase app_config is the source of truth for cold-start clients.
  useEffect(() => {
    if (!didStartConfigPersistRef.current) {
      didStartConfigPersistRef.current = true;
      return;
    }

    if (appConfigRestoringRef.current) {
      appConfigRestoringRef.current = false;
      return;
    }

    saveConfigQueueRef.current = saveConfigQueueRef.current
      .catch(() => {})
      .then(() => saveAppConfig(state.config));
  }, [state.config]);

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
