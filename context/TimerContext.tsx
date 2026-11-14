'use client';
import { createContext, useCallback, useContext, useReducer, useEffect, useRef, useState, ReactNode } from 'react';
import { trackedTimerReducer } from '@/reducer/trackTransition';
import { logTimerEvent } from '@/lib/timerLog';
import { createInitialState } from '@/reducer/initialState';
import { playSound } from '@/lib/audio';
import { getClient, getTimerChannel } from '@/supabase/client';
import { subscribeChannel } from '@/supabase/channels';
import { fetchAppConfig, normalizeConfig, saveAppConfig } from '@/lib/supabase/appConfig';
import { advanceTimerStage, fetchTimerState, isPersistedTimerStateStaleForSession, parsePersistedStages, saveTimerState } from '@/lib/supabase/timerState';
import { useGame } from '@/context/GameContext';
import { markSessionStarted } from '@/lib/supabase/sessions';
import type { TimerState, Action } from '@/types/timer';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TimerContextValue = {
  state: TimerState;
  dispatch: React.Dispatch<Action>;
  configReady: boolean;
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

export function TimerProvider({ children, silent = false }: { children: ReactNode; silent?: boolean }) {
  const [state, rawDispatch] = useReducer(trackedTimerReducer, undefined, createInitialState);
  // Internal updates (ticks, remote state) go through rawDispatch; user actions through `dispatch`,
  // which waits while the device is catching up with the shared state after sleep or reconnect.
  const dispatch = rawDispatch;
  const [configReady, setConfigReady] = useState(false);
  const { activeSession, loading: gameLoading } = useGame();
  const suppressUntilRef = useRef<number>(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Echo suppression: skip sync effect only for the exact state received from another source.
  const suppressSyncSnapshotRef = useRef<SyncSnapshot | null>(null);

  // Track session createdAt to detect session end vs start
  const prevSessionCreatedAtRef = useRef(activeSession?.createdAt);

  // Track previous sync-relevant values to detect changes
  const prevSyncRef = useRef({
    currentStage: state.currentStage,
    anchorTs: state.anchorTs,
    isPaused: state.isPaused,
    isOver: state.isOver,
  });

  const saveConfigQueueRef = useRef<Promise<void>>(Promise.resolve());
  const startedSessionRef = useRef<string | null>(null);

  // After "Начать игру" the timer waits on pause, so the game really starts on the first run.
  useEffect(() => {
    if (!activeSession || activeSession.startedAt || state.isPaused || state.isOver) return;
    if (startedSessionRef.current === activeSession.id) return;
    if (state.anchorTs < Date.parse(activeSession.createdAt)) return;
    startedSessionRef.current = activeSession.id;
    void markSessionStarted(activeSession.id, new Date(state.anchorTs).toISOString());
  }, [activeSession, state.isPaused, state.isOver, state.anchorTs]);
  const appConfigRestoringRef = useRef(false);
  const didStartConfigPersistRef = useRef(false);
  // Config is written back to the DB only after it was loaded from there; otherwise a fresh
  // browser could overwrite the shared settings with its local defaults during page load.
  const configLoadedRef = useRef(false);

  // --- Catch-up after sleep / hidden tab / reconnect ---
  // A device that slept (locked phone, closed laptop lid) or lost its realtime connection has
  // missed other devices' changes. Acting on that stale state (auto-advancing an expired round,
  // or a pause tap) would write an old round to the DB and pull every other device back.
  // So before ticking or applying user actions again, it reloads the shared state from the DB.
  const resyncingRef = useRef(false);
  const needsResyncRef = useRef(false);
  const lastResyncAttemptRef = useRef(0);
  const pendingUserActionsRef = useRef<Action[]>([]);

  const resync = useCallback((reason: string) => {
    if (resyncingRef.current) return;
    resyncingRef.current = true;
    needsResyncRef.current = true;
    lastResyncAttemptRef.current = Date.now();
    const timeout = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 5000));
    const load = saveQueueRef.current.catch(() => {}).then(() => fetchTimerState());
    Promise.race([load, timeout])
      .then(saved => {
        if (saved === 'timeout' || !saved) {
          logTimerEvent({ kind: 'resync', cause: `${reason}:failed` });
          return;
        }
        needsResyncRef.current = false;
        logTimerEvent({ kind: 'resync', cause: reason, toStage: saved.currentStage });
        suppressSyncSnapshotRef.current = toSyncSnapshot(saved);
        rawDispatch({ type: 'RESTORE_STATE', payload: saved, origin: 'resync' });
      })
      .catch(() => logTimerEvent({ kind: 'resync', cause: `${reason}:error` }))
      .finally(() => {
        resyncingRef.current = false;
        const pending = pendingUserActionsRef.current;
        pendingUserActionsRef.current = [];
        pending.forEach(action => rawDispatch(action));
      });
  }, []);

  const guardedDispatch = useCallback((action: Action) => {
    if (resyncingRef.current) {
      pendingUserActionsRef.current.push(action);
      return;
    }
    rawDispatch(action);
  }, []);

  // Diagnostics: detect when this device's timer stopped running (sleep, background tab).
  const lastTickAtRef = useRef<number>(Date.now());
  const lastGapRef = useRef<{ gapMs: number; at: number } | null>(null);

  // Timer tick — just recomputes timeLeft from anchor, no decrement
  useEffect(() => {
    lastTickAtRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const gapMs = now - lastTickAtRef.current;
      lastTickAtRef.current = now;
      if (gapMs > 5000) {
        lastGapRef.current = { gapMs, at: now };
        // Background tabs tick about once a minute; log only real sleeps separately.
        if (gapMs > 120_000) logTimerEvent({ kind: 'wake', cause: 'tick_gap', details: { gapMs } });
      }
      // Missed ticks mean this device was asleep: catch up from the DB before ticking on.
      if (gapMs > 3000) resync('tick_gap');
      else if (needsResyncRef.current && now - lastResyncAttemptRef.current > 3000) resync('retry');
      if (resyncingRef.current) return;
      rawDispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(id);
  }, [resync]);

  // Diagnostics: log every stage / pause / anchor change together with its cause.
  useEffect(() => {
    const t = state.lastTransition;
    if (!t) return;
    const gap = lastGapRef.current;
    const recentGap = gap && Date.now() - gap.at < 60_000 ? gap.gapMs : undefined;
    logTimerEvent({
      kind: 'change',
      cause: t.cause,
      fromStage: t.fromStage,
      toStage: t.toStage,
      details: {
        wasPaused: t.wasPaused,
        isPaused: t.isPaused,
        prevAnchorTs: t.prevAnchorTs,
        anchorTs: t.anchorTs,
        elapsedBeforePause: t.elapsedBeforePause,
        timeLeftBefore: t.timeLeftBefore,
        visibility: typeof document !== 'undefined' ? document.visibilityState : undefined,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        recentTickGapMs: recentGap,
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastTransition]);

  // Diagnostics: tab hidden / shown (phone locked, laptop lid, switched tab).
  useEffect(() => {
    const onVisibility = () => {
      logTimerEvent({ kind: 'visibility', cause: document.visibilityState });
      if (document.visibilityState === 'visible' && configLoadedRef.current) resync('visible');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [resync]);

  // Audio side effects
  useEffect(() => {
    if (!state.pendingSound) return;
    if (silent) {
      dispatch({ type: 'CLEAR_SOUND' });
      return;
    }
    const event = state.pendingSound;
    const now = Date.now();
    if (event === 'tick' && now < suppressUntilRef.current) {
      dispatch({ type: 'CLEAR_SOUND' });
      return;
    }
    if (event !== 'tick') suppressUntilRef.current = now + 3500;
    playSound(event);
    dispatch({ type: 'CLEAR_SOUND' });
  }, [state.pendingSound, silent]);

  // --- Restore app config + timer state from DB on mount / session change ---
  useEffect(() => {
    if (gameLoading) return;

    const prevCreatedAt = prevSessionCreatedAtRef.current;
    prevSessionCreatedAtRef.current = activeSession?.createdAt;

    // Session just ended (was active, now null) — keep current timer state
    // (already paused by handleFinishGame), don't overwrite from DB
    if (prevCreatedAt && !activeSession?.createdAt) return;

    let cancelled = false;

    Promise.all([fetchAppConfig(), fetchTimerState()]).then(([config, saved]) => {
      if (cancelled) return;
      setConfigReady(true);
      configLoadedRef.current = true;

      if (!saved) {
        if (config) {
          appConfigRestoringRef.current = true;
          dispatch({ type: 'RESTORE_CONFIG', config, resetInitialTimer: true, origin: 'config_load' });
        } else {
          saveConfigQueueRef.current = saveConfigQueueRef.current
            .catch(() => {})
            .then(() => saveAppConfig(state.config));
        }
        return;
      }

      if (isPersistedTimerStateStaleForSession(saved.updatedAt, activeSession?.createdAt)) {
        dispatch({ type: 'RESTART', origin: 'session_load' });
        if (config) {
          appConfigRestoringRef.current = true;
          dispatch({ type: 'RESTORE_CONFIG', config, resetInitialTimer: true, origin: 'config_load' });
        }
        return;
      }

      suppressSyncSnapshotRef.current = toSyncSnapshot(saved);
      dispatch({ type: 'RESTORE_STATE', payload: saved, origin: 'initial' });
      if (config) {
        appConfigRestoringRef.current = true;
        dispatch({ type: 'RESTORE_CONFIG', config, origin: 'config_load' });
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.createdAt, gameLoading]);

  // --- Realtime: subscribe + receive anchor state from other devices ---
  useEffect(() => {
    const sessionId = process.env.NEXT_PUBLIC_SESSION_ID ?? 'main';
    const unsubscribe = subscribeChannel(
      `timer:${sessionId}`,
      () => getTimerChannel(sessionId).on('broadcast', { event: 'state' }, ({ payload }) => {
        suppressSyncSnapshotRef.current = toSyncSnapshot(payload);
        dispatch({ type: 'RESTORE_STATE', payload, origin: 'broadcast' });
      }),
      channel => { channelRef.current = channel; },
      status => {
        logTimerEvent({ kind: 'channel', cause: `broadcast:${status}` });
        if (status !== 'SUBSCRIBED') needsResyncRef.current = configLoadedRef.current;
        else if (needsResyncRef.current) resync('reconnect');
      },
    );
    return () => {
      channelRef.current = null;
      unsubscribe();
    };
  }, []);

  // --- Realtime DB sync for durable app config ---
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    return subscribeChannel('app-config-sync', () => client
      .channel('app-config-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'id=eq.main' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          const config = normalizeConfig(row?.config_json);
          if (!config) return;
          appConfigRestoringRef.current = true;
          dispatch({ type: 'RESTORE_CONFIG', config, origin: 'config_sync' });
        }
      )
    );
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

    // A device that has not caught up yet keeps counting locally, but does not push its own
    // auto-advance to others: its idea of the current round may be outdated.
    if (needsResyncRef.current && state.lastTransition?.cause === 'auto_advance') return;

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

    // Auto-advance (round time ran out) is not broadcast and not written blindly: every
    // up-to-date device reaches the next round on its own at the same moment. The DB accepts it
    // only if it still holds the round this device was counting; otherwise this device was out
    // of date (missed a pause or a round change) and takes the DB state instead.
    const t = state.lastTransition;
    if (t?.cause === 'auto_advance' && t.toStage === state.currentStage && t.anchorTs === state.anchorTs) {
      const expected = { stage: t.fromStage, anchorTs: t.prevAnchorTs };
      saveQueueRef.current = saveQueueRef.current
        .catch(() => {})
        .then(() => advanceTimerStage(expected, payload))
        .then(row => {
          if (!row) return;
          if (row.currentStage === payload.currentStage && row.anchorTs === payload.anchorTs) return;
          logTimerEvent({ kind: 'advance_refused', fromStage: payload.currentStage, toStage: row.currentStage, details: { isPaused: row.isPaused } });
          suppressSyncSnapshotRef.current = toSyncSnapshot(row);
          rawDispatch({ type: 'RESTORE_STATE', payload: row, origin: 'db' });
        });
      return;
    }

    // Save local changes to DB in order; out-of-order RPC completion can otherwise
    // make a stale play/pause state look newer than the user's last action.
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => saveTimerState(payload));

    // Broadcast to other devices (only when WebSocket is connected)
    if (channelRef.current?.state === 'joined') {
      channelRef.current.send({ type: 'broadcast', event: 'state', payload });
    }
  }, [state.currentStage, state.anchorTs, state.isPaused, state.isOver, state.elapsedBeforePause, state.warnedOneMin]);

  // --- Realtime DB sync ---
  // Broadcast is fast, but it can be missed by a temporarily disconnected device.
  // Treat timer_state as the durable fallback for both web and iOS writes.
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    return subscribeChannel('timer-state-ios-sync', () => client
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
          dispatch({ type: 'RESTORE_STATE', payload: restoredState, origin: 'db' });
        }
      ),
      undefined,
      status => {
        logTimerEvent({ kind: 'channel', cause: `db:${status}` });
        if (status !== 'SUBSCRIBED') needsResyncRef.current = configLoadedRef.current;
        else if (needsResyncRef.current) resync('reconnect');
      },
    );
  }, [dispatch]);

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

    if (!configLoadedRef.current) return;

    saveConfigQueueRef.current = saveConfigQueueRef.current
      .catch(() => {})
      .then(() => saveAppConfig(state.config));
  }, [state.config]);

  return (
    <TimerContext.Provider value={{ state, dispatch: guardedDispatch, configReady }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
